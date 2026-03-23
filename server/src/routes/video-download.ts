import { Router } from 'express';
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

const execAsync = promisify(exec);
const router = Router();

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 支持的视频平台配置
const VIDEO_PLATFORMS: Record<string, { patterns: RegExp[]; name: string }> = {
  douyin: {
    patterns: [/douyin\.com/, /v\.douyin\.com/],
    name: '抖音',
  },
  bilibili: {
    patterns: [/bilibili\.com/, /b23\.tv/],
    name: 'B站',
  },
  tencent: {
    patterns: [/v\.qq\.com/, /weixin\.qq\.com/],
    name: '腾讯视频',
  },
  iqiyi: {
    patterns: [/iqiyi\.com/],
    name: '爱奇艺',
  },
  youku: {
    patterns: [/youku\.com/],
    name: '优酷',
  },
  youtube: {
    patterns: [/youtube\.com/, /youtu\.be/],
    name: 'YouTube',
  },
  xiaohongshu: {
    patterns: [/xiaohongshu\.com/, /xhslink\.com/],
    name: '小红书',
  },
  kuaishou: {
    patterns: [/kuaishou\.com/, /gifshow\.com/],
    name: '快手',
  },
  // 通用视频链接
  generic: {
    patterns: [/\.(mp4|webm|ogg|mp3|wav|m4a|aac|flac)(\?.*)?$/i],
    name: '直接链接',
  },
};

// 解析短链接重定向（使用 curl，更可靠）
async function resolveRedirect(url: string): Promise<string> {
  try {
    // 使用 curl 解析重定向，模拟移动端微信
    const { stdout } = await execAsync(
      `curl -sIL -A "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38" "${url}" | grep -i "^location:" | tail -1 | cut -d' ' -f2 | tr -d '\\r\\n'`,
      { timeout: 15000 }
    );
    
    const resolved = stdout.trim();
    if (resolved && resolved.startsWith('http')) {
      console.log(`[重定向解析] ${url} -> ${resolved}`);
      return resolved;
    }
    
    // 备用方案：使用 axios
    const response = await axios.head(url, {
      maxRedirects: 10,
      timeout: 10000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38',
      },
    });
    return response.request?.res?.responseUrl || url;
  } catch (e) {
    console.log('[重定向解析] 失败，使用原始URL:', (e as Error).message);
    return url;
  }
}

// 检测视频平台
function detectPlatform(url: string): { key: string; name: string } | null {
  for (const [key, config] of Object.entries(VIDEO_PLATFORMS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(url)) {
        return { key, name: config.name };
      }
    }
  }
  return null;
}

// 检查文件是否存在
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 直接下载文件（备用方案）
async function downloadDirectly(url: string, tempDir: string, timestamp: number): Promise<{ filePath: string; title: string; duration: number } | null> {
  try {
    // 获取文件扩展名
    let ext = '.mp3';
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const urlExt = path.extname(pathname);
      if (urlExt && /\.(mp3|mp4|wav|m4a|aac|webm|ogg)$/i.test(urlExt)) {
        ext = urlExt;
      }
    } catch (e) {
      // URL 解析失败，使用默认扩展名
    }
    
    const outputPath = path.join(tempDir, `${timestamp}_download${ext}`);
    
    console.log(`[直接下载] 开始下载: ${url} -> ${outputPath}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 5 * 60 * 1000, // 5分钟
      maxContentLength: 500 * 1024 * 1024, // 500MB
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    
    const buffer = Buffer.from(response.data);
    await fs.writeFile(outputPath, buffer);
    
    // 获取文件信息
    const title = path.basename(url, ext).substring(0, 100) || 'downloaded_media';
    
    return {
      filePath: outputPath,
      title,
      duration: 0, // 需要额外处理获取时长
    };
  } catch (error) {
    console.error(`[直接下载] 失败:`, error);
    return null;
  }
}

/**
 * POST /api/v1/materials/download
 * 从视频链接下载材料
 * Body: { url: string, title?: string }
 */
router.post('/', async (req: Request, res: Response) => {
  const { url, title } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '请提供视频链接' });
  }
  
  console.log(`[下载] 开始处理链接: ${url}`);
  
  try {
    // 检测平台
    const platform = detectPlatform(url);
    console.log(`[下载] 检测到平台: ${platform?.name || '未知'}`);
    
    const tempDir = '/tmp/video_downloads';
    await fs.mkdir(tempDir, { recursive: true });
    
    const timestamp = Date.now();
    const outputTemplate = path.join(tempDir, `${timestamp}_%(title).100s.%(ext)s`);
    
    let filePath = '';
    let videoTitle = title || '';
    let duration = 0;
    
    // 解析短链接重定向
    let resolvedUrl = url;
    if (platform?.key === 'douyin' || platform?.key === 'xiaohongshu' || platform?.key === 'kuaishou') {
      console.log(`[下载] 解析短链接重定向...`);
      resolvedUrl = await resolveRedirect(url);
      console.log(`[下载] 重定向后: ${resolvedUrl}`);
    }
    
    // 构建 yt-dlp 命令
    const ytdlpArgs = [
      'yt-dlp',
      '--no-playlist',
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-check-certificate',
      '--no-warnings',
      // 抖音/小红书/快手需要移动端UA
      '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38',
      '-o', outputTemplate,
      '--print', 'filepath',
      '--print', 'title',
      '--print', 'duration_string',
    ];
    
    // 为特定平台添加额外参数
    if (platform?.key === 'douyin') {
      // 抖音可能需要提取视频而非音频
      ytdlpArgs.push('--extractor-args', 'douyin:webpage_fallback=true');
    }
    
    ytdlpArgs.push(resolvedUrl);
    
    // 使用数组形式执行命令，避免 shell 注入问题
    console.log(`[下载] 执行命令: yt-dlp ...`);
    
    try {
      // 使用 spawn 而不是 exec，避免 shell 解析问题
      const { spawn } = await import('child_process');
      
      const downloadResult = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const proc = spawn('yt-dlp', ytdlpArgs.slice(1), { // 跳过第一个 'yt-dlp'
          timeout: 5 * 60 * 1000,
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`yt-dlp 退出码 ${code}: ${stderr || stdout}`));
          }
        });
        
        proc.on('error', (err) => {
          reject(err);
        });
      });
      
      // 解析下载结果
      const lines = downloadResult.stdout.trim().split('\n').filter(Boolean);
      console.log(`[下载] 结果行数: ${lines.length}`);
      
      // 解析输出
      if (lines.length >= 1) {
        filePath = lines[0].trim();
      }
      if (lines.length >= 2 && !videoTitle) {
        videoTitle = lines[1].trim().substring(0, 200);
      }
      if (lines.length >= 3) {
        // 解析时长字符串 (格式可能是 "3:45" 或 "3:45:30")
        const durationStr = lines[2].trim();
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2) {
          duration = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }
    } catch (execError: any) {
      console.error(`[下载] yt-dlp 执行失败:`, execError.message);
      
      // 解析具体错误原因
      let errorMsg = execError.message || '未知错误';
      let suggestion = '';
      
      if (errorMsg.includes('Video unavailable') || errorMsg.includes('not available')) {
        suggestion = '视频不可用，可能已被删除或设为私密';
      } else if (errorMsg.includes('Sign in') || errorMsg.includes('login') || errorMsg.includes('age-restricted')) {
        suggestion = '视频需要登录或年龄验证，暂不支持';
      } else if (errorMsg.includes('Private video')) {
        suggestion = '这是私密视频，无法下载';
      } else if (errorMsg.includes('HTTP Error 403') || errorMsg.includes('Forbidden')) {
        suggestion = '访问被拒绝，可能是地区限制或需要登录';
      } else if (errorMsg.includes('HTTP Error 404')) {
        suggestion = '视频不存在或已被删除';
      } else if (errorMsg.includes('Fresh cookies') || errorMsg.includes('cookies')) {
        suggestion = '该平台视频暂时无法下载，请尝试其他视频或使用其他平台';
      } else if (platform?.key === 'douyin') {
        suggestion = '抖音视频下载失败，请尝试：1) 使用完整链接（非短链接）；2) 确认视频公开可访问；3) 尝试其他视频';
      } else if (platform?.key === 'xiaohongshu') {
        suggestion = '小红书视频下载失败，请确保视频公开可访问';
      }
      
      // 尝试备用方案：直接下载（适用于直接链接）
      console.log(`[下载] 尝试直接下载...`);
      const directResult = await downloadDirectly(url, tempDir, timestamp);
      
      if (directResult) {
        filePath = directResult.filePath;
        videoTitle = videoTitle || directResult.title;
        duration = directResult.duration;
      } else {
        throw new Error(`${errorMsg}\n\n${suggestion || '请检查链接是否有效，或尝试其他平台视频'}`);
      }
    }
    
    // 如果没有找到文件，尝试在目录中查找最新的文件
    if (!filePath || !await fileExists(filePath)) {
      const files = await fs.readdir(tempDir);
      const recentFiles = files
        .filter(f => f.startsWith(String(timestamp)))
        .sort()
        .reverse();
      
      if (recentFiles.length > 0) {
        filePath = path.join(tempDir, recentFiles[0]);
        console.log(`[下载] 找到文件: ${filePath}`);
      }
    }
    
    if (!filePath || !await fileExists(filePath)) {
      throw new Error('下载完成但找不到文件，请重试');
    }
    
    console.log(`[下载] 文件路径: ${filePath}`);
    console.log(`[下载] 标题: ${videoTitle}, 时长: ${duration}s`);
    
    // 读取文件
    const fileBuffer = await fs.readFile(filePath);
    console.log(`[下载] 文件大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // 清理文件名中的特殊字符
    const safeTitle = (videoTitle || title || '未命名材料')
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 100);
    
    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `audio/${timestamp}_${safeTitle}.mp3`,
      contentType: 'audio/mpeg',
    });
    
    console.log(`[下载] 上传成功: ${fileKey}`);
    
    // 清理临时文件
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // 忽略清理错误
    }
    
    // 存储到数据库
    const supabase = getSupabaseClient();
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .insert({
        title: videoTitle || title || '未命名材料',
        description: `来源: ${platform?.name || url}`,
        audio_url: fileKey,
        duration: Math.round(duration),
        full_text: '',
      })
      .select()
      .single();
    
    if (materialError) {
      throw new Error(`创建材料失败: ${materialError.message}`);
    }
    
    console.log(`[下载] 材料创建成功: ${material.id}`);
    
    res.json({
      success: true,
      material,
      platform: platform?.name,
      message: `已从 ${platform?.name || '链接'} 下载并创建材料`,
    });
    
  } catch (error) {
    console.error('[下载] 失败:', error);
    const errorMessage = (error as Error).message;
    
    // 构建友好的错误提示
    let userMessage = errorMessage;
    let suggestion = '支持的链接：抖音、B站、腾讯视频、爱奇艺、优酷、YouTube、小红书、快手等。\n\n';
    
    if (errorMessage.includes('抖音')) {
      suggestion += '抖音下载提示：\n• 请使用完整视频链接（如 https://www.douyin.com/video/xxx）\n• 确保视频公开可访问，非私密或限流视频\n• 部分视频可能需要登录查看，暂不支持';
    } else if (errorMessage.includes('小红书')) {
      suggestion += '小红书下载提示：\n• 确保视频公开可访问\n• 建议使用完整的笔记链接';
    } else {
      suggestion += '请确保：\n• 链接可以在浏览器中直接打开\n• 视频是公开可访问的\n• 视频未被删除或设为私密';
    }
    
    res.status(500).json({ 
      error: '下载失败', 
      message: userMessage,
      suggestion,
    });
  }
});

export default router;
