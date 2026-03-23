import express, { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage, ASRClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const execAsync = promisify(exec);
const router = Router();

// 用于处理上传的内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB - 支持视频文件
});

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 支持的视频平台配置
const VIDEO_PLATFORMS = {
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
  // 通用视频链接
  generic: {
    patterns: [/\.(mp4|webm|ogg|mp3|wav|m4a|aac)(\?.*)?$/i],
    name: '直接链接',
  },
};

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

/**
 * POST /api/v1/materials/download
 * 从视频链接下载材料
 * Body: { url: string, title?: string }
 */
router.post('/download', async (req: Request, res: Response) => {
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
    const outputTemplate = path.join(tempDir, `${timestamp}_%(title)s.%(ext)s`);
    
    // 使用 yt-dlp 下载
    // --no-playlist: 不下载播放列表
    // -f bestaudio: 下载最佳音频质量
    // --extract-audio: 提取音频
    // --audio-format mp3: 转换为 MP3
    // --no-check-certificate: 不检查证书（某些平台需要）
    // --user-agent: 设置用户代理
    const downloadCmd = [
      'yt-dlp',
      '--no-playlist',
      '-f', '"bestaudio/best"',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-check-certificate',
      '--user-agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"',
      '-o', `"${outputTemplate}"`,
      '--print', 'filepath',
      '--print', 'title',
      '--print', 'duration',
      `"${url}"`,
    ].join(' ');
    
    console.log(`[下载] 执行命令: ${downloadCmd}`);
    
    let downloadResult;
    try {
      downloadResult = await execAsync(downloadCmd, {
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 5 * 60 * 1000, // 5分钟超时
      });
    } catch (execError: any) {
      console.error(`[下载] yt-dlp 执行失败:`, execError.message);
      
      // 尝试备用方案：直接下载（适用于直接链接）
      if (platform?.key === 'generic' || !platform) {
        console.log(`[下载] 尝试直接下载...`);
        const directResult = await downloadDirectly(url, tempDir, timestamp);
        if (directResult) {
          downloadResult = directResult;
        } else {
          throw new Error('下载失败，请检查链接是否有效');
        }
      } else {
        throw new Error(`下载失败: ${execError.message}`);
      }
    }
    
    // 解析下载结果
    const lines = downloadResult.stdout.trim().split('\n').filter(Boolean);
    console.log(`[下载] 结果:`, lines);
    
    let filePath = '';
    let videoTitle = title || '';
    let duration = 0;
    
    // 解析输出
    if (lines.length >= 1) {
      filePath = lines[0].trim();
    }
    if (lines.length >= 2) {
      videoTitle = videoTitle || lines[1].trim();
    }
    if (lines.length >= 3) {
      duration = parseInt(lines[2].trim()) || 0;
    }
    
    // 如果没有找到文件，尝试在目录中查找
    if (!filePath || !await fileExists(filePath)) {
      const files = await fs.readdir(tempDir);
      const recentFiles = files
        .filter(f => f.startsWith(String(timestamp)))
        .sort()
        .reverse();
      
      if (recentFiles.length > 0) {
        filePath = path.join(tempDir, recentFiles[0]);
      }
    }
    
    if (!filePath || !await fileExists(filePath)) {
      throw new Error('下载完成但找不到文件');
    }
    
    console.log(`[下载] 文件路径: ${filePath}`);
    console.log(`[下载] 标题: ${videoTitle}, 时长: ${duration}s`);
    
    // 读取文件
    const fileBuffer = await fs.readFile(filePath);
    console.log(`[下载] 文件大小: ${fileBuffer.length} bytes`);
    
    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `audio/${timestamp}_${videoTitle || 'download'}.mp3`,
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
        duration: duration,
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
    res.status(500).json({ 
      error: '下载失败', 
      message: (error as Error).message,
      suggestion: '请确保链接有效且可以在浏览器中直接访问',
    });
  }
});

// 直接下载文件（备用方案）
async function downloadDirectly(url: string, tempDir: string, timestamp: number): Promise<{ stdout: string; stderr: string } | null> {
  try {
    // 获取文件扩展名
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname) || '.mp3';
    
    const outputPath = path.join(tempDir, `${timestamp}_download${ext}`);
    
    console.log(`[直接下载] 开始下载: ${url} -> ${outputPath}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 5 * 60 * 1000, // 5分钟
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const buffer = Buffer.from(response.data);
    await fs.writeFile(outputPath, buffer);
    
    // 获取文件信息
    const title = path.basename(url, ext);
    const duration = 0; // 需要额外处理获取时长
    
    return {
      stdout: `${outputPath}\n${title}\n${duration}`,
      stderr: '',
    };
  } catch (error) {
    console.error(`[直接下载] 失败:`, error);
    return null;
  }
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

// 用于存储分块上传的临时数据
const uploadChunks: Map<string, { chunks: Buffer[], fileName: string, contentType: string }> = new Map();

/**
 * POST /api/v1/materials/chunk
 * 分块上传 - 上传文件块
 * Body: FormData { chunk: File, chunkIndex: number, totalChunks: number, uploadId: string, fileName: string, contentType: string }
 */
router.post('/chunk', upload.single('chunk'), async (req: Request, res: Response) => {
  try {
    const { chunkIndex, totalChunks, uploadId, fileName, contentType } = req.body;
    const chunk = req.file;

    console.log(`[分块上传] 收到分块: index=${chunkIndex}, total=${totalChunks}, uploadId=${uploadId}`);
    console.log(`[分块上传] 文件信息: name=${chunk?.originalname}, size=${chunk?.size}, mimetype=${chunk?.mimetype}`);
    console.log(`[分块上传] buffer大小: ${chunk?.buffer?.length || 0} bytes`);

    if (!chunk || !uploadId || !fileName) {
      console.log(`[分块上传] 缺少必要参数: chunk=${!!chunk}, uploadId=${uploadId}, fileName=${fileName}`);
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const index = parseInt(chunkIndex);
    const total = parseInt(totalChunks);

    // 初始化或获取上传会话
    if (!uploadChunks.has(uploadId)) {
      console.log(`[分块上传] 创建新会话: uploadId=${uploadId}, total=${total}`);
      uploadChunks.set(uploadId, {
        chunks: new Array(total),
        fileName,
        contentType: contentType || 'application/octet-stream',
      });
    }

    const session = uploadChunks.get(uploadId)!;
    session.chunks[index] = chunk.buffer;
    
    console.log(`[分块上传] 保存分块 ${index}: ${chunk.buffer.length} bytes`);

    // 检查是否所有块都已上传
    const uploadedCount = session.chunks.filter(c => c !== undefined).length;
    const totalSize = session.chunks.reduce((sum, c) => sum + (c?.length || 0), 0);
    console.log(`[分块上传] 进度: ${uploadedCount}/${total}, 已接收总大小: ${totalSize} bytes`);
    
    res.json({ 
      success: true, 
      chunkIndex: index, 
      uploaded: uploadedCount,
      total: total,
      chunkSize: chunk.buffer.length,
    });
  } catch (error) {
    console.error('上传块失败:', error);
    res.status(500).json({ error: '上传块失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/chunk-json
 * 分块上传 - JSON 格式（避免 multipart 代理问题）
 * Body: { chunkIndex: number, totalChunks: number, uploadId: string, fileName: string, contentType: string, data: string }
 */
router.post('/chunk-json', express.json({ limit: '50mb' }), async (req: Request, res: Response) => {
  try {
    const { chunkIndex, totalChunks, uploadId, fileName, contentType, data } = req.body;

    console.log(`[JSON分块] 收到分块: index=${chunkIndex}, total=${totalChunks}, uploadId=${uploadId}`);
    console.log(`[JSON分块] 数据长度: ${data?.length || 0} 字符`);

    if (!data || !uploadId || !fileName) {
      console.log(`[JSON分块] 缺少必要参数`);
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const index = parseInt(chunkIndex);
    const total = parseInt(totalChunks);

    // 存储 base64 字符串（不解码），避免分块解码时丢失数据
    console.log(`[JSON分块] 收到 base64 数据: ${data.length} 字符`);

    // 初始化或获取上传会话
    if (!uploadChunks.has(uploadId)) {
      console.log(`[JSON分块] 创建新会话: uploadId=${uploadId}, total=${total}`);
      uploadChunks.set(uploadId, {
        chunks: new Array(total),
        fileName,
        contentType: contentType || 'application/octet-stream',
      });
    }

    const session = uploadChunks.get(uploadId)!;
    session.chunks[index] = data;  // 存储 base64 字符串
    
    console.log(`[JSON分块] 保存分块 ${index}: ${data.length} 字符`);

    // 检查是否所有块都已上传
    const uploadedCount = session.chunks.filter(c => c !== undefined).length;
    const totalChars = session.chunks.reduce((sum, c) => sum + (c?.length || 0), 0);
    console.log(`[JSON分块] 进度: ${uploadedCount}/${total}, 已接收总字符: ${totalChars}`);
    
    res.json({ 
      success: true, 
      chunkIndex: index, 
      uploaded: uploadedCount,
      total: total,
      chunkChars: data.length,
    });
  } catch (error) {
    console.error('JSON分块上传失败:', error);
    res.status(500).json({ error: '上传块失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/complete
 * 分块上传 - 完成上传并处理
 * Body: { uploadId: string, title: string, description?: string, duration?: number }
 */
router.post('/complete', express.json(), async (req: Request, res: Response) => {
  try {
    const { uploadId, title, description, duration } = req.body;

    if (!uploadId || !title) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const session = uploadChunks.get(uploadId);
    if (!session) {
      console.error(`上传会话不存在: ${uploadId}`);
      return res.status(400).json({ error: '上传会话不存在或已过期' });
    }

    // 详细记录每个分块的状态
    console.log(`\n[完成上传] 会话信息: uploadId=${uploadId}`);
    console.log(`[完成上传] 预期分块数: ${session.chunks.length}`);
    session.chunks.forEach((c, i) => {
      console.log(`[完成上传] 分块 ${i}: ${c ? c.length + ' 字符' : 'undefined'}`);
    });

    // 合并所有 base64 字符串
    const base64Chunks = session.chunks.filter(c => c !== undefined);
    if (base64Chunks.length === 0) {
      console.error(`没有有效的分块数据: uploadId=${uploadId}`);
      return res.status(400).json({ error: '没有有效的上传数据' });
    }
    
    // 合并 base64 后一次性解码（避免分块解码丢失数据）
    const combinedBase64 = base64Chunks.join('');
    console.log(`[完成上传] 合并后 base64 长度: ${combinedBase64.length} 字符`);
    
    let buffer = Buffer.from(combinedBase64, 'base64');
    let fileName = session.fileName;
    let mimeType = session.contentType;
    
    console.log(`\n===== 分块上传完成 =====`);
    console.log('文件名:', fileName);
    console.log('MIME类型:', mimeType);
    console.log('文件大小:', buffer.length, 'bytes');
    console.log('有效分块数:', base64Chunks.length, '/', session.chunks.length);

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName: `audio/${Date.now()}_${fileName}`,
      contentType: mimeType || 'application/octet-stream',
    });

    // 清理会话
    uploadChunks.delete(uploadId);

    // 存储到数据库
    const supabase = getSupabaseClient();
    
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .insert({
        title,
        description: description || '',
        audio_url: fileKey,
        duration: duration || 0,
        full_text: '',
      })
      .select()
      .single();

    if (materialError || !material) {
      throw new Error(materialError?.message || '创建材料失败');
    }

    console.log(`材料创建成功: ID=${material.id}, 标题=${title}`);

    // 异步处理：视频转音频 + ASR + 分句
    processMediaAsync(material.id, fileKey, fileName, mimeType).catch(err => {
      console.error(`异步处理失败 [material=${material.id}]:`, err.message);
    });

    res.json({
      success: true,
      material: material,
      message: '文件上传成功，正在后台处理音频...',
    });
  } catch (error) {
    console.error('完成上传失败:', error);
    res.status(500).json({ error: '处理文件失败', message: (error as Error).message });
  }
});

/**
 * 异步处理媒体文件：视频转音频 + ASR + 分句
 */
async function processMediaAsync(
  materialId: number,
  fileKey: string,
  fileName: string,
  mimeType: string
): Promise<void> {
  console.log(`\n[异步处理] 开始处理材料 ${materialId}`);
  
  try {
    const supabase = getSupabaseClient();
    
    // 检测是否为视频文件
    const isVideo = mimeType?.startsWith('video/') || 
                    fileName?.toLowerCase().endsWith('.mov') ||
                    fileName?.toLowerCase().endsWith('.mp4') ||
                    fileName?.toLowerCase().endsWith('.avi') ||
                    fileName?.toLowerCase().endsWith('.mkv') ||
                    fileName?.toLowerCase().endsWith('.webm');

    let audioKey = fileKey;
    let audioUrl: string;

    // 如果是视频，使用 ffmpeg 提取音频
    if (isVideo) {
      console.log(`[异步处理] 检测到视频文件，使用 ffmpeg 提取音频...`);
      
      // 生成临时签名 URL 下载视频
      const videoUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400,
      });
      
      // 下载视频文件
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'arraybuffer',
        timeout: 5 * 60 * 1000,
      });
      
      const videoBuffer = Buffer.from(response.data);
      const tempDir = '/tmp/video_processing';
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempVideoPath = path.join(tempDir, `${materialId}_${fileName}`);
      const tempAudioPath = path.join(tempDir, `${materialId}_audio.mp3`);
      
      await fs.writeFile(tempVideoPath, videoBuffer);
      console.log(`[异步处理] 视频文件已保存: ${videoBuffer.length} bytes`);
      
      try {
        // 使用 ffmpeg 提取音频
        const ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -vn -acodec libmp3lame -ab 192k "${tempAudioPath}"`;
        console.log(`[异步处理] 执行: ${ffmpegCmd}`);
        
        await execAsync(ffmpegCmd, { timeout: 5 * 60 * 1000 });
        
        // 检查音频文件是否生成
        const audioStats = await fs.stat(tempAudioPath);
        if (audioStats.size > 0) {
          // 上传音频到对象存储
          const audioBuffer = await fs.readFile(tempAudioPath);
          audioKey = await storage.uploadFile({
            fileContent: audioBuffer,
            fileName: `audio/${materialId}_converted.mp3`,
            contentType: 'audio/mpeg',
          });
          
          console.log(`[异步处理] 音频提取成功: ${audioBuffer.length} bytes`);
          
          // 更新材料音频 URL
          await supabase
            .from('materials')
            .update({ audio_url: audioKey })
            .eq('id', materialId);
        } else {
          throw new Error('音频文件生成失败：文件大小为 0');
        }
      } finally {
        // 清理临时文件
        try {
          await fs.unlink(tempVideoPath);
          await fs.unlink(tempAudioPath);
        } catch (e) {}
      }
    }
    
    // 生成音频签名 URL
    audioUrl = await storage.generatePresignedUrl({
      key: audioKey,
      expireTime: 86400,
    });

    // 执行 ASR
    console.log(`[异步处理] 开始 ASR 识别...`);
    
    const customHeaders = HeaderUtils.extractForwardHeaders({} as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
      lang: 'en',
    } as any);

    console.log(`[异步处理] ASR 完成`);

    // 获取 ASR 返回的原始文本
    let rawText = asrResult.text || asrResult.rawData?.result?.text || '';
    console.log(`[异步处理] ASR 原始文本: ${rawText.substring(0, 100)}...`);
    
    // 检查文本是否有标点符号
    const hasPunctuation = /[.!?。！？]/.test(rawText);
    
    if (!hasPunctuation && rawText.length > 20) {
      console.log(`[异步处理] 文本缺少标点符号，使用 LLM 添加标点...`);
      
      try {
        const llmClient = new LLMClient(new Config(), customHeaders);
        const punctResponse = await llmClient.invoke([
          {
            role: 'system',
            content: 'You are a text punctuation assistant. Add proper punctuation (periods, question marks, commas) to the English text. Do NOT change any words, only add punctuation marks. Keep the original text exactly as is, just add punctuation. Return ONLY the punctuated text without any explanation.'
          },
          {
            role: 'user',
            content: `Add punctuation to this English text. Keep all words exactly as they are, only add periods, question marks, exclamation marks, and commas where appropriate:\n\n${rawText}`
          }
        ], { temperature: 0.3 });
        
        const punctuatedText = punctResponse.content.trim();
        console.log(`[异步处理] LLM 添加标点后: ${punctuatedText.substring(0, 100)}...`);
        
        // 更新 ASR 结果的文本
        if (asrResult.text) {
          asrResult.text = punctuatedText;
        }
        if (asrResult.rawData?.result?.text) {
          asrResult.rawData.result.text = punctuatedText;
        }
        rawText = punctuatedText;
      } catch (llmError) {
        console.log(`[异步处理] LLM 添加标点失败: ${(llmError as Error).message}`);
        // 继续使用原始文本
      }
    }

    // 处理句子
    const sentences = await processASRResultWithSilence(asrResult, audioUrl);
    
    // 计算时长
    const asrDuration = asrResult.duration || asrResult.rawData?.duration;
    const lastEndTime = sentences.length > 0 ? sentences[sentences.length - 1].end_time : 0;
    const totalDuration = asrDuration || lastEndTime || sentences.length * 2000;

    // 插入句子
    if (sentences.length > 0) {
      const sentencesData = sentences.map((item, index) => ({
        material_id: materialId,
        sentence_index: index,
        text: item.text,
        start_time: item.start_time,
        end_time: item.end_time,
      }));

      await supabase.from('sentences').insert(sentencesData);
    }

    // 更新材料
    await supabase
      .from('materials')
      .update({ 
        duration: totalDuration,
        full_text: sentences.map(s => s.text).join(' '),
      })
      .eq('id', materialId);

    console.log(`[异步处理] 完成！材料 ${materialId} 共 ${sentences.length} 个句子`);
    
  } catch (error) {
    console.error(`[异步处理] 失败:`, error);
  }
}

/**
 * POST /api/v1/materials
 * 上传音频或视频文件并创建学习材料
 * Body: FormData { file: audio/video file, title: string, description?: string }
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频或视频文件' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: '请提供材料标题' });
    }

    let { buffer, originalname, mimetype } = req.file;
    const isVideo = mimetype?.startsWith('video/') || 
                    originalname?.toLowerCase().endsWith('.mov') ||
                    originalname?.toLowerCase().endsWith('.mp4') ||
                    originalname?.toLowerCase().endsWith('.mkv') ||
                    originalname?.toLowerCase().endsWith('.avi') ||
                    originalname?.toLowerCase().endsWith('.webm');
    
    console.log(`\n===== 上传文件处理 =====`);
    console.log('文件名:', originalname);
    console.log('MIME类型:', mimetype);
    console.log('是否视频:', isVideo);
    console.log('文件大小:', buffer.length, 'bytes');
    
    // 如果是视频文件，先转换为音频
    let audioBuffer = buffer;
    let audioFileName = originalname;
    let duration = 0;
    
    if (isVideo) {
      console.log('检测到视频文件，开始转换为音频...');
      
      // 保存视频到临时文件
      const tempDir = '/tmp/video_uploads';
      await fs.mkdir(tempDir, { recursive: true });
      const tempVideoPath = path.join(tempDir, `${Date.now()}_${originalname}`);
      const tempAudioPath = tempVideoPath.replace(/\.[^.]+$/, '.mp3');
      
      console.log('临时视频路径:', tempVideoPath);
      console.log('临时音频路径:', tempAudioPath);
      
      // 写入视频文件
      await fs.writeFile(tempVideoPath, buffer);
      
      // 使用 ffmpeg 转换为音频
      try {
        const ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -vn -acodec libmp3lame -ab 192k "${tempAudioPath}"`;
        console.log('执行命令:', ffmpegCmd);
        
        const { stdout, stderr } = await execAsync(ffmpegCmd, {
          maxBuffer: 100 * 1024 * 1024,
          timeout: 5 * 60 * 1000, // 5分钟超时
        });
        
        console.log('ffmpeg 转换完成');
        
        // 获取视频时长
        try {
          const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempVideoPath}"`;
          const durationResult = await execAsync(ffprobeCmd);
          duration = Math.round(parseFloat(durationResult.stdout.trim()) * 1000);
          console.log('视频时长:', duration, 'ms');
        } catch (e) {
          console.log('获取时长失败:', e);
        }
        
        // 读取转换后的音频文件
        audioBuffer = await fs.readFile(tempAudioPath);
        audioFileName = originalname.replace(/\.[^.]+$/, '.mp3');
        mimetype = 'audio/mpeg';
        
        console.log('音频文件大小:', audioBuffer.length, 'bytes');
        
        // 清理临时文件
        try {
          await fs.unlink(tempVideoPath);
          await fs.unlink(tempAudioPath);
        } catch (e) {
          // 忽略清理错误
        }
        
      } catch (ffmpegError) {
        console.error('ffmpeg 转换失败:', ffmpegError);
        
        // 清理临时文件
        try {
          await fs.unlink(tempVideoPath);
        } catch (e) {}
        
        throw new Error('视频转换失败，请确保上传的是有效的视频文件');
      }
    }
    
    const fileName = `audio/${Date.now()}_${audioFileName}`;

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: audioBuffer,
      fileName,
      contentType: mimetype || 'audio/mpeg',
    });

    // 生成签名 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效期
    });

    // 使用 ASR 识别音频
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    console.log('\n===== 开始 ASR 识别 =====');
    console.log('音频 URL:', audioUrl.substring(0, 100));
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
      lang: 'en', // 固定识别为英语
    } as any);

    // 打印完整的 ASR 原始响应
    console.log('\n===== ASR 原始响应 =====');
    console.log('响应类型:', typeof asrResult);
    console.log('顶层键:', Object.keys(asrResult));
    console.log('顶层 utterances:', asrResult.utterances);
    console.log('rawData 键:', asrResult.rawData ? Object.keys(asrResult.rawData) : 'null');
    console.log('rawData.utterances:', asrResult.rawData?.utterances ? `exists, length=${asrResult.rawData.utterances.length}` : 'null');
    console.log('rawData.segments:', asrResult.rawData?.segments ? `exists, length=${asrResult.rawData.segments.length}` : 'null');
    console.log('rawData.audio_info:', JSON.stringify(asrResult.rawData?.audio_info));
    
    // 打印前3个 utterance/segment
    if (asrResult.rawData?.utterances?.[0]) {
      console.log('rawData.utterances[0]:', JSON.stringify(asrResult.rawData.utterances[0], null, 2));
      console.log('rawData.utterances[1]:', JSON.stringify(asrResult.rawData.utterances[1], null, 2));
      console.log('rawData.utterances[2]:', JSON.stringify(asrResult.rawData.utterances[2], null, 2));
    }
    if (asrResult.rawData?.segments?.[0]) {
      console.log('rawData.segments[0]:', JSON.stringify(asrResult.rawData.segments[0], null, 2));
      console.log('rawData.segments[1]:', JSON.stringify(asrResult.rawData.segments[1], null, 2));
      console.log('rawData.segments[2]:', JSON.stringify(asrResult.rawData.segments[2], null, 2));
    }
    console.log('========================\n');

    // 处理句子和时间戳（传入音频 URL 进行静音检测）
    const sentences = await processASRResultWithSilence(asrResult, audioUrl);
    
    // 计算总时长：优先使用从视频获取的时长，然后是 ASR 返回的时长，最后使用估算
    const asrDuration = asrResult.duration || asrResult.rawData?.duration;
    const lastSentenceEndTime = sentences.length > 0 ? sentences[sentences.length - 1].end_time : 0;
    const totalDuration = duration || asrDuration || lastSentenceEndTime || sentences.length * 2000;
    
    console.log(`\n时长计算: ASR=${asrDuration}, 最后句结束=${lastSentenceEndTime}, 最终=${totalDuration}`);
    console.log(`生成 ${sentences.length} 个句子，示例:`, sentences.slice(0, 3));
    
    // 存储到数据库
    const supabase = getSupabaseClient();
    
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .insert({
        title,
        description: description || '',
        audio_url: fileKey, // 存储 key 而非 URL
        duration: totalDuration,
      })
      .select()
      .single();

    if (materialError || !material) {
      throw new Error(materialError?.message || '创建材料失败');
    }

    // 插入句子
    const sentencesData = sentences.map((item, index) => ({
      material_id: material.id,
      sentence_index: index,
      text: item.text,
      start_time: item.start_time,
      end_time: item.end_time,
    }));

    const { error: sentencesError } = await supabase
      .from('sentences')
      .insert(sentencesData);

    if (sentencesError) {
      throw new Error(sentencesError.message);
    }

    res.json({
      success: true,
      material: {
        ...material,
        audio_url: audioUrl, // 返回临时 URL 供前端使用
        sentences_count: sentences.length,
      },
    });
  } catch (error) {
    console.error('上传材料失败:', error);
    res.status(500).json({ error: '上传材料失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/materials
 * 获取材料列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    
    const { data: materials, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // 获取每个材料的句子数量和学习进度
    const materialsWithProgress = await Promise.all(
      (materials || []).map(async (material) => {
        // 获取句子数量
        const { count: sentencesCount } = await supabase
          .from('sentences')
          .select('*', { count: 'exact', head: true })
          .eq('material_id', material.id);

        // 获取已完成句子数量
        const { data: completedRecords } = await supabase
          .from('learning_records')
          .select('id')
          .eq('is_completed', true)
          .in('sentence_id', 
            (await supabase
              .from('sentences')
              .select('id')
              .eq('material_id', material.id)
            ).data?.map(s => s.id) || []
          );

        // 生成音频 URL
        const audioUrl = material.audio_url ? 
          await storage.generatePresignedUrl({
            key: material.audio_url,
            expireTime: 86400,
          }) : null;

        return {
          ...material,
          audio_url: audioUrl,
          sentences_count: sentencesCount || 0,
          completed_count: completedRecords?.length || 0,
        };
      })
    );

    res.json({ materials: materialsWithProgress });
  } catch (error) {
    console.error('获取材料列表失败:', error);
    res.status(500).json({ error: '获取材料列表失败' });
  }
});

/**
 * GET /api/v1/materials/:id
 * 获取单个材料详情（包含句子和学习记录）
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    // 获取句子
    const { data: sentences, error: sentencesError } = await supabase
      .from('sentences')
      .select('*')
      .eq('material_id', id)
      .order('sentence_index', { ascending: true });

    if (sentencesError) {
      throw new Error(sentencesError.message);
    }

    // 获取学习记录
    const sentenceIds = sentences?.map(s => s.id) || [];
    const { data: learningRecords } = await supabase
      .from('learning_records')
      .select('*')
      .in('sentence_id', sentenceIds);

    // 合并句子和学习记录
    const sentencesWithRecords = sentences?.map(sentence => {
      const record = learningRecords?.find(r => r.sentence_id === sentence.id);
      return {
        ...sentence,
        attempts: record?.attempts || 0,
        is_completed: record?.is_completed || false,
        completed_at: record?.completed_at || null,
      };
    });

    // 生成音频 URL
    const audioUrl = material.audio_url ?
      await storage.generatePresignedUrl({
        key: material.audio_url,
        expireTime: 86400,
      }) : null;

    res.json({
      material: {
        ...material,
        audio_url: audioUrl,
      },
      sentences: sentencesWithRecords,
    });
  } catch (error) {
    console.error('获取材料详情失败:', error);
    res.status(500).json({ error: '获取材料详情失败' });
  }
});

/**
 * POST /api/v1/materials/:id/extract-text
 * 获取音频的ASR文本（用户手动触发）
 */
router.post('/:id/extract-text', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    // 检查是否已有文本
    if (material.full_text && material.full_text.length > 0) {
      return res.json({ 
        text: material.full_text,
        message: '已存在文本' 
      });
    }

    // 生成签名 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: material.audio_url,
      expireTime: 86400,
    });

    console.log(`\n===== 开始 ASR 识别 =====`);
    console.log('材料 ID:', id);
    console.log('音频 URL:', audioUrl.substring(0, 100));

    // 调用 ASR
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
      lang: 'en', // 固定识别为英语
    } as any);

    // 提取完整文本
    const fullText = asrResult.text || asrResult.rawData?.text || '';
    
    // 提取时长 - ASR 返回的可能是秒或毫秒
    // 如果大于 1000，认为是毫秒；否则认为是秒
    let rawDuration = asrResult.duration || asrResult.rawData?.audio_info?.duration || 0;
    let durationMs: number;
    if (rawDuration > 1000) {
      durationMs = rawDuration;
    } else {
      durationMs = rawDuration * 1000;
    }

    console.log(`ASR 完成: 文本长度=${fullText.length}, 时长=${durationMs}ms (${durationMs / 1000}s)`);

    // 更新材料
    await supabase
      .from('materials')
      .update({ 
        full_text: fullText,
        duration: durationMs,
      })
      .eq('id', id);

    res.json({ 
      text: fullText,
      duration: durationMs,
      message: '文本提取成功' 
    });
  } catch (error) {
    console.error('提取文本失败:', error);
    res.status(500).json({ error: '提取文本失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/:id/add-punctuation
 * 使用 LLM 为没有标点的文本添加标点
 * Body: { text?: string } - 可选，不传则使用材料中的 full_text
 */
router.post('/:id/add-punctuation', express.json(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const supabase = getSupabaseClient();
    
    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    const inputText = text || material.full_text || '';
    
    if (!inputText || inputText.length < 10) {
      return res.status(400).json({ error: '文本太短，无法添加标点' });
    }

    console.log(`[添加标点] 材料 ${id}, 文本长度: ${inputText.length}`);

    // 使用 LLM 添加标点
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const llmClient = new LLMClient(new Config(), customHeaders);
    
    const punctResponse = await llmClient.invoke([
      {
        role: 'system',
        content: `You are a text punctuation assistant for English learning materials. 
Add proper punctuation to the English text following these rules:
1. Add periods (.) at the end of statements
2. Add question marks (?) at the end of questions
3. Add exclamation marks (!) for exclamations
4. Add commas (,) where needed for natural pauses
5. Do NOT change, add, or remove any words
6. Keep the original text exactly as is, only add punctuation marks
7. Return ONLY the punctuated text without any explanation or formatting`
      },
      {
        role: 'user',
        content: `Add punctuation to this English text. Keep all words exactly as they are:\n\n${inputText}`
      }
    ], { temperature: 0.3, model: 'doubao-seed-1-6-lite-251015' });

    const punctuatedText = punctResponse.content.trim();
    console.log(`[添加标点] 完成: ${punctuatedText.substring(0, 100)}...`);

    // 更新材料
    await supabase
      .from('materials')
      .update({ full_text: punctuatedText })
      .eq('id', id);

    res.json({ 
      success: true, 
      text: punctuatedText,
      message: '标点添加成功' 
    });
  } catch (error) {
    console.error('添加标点失败:', error);
    res.status(500).json({ error: '添加标点失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/:id/save-sentences
 * 保存用户手动切分的句子
 * Body: { sentences: string[] }
 */
router.post('/:id/save-sentences', express.json(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sentences } = req.body;

    console.log(`[保存句子] 材料 ${id}, 句子数量: ${sentences?.length || 0}`);

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      console.log(`[保存句子] 无效的句子数据:`, req.body);
      return res.status(400).json({ error: '请提供有效的句子数组' });
    }

    const supabase = getSupabaseClient();
    
    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    // 删除现有句子
    await supabase.from('sentences').delete().eq('material_id', id);

    // 获取 ASR 单词级时间戳（用于精确匹配）
    let wordsWithTime: WordWithTime[] = [];
    let asrFullText = '';
    let audioDuration = material.duration || 0;

    if (material.audio_url) {
      try {
        console.log(`[保存句子] 获取 ASR 时间戳用于精确匹配...`);
        
        // 生成签名 URL
        const audioUrl = await storage.generatePresignedUrl({
          key: material.audio_url,
          expireTime: 86400,
        });

        // 调用 ASR
        const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
        const asrClient = new ASRClient(new Config(), customHeaders);
        
        const asrResult = await asrClient.recognize({
          uid: 'user',
          url: audioUrl,
          lang: 'en',
        } as any);

        // 提取单词时间戳
        wordsWithTime = extractWordsWithTimestamps(asrResult);
        asrFullText = asrResult.text || asrResult.rawData?.text || '';
        
        // 提取总时长
        const rawDuration = asrResult.duration || asrResult.rawData?.audio_info?.duration || 0;
        if (rawDuration > 0) {
          audioDuration = rawDuration > 1000 ? rawDuration : rawDuration * 1000;
        }
        
        console.log(`[保存句子] ASR 返回 ${wordsWithTime.length} 个单词时间戳，总时长 ${audioDuration}ms`);
      } catch (asrError) {
        console.error('[保存句子] ASR 调用失败，使用字符比例估算:', asrError);
        // 继续使用字符比例估算
      }
    }

    // 为每个句子计算时间戳（使用智能匹配函数）
    const sentencesData: Array<{
      material_id: number;
      sentence_index: number;
      text: string;
      start_time: number;
      end_time: number;
    }> = [];

    console.log(`[保存句子] 使用智能时间戳匹配 (${wordsWithTime.length > 0 ? 'ASR时间戳优先' : '文本位置估算'})`);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentenceText = sentences[i].trim();
      const matchResult = matchSentenceToTimestamps(
        sentenceText,
        wordsWithTime,
        asrFullText,
        audioDuration
      );
      
      sentencesData.push({
        material_id: parseInt(id as string),
        sentence_index: i,
        text: sentenceText,
        start_time: matchResult.start_time,
        end_time: matchResult.end_time,
      });
      
      console.log(`[保存句子] 句子 ${i}: "${sentenceText.substring(0, 30)}..." ${matchResult.start_time}ms - ${matchResult.end_time}ms (${matchResult.method})`);
    }

    const { error: insertError } = await supabase
      .from('sentences')
      .insert(sentencesData);

    if (insertError) {
      throw new Error(insertError.message);
    }

    console.log(`保存 ${sentences.length} 个句子到材料 ${id}`);

    res.json({ 
      success: true, 
      count: sentences.length,
      message: '句子保存成功',
      matchMethod: wordsWithTime.length > 0 ? 'asr-timestamps' : (asrFullText ? 'text-position' : 'char-ratio')
    });
  } catch (error) {
    console.error('保存句子失败:', error);
    res.status(500).json({ error: '保存句子失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/:id/word-timestamps
 * 获取音频的单词级时间戳（用于自动匹配句子位置）
 */
router.post('/:id/word-timestamps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    // 生成签名 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: material.audio_url,
      expireTime: 86400,
    });

    console.log(`\n===== 获取单词级时间戳 =====`);
    console.log('材料 ID:', id);

    // 调用 ASR 获取详细时间戳
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
      lang: 'en', // 固定识别为英语
    } as any);

    // 提取单词级时间戳
    const words = extractWordsWithTimestamps(asrResult);
    
    // 同时提取完整文本
    const fullText = asrResult.text || asrResult.rawData?.text || '';
    
    // 提取总时长
    const duration = asrResult.duration || asrResult.rawData?.audio_info?.duration || 0;
    const durationMs = duration * 1000;

    console.log(`提取到 ${words.length} 个单词，总时长 ${durationMs}ms`);
    console.log('========== 提取结束 ==========\n');

    res.json({ 
      words,
      fullText,
      duration: durationMs,
    });
  } catch (error) {
    console.error('获取单词时间戳失败:', error);
    res.status(500).json({ error: '获取单词时间戳失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/:id/match-sentence
 * 根据句子文本自动匹配音频中的位置
 * Body: { sentenceText: string, words: WordWithTime[] (可选，如果不传则自动获取) }
 */
router.post('/:id/match-sentence', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sentenceText, words: providedWords } = req.body;

    if (!sentenceText) {
      return res.status(400).json({ error: '请提供句子文本' });
    }

    console.log(`\n===== 匹配句子位置 =====`);
    console.log('句子:', sentenceText);

    // 获取材料信息
    const supabase = getSupabaseClient();
    const { data: material } = await supabase
      .from('materials')
      .select('audio_url, duration')
      .eq('id', id)
      .single();

    if (!material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    // 获取音频 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: material.audio_url,
      expireTime: 86400,
    });

    // 获取单词列表（优先使用传入的，否则重新获取）
    let words = providedWords;
    let audioDuration = material.duration || 0;
    let fullText = '';
    
    // 首先尝试用 ffmpeg 获取真实的音频时长
    try {
      const ffprobeResult = await execAsync(
        `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioUrl}"`,
        { timeout: 10000 }
      );
      const probedDuration = parseFloat(ffprobeResult.stdout.trim());
      if (probedDuration > 0) {
        audioDuration = Math.round(probedDuration * 1000);
        console.log(`FFprobe 获取到的实际时长: ${audioDuration}ms`);
        
        // 如果数据库中的时长与实际差异超过 10%，更新数据库
        if (material.duration && Math.abs(material.duration - audioDuration) > audioDuration * 0.1) {
          console.log(`更新数据库中的 duration: ${material.duration}ms -> ${audioDuration}ms`);
          await supabase
            .from('materials')
            .update({ duration: audioDuration })
            .eq('id', id);
        }
      }
    } catch (e) {
      console.log('FFprobe 获取时长失败，使用数据库值:', (e as Error).message);
    }
    
    if (!words || words.length === 0) {
      const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
      const asrClient = new ASRClient(new Config(), customHeaders);
      
      try {
        const asrResult = await asrClient.recognize({
          uid: 'user',
          url: audioUrl,
          lang: 'en', // 固定识别为英语
        } as any);

        words = extractWordsWithTimestamps(asrResult);
        fullText = asrResult.text || asrResult.rawData?.result?.text || '';
        
        // 如果 ASR 返回了时长，优先使用
        if (asrResult.duration) {
          audioDuration = asrResult.duration * 1000;
        }
        
        console.log(`ASR 返回: ${words.length} 个单词, 总时长 ${audioDuration}ms`);
      } catch (asrError: any) {
        console.log('ASR 调用失败:', asrError.message);
        words = [];
      }
    }

    // 提取句子的单词
    const sentenceWords = sentenceText.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w: string) => w.length > 0);
    
    let startTime = 0;
    let endTime = 0;
    let matched = false;
    let matchMethod = 'none';

    // 方案1: 使用单词时间戳精确匹配
    if (words && words.length > 0) {
      console.log('使用单词时间戳精确匹配');
      
      const firstWords = sentenceWords.slice(0, 3);
      const lastWords = sentenceWords.slice(-3);
      
      const lowerWords = words.map((w: WordWithTime) => ({ 
        ...w, 
        wordLower: w.word.toLowerCase().replace(/[.,!?;:'"]/g, '') 
      }));

      // 查找前3个单词的起始位置
      let startMatch = { index: -1, confidence: 0 };
      for (let i = 0; i <= lowerWords.length - firstWords.length; i++) {
        const slice = lowerWords.slice(i, i + firstWords.length);
        const matchCount = slice.filter((w: { wordLower: string }, idx: number) => 
          w.wordLower === firstWords[idx] || 
          w.wordLower.includes(firstWords[idx]) ||
          firstWords[idx].includes(w.wordLower)
        ).length;
        
        const confidence = matchCount / firstWords.length;
        if (confidence > startMatch.confidence && confidence >= 0.5) {
          startMatch = { index: i, confidence };
        }
      }

      // 查找后3个单词的结束位置
      let endMatch = { index: -1, confidence: 0 };
      for (let i = firstWords.length; i <= lowerWords.length; i++) {
        const slice = lowerWords.slice(i - lastWords.length, i);
        const matchCount = slice.filter((w: { wordLower: string }, idx: number) => 
          w.wordLower === lastWords[idx] || 
          w.wordLower.includes(lastWords[idx]) ||
          lastWords[idx].includes(w.wordLower)
        ).length;
        
        const confidence = matchCount / lastWords.length;
        if (confidence > endMatch.confidence && confidence >= 0.5) {
          endMatch = { index: i, confidence };
        }
      }

      if (startMatch.index >= 0 && endMatch.index > startMatch.index) {
        startTime = lowerWords[startMatch.index].start_time;
        endTime = lowerWords[endMatch.index - 1].end_time;
        matched = true;
        matchMethod = 'word_timestamps';
        console.log(`精确匹配成功: 索引 ${startMatch.index} 到 ${endMatch.index - 1}`);
      }
    }

    // 方案2: 基于文本位置估算（当精确匹配失败或没有时间戳时）
    if (!matched && audioDuration > 0 && fullText) {
      console.log('使用文本位置估算');
      
      // 清理全文和句子文本
      const cleanFullText = fullText.toLowerCase().replace(/[^\w\s]/g, ' ');
      const cleanSentence = sentenceText.toLowerCase().replace(/[^\w\s]/g, ' ');
      
      // 在全文中查找句子的位置
      const fullTextWords = cleanFullText.split(/\s+/).filter((w: string) => w.length > 0);
      const sentenceWordList = cleanSentence.split(/\s+/).filter((w: string) => w.length > 0);
      
      if (sentenceWordList.length > 0 && fullTextWords.length > 0) {
        // 尝试找到句子在全文中的位置
        let foundIndex = -1;
        const firstSentenceWord = sentenceWordList[0];
        
        // 找到第一个单词出现的位置
        for (let i = 0; i <= fullTextWords.length - sentenceWordList.length; i++) {
          if (fullTextWords[i] === firstSentenceWord) {
            // 检查后续单词是否匹配
            let matchCount = 0;
            for (let j = 0; j < Math.min(sentenceWordList.length, 5); j++) {
              if (fullTextWords[i + j] === sentenceWordList[j]) {
                matchCount++;
              }
            }
            if (matchCount >= Math.min(sentenceWordList.length, 3)) {
              foundIndex = i;
              break;
            }
          }
        }
        
        if (foundIndex >= 0) {
          // 计算时间比例
          const startRatio = foundIndex / fullTextWords.length;
          const endRatio = Math.min((foundIndex + sentenceWordList.length) / fullTextWords.length, 1);
          
          // 添加一些缓冲（前后各留5%的余量）
          const bufferTime = audioDuration * 0.02;
          startTime = Math.round(startRatio * audioDuration) + bufferTime;
          endTime = Math.round(endRatio * audioDuration) - bufferTime;
          
          matched = true;
          matchMethod = 'text_position_estimate';
          console.log(`文本位置估算成功: 单词位置 ${foundIndex} 到 ${foundIndex + sentenceWordList.length}`);
        }
      }
    }

    // 方案3: 基于句子长度和音频时长的简单估算（最后的备选）
    if (!matched && audioDuration > 0) {
      console.log('使用简单时长估算');
      
      // 获取该材料的所有句子，计算总字符数
      const { data: allSentences } = await supabase
        .from('sentences')
        .select('text')
        .eq('material_id', id)
        .order('sentence_index', { ascending: true });
      
      if (allSentences && allSentences.length > 0) {
        const totalChars = allSentences.reduce((sum: number, s: any) => sum + s.text.length, 0);
        const sentenceChars = sentenceText.length;
        
        // 找到当前句子在列表中的位置
        let charOffset = 0;
        for (const s of allSentences) {
          if (s.text === sentenceText) break;
          charOffset += s.text.length;
        }
        
        const startRatio = charOffset / totalChars;
        const endRatio = (charOffset + sentenceChars) / totalChars;
        
        startTime = Math.round(startRatio * audioDuration);
        endTime = Math.round(endRatio * audioDuration);
        matched = true;
        matchMethod = 'char_ratio_estimate';
        console.log(`简单时长估算成功: 字符位置 ${charOffset} 到 ${charOffset + sentenceChars}`);
      }
    }

    console.log(`结果: 开始=${Math.round(startTime)}ms, 结束=${Math.round(endTime)}ms, 方法=${matchMethod}`);
    console.log('========== 匹配结束 ==========\n');

    res.json({
      matched,
      start_time: Math.round(startTime),
      end_time: Math.round(endTime),
      method: matchMethod,
      word_count: sentenceWords.length,
      audio_duration: audioDuration,
    });
  } catch (error) {
    console.error('匹配句子位置失败:', error);
    res.status(500).json({ error: '匹配句子位置失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/materials/:id/detect-speech-start
 * 检测语音真正的开始位置（去掉前面静音部分）
 * Body: { from_time?: number } 从哪个时间点开始检测（毫秒）
 */
router.post('/:id/detect-speech-start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from_time = 0 } = req.body;
    
    const supabase = getSupabaseClient();
    
    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    // 生成签名 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: material.audio_url,
      expireTime: 86400,
    });

    console.log(`\n===== 检测语音开始位置 =====`);
    console.log('材料 ID:', id);
    console.log('从时间点:', from_time, 'ms');

    // 下载音频文件到临时目录
    const tempAudioPath = `/tmp/audio_${Date.now()}.mp4`;
    
    const audioResponse = await fetch(audioUrl);
    const arrayBuffer = await audioResponse.arrayBuffer();
    const fs = await import('fs');
    fs.writeFileSync(tempAudioPath, Buffer.from(arrayBuffer));
    
    console.log('音频已下载到:', tempAudioPath);

    // 使用 ffmpeg 检测静音，找到第一个非静音点
    // silencedetect 参数：
    // - noise: 静音阈值（-30dB 以下视为静音）
    // - d: 最小静音持续时间（0.1秒）
    const { stdout, stderr } = await execAsync(
      `ffmpeg -i "${tempAudioPath}" -af "silencedetect=noise=-30dB:d=0.1" -f null - 2>&1`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    
    // 清理临时文件
    fs.unlinkSync(tempAudioPath);
    
    const output = stdout + stderr;
    
    // 解析静音检测结果
    // 格式: silence_start: 1.23
    //       silence_end: 2.45
    const silenceStarts: number[] = [];
    const silenceEnds: number[] = [];
    
    const startRegex = /silence_start:\s*([\d.]+)/g;
    const endRegex = /silence_end:\s*([\d.]+)/g;
    
    let match;
    while ((match = startRegex.exec(output)) !== null) {
      silenceStarts.push(parseFloat(match[1]));
    }
    while ((match = endRegex.exec(output)) !== null) {
      silenceEnds.push(parseFloat(match[1]));
    }
    
    console.log('静音开始点:', silenceStarts);
    console.log('静音结束点:', silenceEnds);
    
    // 从 from_time 开始，找到第一个非静音点
    const fromTimeSec = from_time / 1000;
    let speechStart = fromTimeSec; // 默认从 from_time 开始
    
    // 如果第一个静音段在 from_time 之后，那么语音开始就是静音结束点
    if (silenceEnds.length > 0) {
      for (const endTime of silenceEnds) {
        if (endTime >= fromTimeSec) {
          speechStart = endTime;
          break;
        }
      }
    }
    
    // 转换为毫秒
    const speechStartMs = Math.round(speechStart * 1000);
    
    console.log(`检测到语音开始位置: ${speechStartMs}ms`);
    console.log('========== 检测结束 ==========\n');

    res.json({ 
      speech_start: speechStartMs,
      silence_starts: silenceStarts.map(s => Math.round(s * 1000)),
      silence_ends: silenceEnds.map(s => Math.round(s * 1000)),
    });
  } catch (error) {
    console.error('检测语音开始失败:', error);
    res.status(500).json({ error: '检测语音开始失败', message: (error as Error).message });
  }
});

/**
 * DELETE /api/v1/materials/:id
 * 删除材料
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    // 获取材料以获取文件 key
    const { data: material } = await supabase
      .from('materials')
      .select('audio_url')
      .eq('id', id)
      .single();

    // 删除数据库记录（级联删除句子和学习记录）
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    // 删除对象存储中的文件
    if (material?.audio_url) {
      try {
        await storage.deleteFile({ fileKey: material.audio_url });
      } catch (e) {
        console.warn('删除存储文件失败:', e);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除材料失败:', error);
    res.status(500).json({ error: '删除材料失败' });
  }
});

/**
 * 处理 ASR 结果，提取带时间戳的句子
 * 核心原则：先按文字分割，再匹配语音时间
 */
interface SentenceWithTime {
  text: string;
  start_time: number;
  end_time: number;
}

interface WordWithTime {
  word: string;
  start_time: number;
  end_time: number;
}

interface SilenceSegment {
  start: number;  // 静音开始时间（秒）
  end: number;    // 静音结束时间（秒）
}

/**
 * 使用 ffmpeg 检测音频中的静音段落
 * 静音段落通常对应句子的停顿，可以用来辅助分割句子
 */
async function detectSilenceSegments(audioUrl: string, minSilenceDuration: number = 0.3): Promise<SilenceSegment[]> {
  console.log('\n===== 静音检测开始 =====');
  console.log('音频 URL:', audioUrl.substring(0, 100));
  
  try {
    // 使用 ffmpeg silencedetect 滤镜检测静音
    // -noise_threshold: 噪声阈值（dB），低于此值视为静音
    // -d: 最小静音持续时间（秒）
    const { stdout, stderr } = await execAsync(
      `ffmpeg -i "${audioUrl}" -af "silencedetect=noise=-30dB:d=${minSilenceDuration}" -f null - 2>&1`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );
    
    const output = stdout + stderr;
    const silenceSegments: SilenceSegment[] = [];
    
    // 解析 ffmpeg 输出
    // 格式: [silencedetect @ ...] silence_start: 1.23
    // [silencedetect @ ...] silence_end: 1.45 | silence_duration: 0.22
    let currentStart: number | null = null;
    
    const lines = output.split('\n');
    for (const line of lines) {
      const startMatch = line.match(/silence_start:\s*([\d.]+)/);
      const endMatch = line.match(/silence_end:\s*([\d.]+)/);
      
      if (startMatch) {
        currentStart = parseFloat(startMatch[1]);
      } else if (endMatch && currentStart !== null) {
        const end = parseFloat(endMatch[1]);
        silenceSegments.push({ start: currentStart, end });
        currentStart = null;
      }
    }
    
    console.log(`检测到 ${silenceSegments.length} 个静音段落`);
    silenceSegments.forEach((seg, i) => {
      console.log(`  静音 ${i}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (时长: ${(seg.end - seg.start).toFixed(2)}s)`);
    });
    console.log('===== 静音检测结束 =====\n');
    
    return silenceSegments;
  } catch (error) {
    console.error('静音检测失败:', error);
    return [];
  }
}

function processASRResultWithSilence(
  asrResult: { text: string; duration?: number; utterances?: any[]; rawData?: any },
  audioUrl?: string
): Promise<SentenceWithTime[]> {
  return processASRResultWithSilenceAsync(asrResult, audioUrl);
}

/**
 * 异步处理 ASR 结果，使用静音检测辅助时间戳分配
 */
async function processASRResultWithSilenceAsync(
  asrResult: { text: string; duration?: number; utterances?: any[]; rawData?: any },
  audioUrl?: string
): Promise<SentenceWithTime[]> {
  const result: SentenceWithTime[] = [];

  console.log('\n========== ASR 处理开始（静音检测辅助）==========');
  console.log('顶层字段:', Object.keys(asrResult));
  console.log('完整文本:', asrResult.text?.substring(0, 200));
  console.log('顶层 duration:', asrResult.duration);
  console.log('音频 URL:', audioUrl || '无');
  console.log('rawData.audio_info:', JSON.stringify(asrResult.rawData?.audio_info));

  // 步骤1：提取所有带时间戳的单词
  const wordsWithTime: WordWithTime[] = extractWordsWithTimestamps(asrResult);
  
  console.log(`\n提取到 ${wordsWithTime.length} 个带时间戳的单词`);

  // 步骤2：正确提取总时长（优先从 rawData.audio_info.duration 获取）
  const totalDuration = asrResult.duration || 
                        asrResult.rawData?.audio_info?.duration || 
                        asrResult.rawData?.duration || 
                        0;
  const totalDurationMs = totalDuration * 1000; // 转换为毫秒
  console.log('总时长 (ms):', totalDurationMs);

  // 步骤3：按文字内容分割句子
  const fullText = asrResult.text || asrResult.rawData?.result?.text || '';
  const sentenceTexts = splitIntoSentences(fullText);
  console.log(`\n按文字分割为 ${sentenceTexts.length} 个句子`);

  if (wordsWithTime.length > 0) {
    // 有单词级别的时间戳，精确匹配
    let wordIndex = 0;
    
    for (const sentenceText of sentenceTexts) {
      const sentenceWords = sentenceText.split(/\s+/).filter(w => w.length > 0);
      const sentenceWordCount = sentenceWords.length;
      
      const startIdx = wordIndex;
      const endIdx = Math.min(wordIndex + sentenceWordCount, wordsWithTime.length);
      
      if (startIdx < wordsWithTime.length) {
        const startTime = wordsWithTime[startIdx].start_time;
        const endTime = wordsWithTime[Math.max(0, endIdx - 1)].end_time;
        
        result.push({
          text: sentenceText,
          start_time: Math.round(startTime),
          end_time: Math.round(endTime),
        });
        
        console.log(`句子: "${sentenceText.substring(0, 30)}..." ${startTime}ms - ${endTime}ms`);
      }
      
      wordIndex = endIdx;
    }
  } else if (totalDurationMs > 0) {
    // 没有时间戳数据，但有总时长
    console.log('\n使用静音检测辅助的时间分配算法');
    
    // 步骤4：静音检测（如果有音频 URL）
    let silenceSegments: SilenceSegment[] = [];
    
    if (audioUrl) {
      try {
        silenceSegments = await detectSilenceSegments(audioUrl, 0.3);
        console.log(`检测到 ${silenceSegments.length} 个静音段`);
      } catch (err) {
        console.log('静音检测失败，使用默认算法:', err);
      }
    }
    
    // 策略：基于字符数估算时长，结合静音段调整边界
    const charCounts = sentenceTexts.map(s => s.length);
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    
    // 基础时长分配（按字符比例）
    const avgCharDuration = totalDurationMs / totalChars;
    console.log(`总字符数: ${totalChars}, 平均每字符: ${avgCharDuration.toFixed(0)}ms`);
    
    let currentTime = 0;
    
    for (let i = 0; i < sentenceTexts.length; i++) {
      const sentenceText = sentenceTexts[i];
      const charCount = charCounts[i];
      
      // 基于字符数估算基础时长
      let baseDuration = charCount * avgCharDuration;
      
      // 查找当前时间点附近的静音段
      const expectedEndTime = (currentTime + baseDuration) / 1000; // 转换为秒
      
      // 找到最近的静音段（在预期的结束时间附近 ±0.5 秒）
      const nearbySilence = silenceSegments.find(seg => 
        seg.start >= expectedEndTime - 0.5 && 
        seg.start <= expectedEndTime + 0.5
      );
      
      let startTime = currentTime;
      let endTime: number;
      
      if (nearbySilence) {
        // 如果找到静音段，将句子结束时间设在静音开始前
        endTime = nearbySilence.start * 1000 - 50; // 提前 50ms
        console.log(`句子 ${i + 1} 使用静音段调整: 结束时间 ${endTime.toFixed(0)}ms`);
      } else {
        // 没有静音段，使用基础估算
        endTime = currentTime + baseDuration;
        console.log(`句子 ${i + 1} 使用估算: ${startTime.toFixed(0)}-${endTime.toFixed(0)}ms`);
      }
      
      // 确保不超过总时长
      if (endTime > totalDurationMs - 100) {
        endTime = totalDurationMs - 100;
      }
      
      result.push({
        text: sentenceText,
        start_time: Math.max(0, startTime),
        end_time: Math.max(startTime + 100, endTime), // 至少 100ms
      });
      
      // 更新当前时间（加入句间停顿）
      currentTime = endTime + 150; // 假设句间停顿 150ms
    }
    
    // 调整最后一句的结束时间，确保覆盖到音频末尾
    if (result.length > 0) {
      result[result.length - 1].end_time = totalDurationMs - 50;
    }
  } else {
    // 最后兜底：每个句子默认2秒
    console.log('警告：无法计算时间，使用默认2秒/句');
    let currentTime = 0;
    
    for (const sentenceText of sentenceTexts) {
      const duration = 2000;
      result.push({
        text: sentenceText,
        start_time: currentTime,
        end_time: currentTime + duration,
      });
      currentTime += duration;
    }
  }

  console.log(`\n最终生成 ${result.length} 个句子:`);
  result.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.start_time.toFixed(0)}-${s.end_time.toFixed(0)}ms] "${s.text.substring(0, 30)}..."`);
  });
  console.log('========== ASR 处理结束 ==========\n');
  return result;
}

/**
 * 智能匹配句子到时间戳
 * 使用多种策略：单词时间戳精确匹配、文本位置估算、字符比例估算
 */
function matchSentenceToTimestamps(
  sentenceText: string,
  wordsWithTime: WordWithTime[],
  fullText: string,
  audioDuration: number
): { start_time: number; end_time: number; method: string } {
  console.log(`\n----- 匹配句子: "${sentenceText.substring(0, 30)}..." -----`);
  
  let startTime = 0;
  let endTime = 0;
  let matched = false;
  let method = 'none';

  // 提取句子的单词
  const sentenceWords = sentenceText.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);

  // 策略1: 使用单词时间戳精确匹配
  if (wordsWithTime && wordsWithTime.length > 0) {
    console.log(`尝试单词时间戳精确匹配，共 ${wordsWithTime.length} 个单词时间戳`);
    
    const firstWords = sentenceWords.slice(0, Math.min(3, sentenceWords.length));
    const lastWords = sentenceWords.slice(-Math.min(3, sentenceWords.length));
    
    const lowerWords = wordsWithTime.map(w => ({ 
      ...w, 
      wordLower: w.word.toLowerCase().replace(/[.,!?;:'"]/g, '') 
    }));

    // 查找前几个单词的起始位置
    let startMatch = { index: -1, confidence: 0 };
    for (let i = 0; i <= lowerWords.length - firstWords.length; i++) {
      const slice = lowerWords.slice(i, i + firstWords.length);
      const matchCount = slice.filter((w, idx) => 
        w.wordLower === firstWords[idx] || 
        w.wordLower.includes(firstWords[idx]) ||
        firstWords[idx].includes(w.wordLower)
      ).length;
      
      const confidence = matchCount / firstWords.length;
      if (confidence > startMatch.confidence && confidence >= 0.5) {
        startMatch = { index: i, confidence };
      }
    }

    // 查找后几个单词的结束位置
    let endMatch = { index: -1, confidence: 0 };
    for (let i = firstWords.length; i <= lowerWords.length; i++) {
      const slice = lowerWords.slice(i - lastWords.length, i);
      const matchCount = slice.filter((w, idx) => 
        w.wordLower === lastWords[idx] || 
        w.wordLower.includes(lastWords[idx]) ||
        lastWords[idx].includes(w.wordLower)
      ).length;
      
      const confidence = matchCount / lastWords.length;
      if (confidence > endMatch.confidence && confidence >= 0.5) {
        endMatch = { index: i, confidence };
      }
    }

    if (startMatch.index >= 0 && endMatch.index > startMatch.index) {
      startTime = lowerWords[startMatch.index].start_time;
      endTime = lowerWords[endMatch.index - 1].end_time;
      matched = true;
      method = 'word_timestamps';
      console.log(`单词时间戳匹配成功: 索引 ${startMatch.index} 到 ${endMatch.index - 1}, 时间 ${startTime}-${endTime}ms`);
    }
  }

  // 策略2: 基于文本位置估算
  if (!matched && audioDuration > 0 && fullText) {
    console.log('尝试文本位置估算');
    
    const cleanFullText = fullText.toLowerCase().replace(/[^\w\s]/g, ' ');
    const cleanSentence = sentenceText.toLowerCase().replace(/[^\w\s]/g, ' ');
    
    const fullTextWords = cleanFullText.split(/\s+/).filter(w => w.length > 0);
    const sentenceWordList = cleanSentence.split(/\s+/).filter(w => w.length > 0);
    
    if (sentenceWordList.length > 0 && fullTextWords.length > 0) {
      // 找到句子在全文中的位置
      let foundIndex = -1;
      const firstSentenceWord = sentenceWordList[0];
      
      for (let i = 0; i <= fullTextWords.length - sentenceWordList.length; i++) {
        if (fullTextWords[i] === firstSentenceWord) {
          let matchCount = 0;
          for (let j = 0; j < Math.min(sentenceWordList.length, 5); j++) {
            if (fullTextWords[i + j] === sentenceWordList[j]) {
              matchCount++;
            }
          }
          if (matchCount >= Math.min(sentenceWordList.length, 3)) {
            foundIndex = i;
            break;
          }
        }
      }
      
      if (foundIndex >= 0) {
        const startRatio = foundIndex / fullTextWords.length;
        const endRatio = Math.min((foundIndex + sentenceWordList.length) / fullTextWords.length, 1);
        
        const bufferTime = audioDuration * 0.02;
        startTime = Math.round(startRatio * audioDuration) + bufferTime;
        endTime = Math.round(endRatio * audioDuration) - bufferTime;
        
        matched = true;
        method = 'text_position_estimate';
        console.log(`文本位置估算成功: 单词位置 ${foundIndex}, 时间 ${startTime}-${endTime}ms`);
      }
    }
  }

  // 策略3: 基于字符比例估算（最后的备选）
  if (!matched && audioDuration > 0 && fullText) {
    console.log('使用字符比例估算');
    
    const charRatio = sentenceText.length / fullText.length;
    // 找到句子在全文中的字符位置
    const charIndex = fullText.indexOf(sentenceText.substring(0, 20));
    
    if (charIndex >= 0) {
      const startRatio = charIndex / fullText.length;
      const endRatio = (charIndex + sentenceText.length) / fullText.length;
      
      startTime = Math.round(startRatio * audioDuration);
      endTime = Math.round(endRatio * audioDuration);
      method = 'char_ratio_estimate';
      console.log(`字符比例估算: 位置 ${charIndex}, 时间 ${startTime}-${endTime}ms`);
    } else {
      // 完全无法匹配，按比例分配一个默认时长
      endTime = startTime + Math.max(2000, audioDuration * 0.1);
      method = 'default_estimate';
      console.log(`无法匹配，使用默认时长: ${startTime}-${endTime}ms`);
    }
  }

  // 确保时间戳有效
  if (endTime <= startTime) {
    endTime = startTime + 2000;
  }
  
  console.log(`----- 匹配结果: ${startTime}-${endTime}ms (${method}) -----\n`);
  
  return { start_time: Math.round(startTime), end_time: Math.round(endTime), method };
}

/**
 * 从 ASR 结果中提取带时间戳的单词
 */
function extractWordsWithTimestamps(asrResult: { text: string; duration?: number; utterances?: any[]; rawData?: any }): WordWithTime[] {
  const words: WordWithTime[] = [];
  
  // 尝试从多个可能的位置获取带时间戳的数据
  let utterances: any[] = [];
  
  console.log('\n===== extractWordsWithTimestamps 调试 =====');
  console.log('asrResult.utterances:', asrResult.utterances ? `exists, type=${typeof asrResult.utterances}, isArray=${Array.isArray(asrResult.utterances)}` : 'null/undefined');
  console.log('asrResult.rawData:', asrResult.rawData ? `exists, keys=${Object.keys(asrResult.rawData).join(', ')}` : 'null/undefined');
  
  // 打印 rawData 的所有键及其类型
  if (asrResult.rawData) {
    for (const key of Object.keys(asrResult.rawData)) {
      const value = (asrResult.rawData as any)[key];
      const type = typeof value;
      const isArray = Array.isArray(value);
      const length = isArray ? value.length : (type === 'object' ? Object.keys(value || {}).length : '-');
      console.log(`  rawData.${key}: type=${type}, isArray=${isArray}, length=${length}`);
    }
  }
  
  // 1. 检查顶层 utterances
  if (asrResult.utterances && Array.isArray(asrResult.utterances)) {
    utterances = asrResult.utterances;
    console.log('使用顶层 utterances，数量:', utterances.length);
  }
  // 2. 检查 rawData 中的 utterances
  else if (asrResult.rawData?.utterances && Array.isArray(asrResult.rawData.utterances)) {
    utterances = asrResult.rawData.utterances;
    console.log('使用 rawData.utterances，数量:', utterances.length);
  }
  // 3. 检查 rawData 中的 segments
  else if (asrResult.rawData?.segments && Array.isArray(asrResult.rawData.segments)) {
    utterances = asrResult.rawData.segments;
    console.log('使用 rawData.segments，数量:', utterances.length);
  }
  // 4. 检查 rawData.result 中的 utterances/segments
  else if (asrResult.rawData?.result) {
    const result = asrResult.rawData.result;
    console.log('rawData.result keys:', Object.keys(result).join(', '));
    
    if (result.utterances && Array.isArray(result.utterances)) {
      utterances = result.utterances;
      console.log('使用 rawData.result.utterances，数量:', utterances.length);
    } else if (result.segments && Array.isArray(result.segments)) {
      utterances = result.segments;
      console.log('使用 rawData.result.segments，数量:', utterances.length);
    }
  }
  
  // 打印第一个 utterance 的完整结构以便调试
  if (utterances.length > 0) {
    console.log('第一个 utterance 结构:', JSON.stringify(utterances[0], null, 2));
  }
  console.log('==========================================\n');

  // 检查是否有单词级别的时间戳
  // 有些 ASR 返回的 utterances 中每个元素就是一个单词
  // 有些则是在 utterance 内部有 words 数组
  
  for (const utterance of utterances) {
    // 尝试提取单词级别的时间戳
    if (utterance.words && Array.isArray(utterance.words)) {
      // utterance 内部有 words 数组
      for (const w of utterance.words) {
        const word = (w.word || w.text || '').trim();
        const startTime = w.start_time ?? w.startTime ?? w.start ?? 0;
        const endTime = w.end_time ?? w.endTime ?? w.end ?? 0;
        
        if (word && startTime < endTime) {
          words.push({ word, start_time: startTime, end_time: endTime });
        }
      }
    } else {
      // utterance 本身可能就是一个单词或短语
      const text = (utterance.text || utterance.word || '').trim();
      const startTime = utterance.start_time ?? utterance.startTime ?? utterance.start ?? 0;
      const endTime = utterance.end_time ?? utterance.endTime ?? utterance.end ?? 0;
      
      if (text) {
        // 判断这是一个单词还是多个单词
        const textWords = text.split(/\s+/).filter((w: string) => w.length > 0);
        
        if (textWords.length === 1 && startTime < endTime) {
          // 单个单词，直接添加
          words.push({ word: text, start_time: startTime, end_time: endTime });
        } else if (textWords.length > 1 && startTime < endTime) {
          // 多个单词，需要按比例分配时间
          const duration = endTime - startTime;
          const avgWordDuration = duration / textWords.length;
          
          for (let i = 0; i < textWords.length; i++) {
            words.push({
              word: textWords[i],
              start_time: startTime + i * avgWordDuration,
              end_time: startTime + (i + 1) * avgWordDuration,
            });
          }
        }
      }
    }
  }
  
  return words;
}

/**
 * 将文本分割成句子
 * 核心原则：严格按照标点符号分割，不强行切开句子
 */
function splitIntoSentences(text: string): string[] {
  console.log('\n===== splitIntoSentences 开始 =====');
  console.log('输入文本长度:', text.length);
  
  // 第一步：按主要句子结束标点分割（句号、问号、感叹号、换行）
  // 这些是自然的句子边界，应该严格遵守
  const sentenceDelimiters = /([。！？.!?\n]+)/g;
  const primarySplit = text
    .replace(sentenceDelimiters, '|||SENTENCE|||')
    .split('|||SENTENCE|||')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  console.log('第一轮分割（按句号/问号/感叹号）:', primarySplit.length, '段');
  
  const result: string[] = [];
  
  for (const segment of primarySplit) {
    if (!segment.trim()) continue;
    
    // 第二步：对于较长的段落，按逗号/分号分割
    // 但不强行切开，保持自然停顿
    const commaDelimiters = /([，,;；]+)/g;
    const commaSplit = segment
      .replace(commaDelimiters, '|||COMMA|||')
      .split('|||COMMA|||')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (commaSplit.length === 1) {
      // 没有逗号，整个段落就是一个句子
      result.push(segment.trim());
    } else {
      // 有逗号，按逗号分割成子句
      // 但要考虑合并短句，避免太碎片化
      const MIN_WORDS_TO_SPLIT = 3; // 少于3个词的子句尝试合并
      
      let currentClause: string[] = [];
      let currentWordCount = 0;
      
      for (const clause of commaSplit) {
        const clauseWords = clause.split(/\s+/).filter(w => w.length > 0).length;
        
        // 如果当前子句很短，且前面有内容，尝试合并
        if (clauseWords < MIN_WORDS_TO_SPLIT && currentClause.length > 0) {
          currentClause.push(clause);
          currentWordCount += clauseWords;
        } else {
          // 保存当前累积的内容
          if (currentClause.length > 0) {
            result.push(currentClause.join(', '));
          }
          currentClause = [clause];
          currentWordCount = clauseWords;
        }
      }
      
      // 保存最后一段
      if (currentClause.length > 0) {
        result.push(currentClause.join(', '));
      }
    }
  }
  
  // 过滤空字符串
  const finalResult = result.filter(s => s.trim().length > 0);
  
  console.log('最终分割结果:', finalResult.length, '句');
  console.log('句子列表:');
  finalResult.forEach((s, i) => {
    const words = s.split(/\s+/).filter(w => w.length > 0).length;
    console.log(`  ${i}: "${s.substring(0, 50)}${s.length > 50 ? '...' : ''}" (${words} 词)`);
  });
  console.log('=====================================\n');
  
  return finalResult;
}

// ============== 后台管理 API ==============

/**
 * PUT /api/v1/materials/:id/sentences/:sentenceId
 * 更新句子内容（文本、开始时间、结束时间）
 */
router.put('/:id/sentences/:sentenceId', express.json(), async (req: Request, res: Response) => {
  try {
    const { id, sentenceId } = req.params;
    const { text, start_time, end_time, sentence_index } = req.body;

    console.log(`[更新句子] sentenceId=${sentenceId}, start_time=${start_time}, end_time=${end_time}`);

    const supabase = getSupabaseClient();
    
    const updateData: Record<string, unknown> = {};
    if (text !== undefined) updateData.text = text;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (sentence_index !== undefined) updateData.sentence_index = sentence_index;

    const { error } = await supabase
      .from('sentences')
      .update(updateData)
      .eq('id', sentenceId)
      .eq('material_id', id);

    if (error) {
      console.error('[更新句子] 数据库错误:', error);
      return res.status(500).json({ error: '更新句子失败' });
    }

    console.log(`[更新句子] 成功: sentenceId=${sentenceId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('更新句子失败:', error);
    res.status(500).json({ error: '更新句子失败' });
  }
});

/**
 * DELETE /api/v1/materials/:id/sentences/:sentenceId
 * 删除句子
 */
router.delete('/:id/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { id, sentenceId } = req.params;
    const supabase = getSupabaseClient();

    // 删除句子
    const { error } = await supabase
      .from('sentences')
      .delete()
      .eq('id', sentenceId)
      .eq('material_id', id);

    if (error) {
      return res.status(500).json({ error: '删除句子失败' });
    }

    // 重新排序剩余句子的索引
    const { data: sentences } = await supabase
      .from('sentences')
      .select('id, sentence_index')
      .eq('material_id', id)
      .order('sentence_index', { ascending: true });

    if (sentences) {
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].sentence_index !== i) {
          await supabase
            .from('sentences')
            .update({ sentence_index: i })
            .eq('id', sentences[i].id);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除句子失败:', error);
    res.status(500).json({ error: '删除句子失败' });
  }
});

/**
 * POST /api/v1/materials/:id/sentences
 * 添加新句子
 */
router.post('/:id/sentences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, start_time, end_time, after_sentence_id } = req.body;

    if (!text) {
      return res.status(400).json({ error: '请提供句子文本' });
    }

    const supabase = getSupabaseClient();

    // 获取当前最大索引
    let insertIndex = 0;
    if (after_sentence_id) {
      // 在指定句子之后插入
      const { data: afterSentence } = await supabase
        .from('sentences')
        .select('sentence_index')
        .eq('id', after_sentence_id)
        .single();
      
      if (afterSentence) {
        insertIndex = afterSentence.sentence_index + 1;
        // 后面的句子索引都加1
        await supabase
          .from('sentences')
          .update({ sentence_index: supabase.rpc('increment', { x: 1 }) })
          .gte('sentence_index', insertIndex)
          .eq('material_id', id);
      }
    } else {
      // 添加到最后
      const { data: maxSentence } = await supabase
        .from('sentences')
        .select('sentence_index')
        .eq('material_id', id)
        .order('sentence_index', { ascending: false })
        .limit(1)
        .single();
      
      if (maxSentence) {
        insertIndex = maxSentence.sentence_index + 1;
      }
    }

    const { data: newSentence, error } = await supabase
      .from('sentences')
      .insert({
        material_id: parseInt(id as string),
        text,
        start_time: start_time || 0,
        end_time: end_time || 0,
        sentence_index: insertIndex,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: '添加句子失败' });
    }

    res.json({ success: true, sentence: newSentence });
  } catch (error) {
    console.error('添加句子失败:', error);
    res.status(500).json({ error: '添加句子失败' });
  }
});

/**
 * POST /api/v1/materials/:id/split-sentence/:sentenceId
 * 分割句子
 */
router.post('/:id/split-sentence/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { id, sentenceId } = req.params;
    const { split_position, new_start_time, new_end_time } = req.body;

    if (!split_position) {
      return res.status(400).json({ error: '请提供分割位置' });
    }

    const supabase = getSupabaseClient();

    // 获取原句子
    const { data: originalSentence, error: fetchError } = await supabase
      .from('sentences')
      .select('*')
      .eq('id', sentenceId)
      .eq('material_id', id)
      .single();

    if (fetchError || !originalSentence) {
      return res.status(404).json({ error: '句子不存在' });
    }

    const originalText = originalSentence.text;
    
    // 分割文本
    const textBefore = originalText.substring(0, split_position).trim();
    const textAfter = originalText.substring(split_position).trim();

    if (!textBefore || !textAfter) {
      return res.status(400).json({ error: '分割位置无效，无法产生有效文本' });
    }

    // 更新原句子
    const { error: updateError } = await supabase
      .from('sentences')
      .update({
        text: textBefore,
        end_time: new_start_time || originalSentence.end_time,
      })
      .eq('id', sentenceId);

    if (updateError) {
      return res.status(500).json({ error: '更新句子失败' });
    }

    // 后面的句子索引都加1
    const materialIdNum = parseInt(id as string);
    const { data: followingSentences } = await supabase
      .from('sentences')
      .select('id, sentence_index')
      .eq('material_id', materialIdNum)
      .gt('sentence_index', originalSentence.sentence_index)
      .order('sentence_index', { ascending: false }); // 从后往前更新避免冲突

    if (followingSentences) {
      for (const s of followingSentences) {
        await supabase
          .from('sentences')
          .update({ sentence_index: s.sentence_index + 1 })
          .eq('id', s.id);
      }
    }

    // 插入新句子
    const { data: newSentence, error: insertError } = await supabase
      .from('sentences')
      .insert({
        material_id: materialIdNum,
        text: textAfter,
        start_time: new_start_time || originalSentence.end_time,
        end_time: new_end_time || originalSentence.end_time,
        sentence_index: originalSentence.sentence_index + 1,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: '创建新句子失败' });
    }

    res.json({ 
      success: true, 
      sentences: [
        { ...originalSentence, text: textBefore },
        newSentence
      ]
    });
  } catch (error) {
    console.error('分割句子失败:', error);
    res.status(500).json({ error: '分割句子失败' });
  }
});

/**
 * POST /api/v1/materials/:id/reorder-sentences
 * 重新排序句子
 */
router.post('/:id/reorder-sentences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sentence_ids } = req.body; // 新顺序的句子ID数组

    if (!Array.isArray(sentence_ids)) {
      return res.status(400).json({ error: '请提供句子ID数组' });
    }

    const supabase = getSupabaseClient();

    // 批量更新索引
    for (let i = 0; i < sentence_ids.length; i++) {
      await supabase
        .from('sentences')
        .update({ sentence_index: i })
        .eq('id', sentence_ids[i])
        .eq('material_id', id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('重排序句子失败:', error);
    res.status(500).json({ error: '重排序句子失败' });
  }
});

/**
 * POST /api/v1/materials/:id/prepare-timestamps
 * 自动准备时间轴编辑所需的数据（一键完成：提取文本 → 切分句子 → 匹配时间戳）
 * 如果材料没有文本，会自动调用 ASR
 * 如果没有句子，会自动切分并匹配时间戳
 */
router.post('/:id/prepare-timestamps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const materialId = Array.isArray(id) ? id[0] : id;
    const supabase = getSupabaseClient();
    
    console.log(`\n===== 开始准备时间轴数据 =====`);
    console.log('材料 ID:', id);
    
    // 获取材料
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', id)
      .single();

    if (materialError || !material) {
      return res.status(404).json({ error: '材料不存在' });
    }

    let fullText = material.full_text || '';
    let duration = material.duration || 0;

    // Step 1: 如果没有文本，调用 ASR 提取
    if (!fullText || fullText.length === 0) {
      console.log('Step 1: 提取 ASR 文本...');
      
      // 生成签名 URL
      const audioUrl = await storage.generatePresignedUrl({
        key: material.audio_url,
        expireTime: 86400,
      });

      // 调用 ASR
      const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
      const asrClient = new ASRClient(new Config(), customHeaders);
      
      const asrResult = await asrClient.recognize({
        uid: 'user',
        url: audioUrl,
        lang: 'en', // 固定识别为英语
      } as any);

      fullText = asrResult.text || asrResult.rawData?.text || '';
      
      // ASR 返回的可能是秒或毫秒
      let rawDuration = asrResult.duration || asrResult.rawData?.audio_info?.duration || 0;
      if (rawDuration > 1000) {
        duration = rawDuration;
      } else {
        duration = rawDuration * 1000;
      }

      console.log(`ASR 完成: 文本长度=${fullText.length}, 时长=${duration}ms (${duration / 1000}s)`);

      // 更新材料
      await supabase
        .from('materials')
        .update({ 
          full_text: fullText,
          duration: duration,
        })
        .eq('id', id);
    } else {
      console.log('Step 1: 已有文本，跳过 ASR');
    }

    if (!fullText || fullText.length === 0) {
      return res.status(400).json({ error: '无法提取文本，请检查音频文件' });
    }

    // Step 2: 检查是否已有句子且时间戳有效
    const { data: existingSentences } = await supabase
      .from('sentences')
      .select('*')
      .eq('material_id', id)
      .order('sentence_index');

    if (existingSentences && existingSentences.length > 0) {
      // 检查是否所有句子都有有效时间戳
      const needsTimestamps = existingSentences.some(s => s.start_time === 0 || s.end_time === 0 || s.end_time <= s.start_time);
      
      if (!needsTimestamps) {
        console.log(`Step 2: 已有 ${existingSentences.length} 个句子且时间戳有效，跳过处理`);
        return res.json({ 
          sentences: existingSentences,
          message: '已有句子数据',
          wasProcessed: false,
        });
      }
      
      console.log(`Step 2: 已有 ${existingSentences.length} 个句子，但需要更新时间戳`);
      
      // 需要更新时间戳，获取单词时间戳
      const audioUrl = await storage.generatePresignedUrl({
        key: material.audio_url,
        expireTime: 86400,
      });

      const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
      const asrClient = new ASRClient(new Config(), customHeaders);
      
      const asrResult = await asrClient.recognize({
        uid: 'user',
        url: audioUrl,
        lang: 'en', // 固定识别为英语
      } as any);

      const wordsWithTime = extractWordsWithTimestamps(asrResult);
      const asrFullText = asrResult.text || asrResult.rawData?.text || '';
      
      // ASR 返回的 duration 可能是秒或毫秒，需要判断
      // 如果大于 1000，认为是毫秒；否则认为是秒
      let rawDuration = asrResult.duration || asrResult.rawData?.audio_info?.duration || 0;
      let asrDuration: number;
      if (rawDuration > 1000) {
        // 已经是毫秒
        asrDuration = rawDuration;
      } else {
        // 是秒，转换为毫秒
        asrDuration = rawDuration * 1000;
      }
      
      console.log(`获取到 ${wordsWithTime.length} 个单词时间戳，时长 ${asrDuration}ms (${asrDuration / 1000}s)`);

      // 为每个句子匹配时间戳
      const updatedSentences = [];
      for (const sentence of existingSentences) {
        const matchResult = matchSentenceToTimestamps(
          sentence.text,
          wordsWithTime,
          asrFullText,
          asrDuration || duration
        );
        
        const { error: updateError } = await supabase
          .from('sentences')
          .update({
            start_time: matchResult.start_time,
            end_time: matchResult.end_time,
          })
          .eq('id', sentence.id);
        
        if (!updateError) {
          updatedSentences.push({
            ...sentence,
            start_time: matchResult.start_time,
            end_time: matchResult.end_time,
          });
        }
      }
      
      console.log(`===== 时间戳更新完成，共 ${updatedSentences.length} 个句子 =====\n`);
      return res.json({ 
        sentences: updatedSentences,
        message: `时间戳更新完成，共 ${updatedSentences.length} 个句子`,
        wasProcessed: true,
      });
    }

    // Step 3: 获取单词时间戳用于匹配
    console.log('Step 3: 获取单词时间戳...');
    
    const audioUrl = await storage.generatePresignedUrl({
      key: material.audio_url,
      expireTime: 86400,
    });

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
      lang: 'en', // 固定识别为英语
    } as any);

    // 提取单词时间戳
    const wordsWithTime = extractWordsWithTimestamps(asrResult);
    console.log(`获取到 ${wordsWithTime.length} 个单词时间戳`);

    // Step 4: 切分句子
    console.log('Step 4: 切分句子...');
    const sentenceTexts = splitIntoSentences(fullText);
    console.log(`切分为 ${sentenceTexts.length} 个句子`);

    // Step 5: 匹配时间戳并保存
    console.log('Step 5: 匹配时间戳并保存句子...');
    const sentences = [];
    
    if (wordsWithTime.length > 0) {
      // 有单词时间戳，精确匹配
      let wordIndex = 0;
      
      for (let i = 0; i < sentenceTexts.length; i++) {
        const sentenceText = sentenceTexts[i];
        const sentenceWords = sentenceText.split(/\s+/).filter(w => w.length > 0);
        const sentenceWordCount = sentenceWords.length;
        
        const startIdx = wordIndex;
        const endIdx = Math.min(wordIndex + sentenceWordCount, wordsWithTime.length);
        
        if (startIdx < wordsWithTime.length) {
          const startTime = wordsWithTime[startIdx].start_time;
          const endWord = wordsWithTime[Math.min(endIdx - 1, wordsWithTime.length - 1)];
          const endTime = endWord ? endWord.end_time : startTime + 2000;
          
          const { data: savedSentence } = await supabase
            .from('sentences')
            .insert({
              material_id: parseInt(materialId),
              text: sentenceText,
              start_time: startTime,
              end_time: endTime,
              sentence_index: i,
            })
            .select()
            .single();
          
          if (savedSentence) {
            sentences.push(savedSentence);
          }
          
          wordIndex = endIdx;
        }
      }
    } else {
      // 没有单词时间戳，按比例分配
      const totalChars = fullText.length;
      let currentChar = 0;
      
      for (let i = 0; i < sentenceTexts.length; i++) {
        const sentenceText = sentenceTexts[i];
        const charRatio = sentenceText.length / totalChars;
        const startTime = Math.round((currentChar / totalChars) * duration);
        const endTime = Math.round(((currentChar + sentenceText.length) / totalChars) * duration);
        
        const { data: savedSentence } = await supabase
          .from('sentences')
          .insert({
            material_id: parseInt(materialId),
            text: sentenceText,
            start_time: startTime,
            end_time: Math.max(endTime, startTime + 1000),
            sentence_index: i,
          })
          .select()
          .single();
        
        if (savedSentence) {
          sentences.push(savedSentence);
        }
        
        currentChar += sentenceText.length;
      }
    }

    console.log(`===== 准备完成，共 ${sentences.length} 个句子 =====\n`);
    
    res.json({ 
      sentences,
      message: `自动处理完成，共切分 ${sentences.length} 个句子`,
      wasProcessed: true,
    });
  } catch (error) {
    console.error('准备时间轴数据失败:', error);
    res.status(500).json({ error: '准备时间轴数据失败', message: (error as Error).message });
  }
});

export default router;
