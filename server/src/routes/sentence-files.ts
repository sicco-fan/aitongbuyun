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
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 用于存储分块上传的临时数据
const uploadChunks: Map<string, { chunks: Buffer[], fileName: string, contentType: string }> = new Map();

/**
 * GET /api/v1/sentence-files
 * 获取句库文件列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    
    const { data: files, error } = await supabase
      .from('sentence_files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }
    
    // 获取每个文件的句子数量和签名 URL
    const filesWithCount = await Promise.all((files || []).map(async (file) => {
      // 获取总句子数
      const { count: totalCount } = await supabase
        .from('sentence_file_items')
        .select('*', { count: 'exact', head: true })
        .eq('sentence_file_id', file.id);
      
      // 获取有时间戳的句子数（start_time 和 end_time 都不为 null）
      const { count: readyCount } = await supabase
        .from('sentence_file_items')
        .select('*', { count: 'exact', head: true })
        .eq('sentence_file_id', file.id)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null);
      
      // 生成原始音频的签名 URL
      let original_audio_signed_url = null;
      if (file.original_audio_url) {
        try {
          original_audio_signed_url = await storage.generatePresignedUrl({
            key: file.original_audio_url,
            expireTime: 86400 * 7, // 7天有效
          });
        } catch (e) {
          console.error('生成签名URL失败:', e);
        }
      }
      
      return {
        ...file,
        sentences_count: totalCount || 0,
        ready_sentences_count: readyCount || 0, // 有时间戳可学习的句子数
        original_audio_signed_url,
      };
    }));
    
    res.json({ files: filesWithCount });
  } catch (error) {
    console.error('获取句库文件列表失败:', error);
    res.status(500).json({ error: '获取列表失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/sentence-files/:id
 * 获取单个句库文件详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    const { data: file, error } = await supabase
      .from('sentence_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 获取句子列表
    const { data: sentences } = await supabase
      .from('sentence_file_items')
      .select('*')
      .eq('sentence_file_id', id)
      .order('sentence_index');
    
    // 生成原始音频的签名 URL
    let original_audio_signed_url = null;
    if (file.original_audio_url) {
      try {
        original_audio_signed_url = await storage.generatePresignedUrl({
          key: file.original_audio_url,
          expireTime: 86400 * 7, // 7天有效
        });
      } catch (e) {
        console.error('生成签名URL失败:', e);
      }
    }
    
    // 转换句子时间戳：数据库存毫秒，前端用秒
    const processedSentences = (sentences || []).map((s: any) => ({
      ...s,
      start_time: s.start_time !== null ? s.start_time / 1000 : null,
      end_time: s.end_time !== null ? s.end_time / 1000 : null,
    }));
    
    res.json({
      file: {
        ...file,
        original_audio_signed_url,
        sentences: processedSentences,
      },
    });
  } catch (error) {
    console.error('获取句库文件详情失败:', error);
    res.status(500).json({ error: '获取详情失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/sentence-files/:id/learnable
 * 获取可学习的句子（只返回有时间戳的句子）
 */
router.get('/:id/learnable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    const { data: file, error } = await supabase
      .from('sentence_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 只获取有时间戳的句子
    const { data: sentences, error: sentencesError } = await supabase
      .from('sentence_file_items')
      .select('*')
      .eq('sentence_file_id', id)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)
      .order('sentence_index');
    
    if (sentencesError) {
      throw new Error(sentencesError.message);
    }
    
    // 生成原始音频的签名 URL
    let original_audio_signed_url = null;
    if (file.original_audio_url) {
      try {
        original_audio_signed_url = await storage.generatePresignedUrl({
          key: file.original_audio_url,
          expireTime: 86400 * 7,
        });
      } catch (e) {
        console.error('生成签名URL失败:', e);
      }
    }
    
    // 转换句子时间戳：数据库存毫秒，前端用秒
    const processedSentences = (sentences || []).map((s: any) => ({
      id: s.id,
      text: s.text,
      sentence_index: s.sentence_index,
      start_time: s.start_time / 1000,
      end_time: s.end_time / 1000,
    }));
    
    res.json({
      file: {
        id: file.id,
        title: file.title,
        original_audio_signed_url,
        original_duration: file.original_duration,
      },
      sentences: processedSentences,
      total_count: processedSentences.length,
    });
  } catch (error) {
    console.error('获取可学习句子失败:', error);
    res.status(500).json({ error: '获取失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/sentence-files
 * 创建新句库文件（上传音频/视频）
 * Body: FormData { file: audio/video file, title: string, description?: string, user_id?: string }
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  console.log('===== POST /api/v1/sentence-files =====');
  console.log('Request headers:', JSON.stringify(req.headers['content-type']));
  
  try {
    if (!req.file) {
      console.log('错误: 没有文件');
      return res.status(400).json({ error: '请上传音频或视频文件' });
    }

    const { title, description, user_id } = req.body;
    console.log('请求参数:', { title, description, user_id, hasFile: !!req.file });
    
    if (!title) {
      console.log('错误: 没有标题');
      return res.status(400).json({ error: '请提供标题' });
    }

    let { buffer, originalname, mimetype } = req.file;
    
    console.log(`\n===== 创建句库文件 =====`);
    console.log('文件名:', originalname);
    console.log('MIME类型:', mimetype);
    console.log('文件大小:', buffer.length, 'bytes');
    
    // 检测是否为视频文件
    const isVideo = mimetype?.startsWith('video/') || 
                    originalname?.toLowerCase().endsWith('.mov') ||
                    originalname?.toLowerCase().endsWith('.mp4') ||
                    originalname?.toLowerCase().endsWith('.avi') ||
                    originalname?.toLowerCase().endsWith('.mkv') ||
                    originalname?.toLowerCase().endsWith('.webm');
    
    let audioBuffer = buffer;
    let audioFileName = originalname;
    let duration = 0;
    
    // 如果是视频，转换为音频
    if (isVideo) {
      console.log('检测到视频文件，开始转换为音频...');
      
      const tempDir = '/tmp/sentence_files';
      await fs.mkdir(tempDir, { recursive: true });
      const tempVideoPath = path.join(tempDir, `${Date.now()}_${originalname}`);
      const tempAudioPath = tempVideoPath.replace(/\.[^.]+$/, '.mp3');
      
      await fs.writeFile(tempVideoPath, buffer);
      
      try {
        // 使用 ffmpeg 转换为音频
        const ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -vn -acodec libmp3lame -ab 192k "${tempAudioPath}"`;
        console.log('执行命令:', ffmpegCmd);
        
        await execAsync(ffmpegCmd, { timeout: 5 * 60 * 1000 });
        
        // 获取视频时长
        try {
          const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempVideoPath}"`;
          const durationResult = await execAsync(ffprobeCmd);
          duration = Math.round(parseFloat(durationResult.stdout.trim()) * 1000);
          console.log('视频时长:', duration, 'ms');
        } catch (e) {
          console.log('获取时长失败:', e);
        }
        
        // 读取转换后的音频
        audioBuffer = await fs.readFile(tempAudioPath);
        audioFileName = originalname.replace(/\.[^.]+$/, '.mp3');
        mimetype = 'audio/mpeg';
        
        // 清理临时文件
        try {
          await fs.unlink(tempVideoPath);
          await fs.unlink(tempAudioPath);
        } catch (e) {}
        
      } catch (ffmpegError) {
        console.error('ffmpeg 转换失败:', ffmpegError);
        try { await fs.unlink(tempVideoPath); } catch (e) {}
        throw new Error('视频转换失败，请确保上传的是有效的视频文件');
      }
    }
    
    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `sentence_files/${Date.now()}_${audioFileName}`,
      contentType: mimetype || 'audio/mpeg',
    });
    
    // 生成签名 URL 获取时长
    const audioUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400,
    });
    
    // 使用 ffprobe 获取音频时长
    if (duration === 0) {
      try {
        const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioUrl}"`;
        const durationResult = await execAsync(ffprobeCmd, { timeout: 30000 });
        duration = Math.round(parseFloat(durationResult.stdout.trim()) * 1000);
        console.log('FFprobe 获取音频时长:', duration, 'ms');
      } catch (e) {
        console.log('获取音频时长失败:', (e as Error).message);
      }
    }
    
    // 存储到数据库
    const supabase = getSupabaseClient();
    
    const { data: file, error: fileError } = await supabase
      .from('sentence_files')
      .insert({
        title,
        description: description || '',
        original_audio_url: fileKey,
        original_duration: duration,
        source_type: 'upload',
        status: 'audio_ready',
        created_by: user_id || null,
      })
      .select()
      .single();
    
    if (fileError || !file) {
      throw new Error(fileError?.message || '创建失败');
    }
    
    console.log(`句库文件创建成功: ID=${file.id}, 标题=${title}`);
    
    // 生成原始音频的签名 URL 供前端播放和下载
    const originalAudioSignedUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效
    });
    
    res.json({
      success: true,
      file: {
        ...file,
        original_audio_signed_url: originalAudioSignedUrl,
      },
      message: '句库文件创建成功',
    });
  } catch (error) {
    console.error('创建句库文件失败:', error);
    res.status(500).json({ error: '创建失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/sentence-files/from-link
 * 从链接创建句库文件
 * Body: { url: string, title?: string, user_id?: string }
 */
router.post('/from-link', async (req: Request, res: Response) => {
  try {
    const { url, title, user_id } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '请提供链接' });
    }
    
    console.log(`[链接导入] 开始处理: ${url}`);
    
    const tempDir = '/tmp/sentence_files_downloads';
    await fs.mkdir(tempDir, { recursive: true });
    
    const timestamp = Date.now();
    const outputTemplate = path.join(tempDir, `${timestamp}_%(title)s.%(ext)s`);
    
    // 使用 yt-dlp 下载
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
      '--print', 'duration_string',
      `"${url}"`,
    ].join(' ');
    
    let filePath = '';
    let videoTitle = title || '';
    let duration = 0;
    
    try {
      const downloadResult = await execAsync(downloadCmd, {
        maxBuffer: 1024 * 1024 * 50,
        timeout: 5 * 60 * 1000,
      });
      
      const lines = downloadResult.stdout.trim().split('\n').filter(Boolean);
      
      if (lines.length >= 1) {
        filePath = lines[0].trim();
      }
      if (lines.length >= 2 && !videoTitle) {
        videoTitle = lines[1].trim();
      }
      if (lines.length >= 3) {
        const durationStr = lines[2].trim();
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2) {
          duration = (parts[0] * 60 + parts[1]) * 1000;
        } else if (parts.length === 3) {
          duration = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }
      }
    } catch (downloadError: any) {
      console.error(`[链接导入] 下载失败:`, downloadError.message);
      throw new Error(`下载失败: ${downloadError.message}`);
    }
    
    // 如果没有找到文件，尝试在目录中查找
    if (!filePath) {
      const files = await fs.readdir(tempDir);
      const recentFiles = files
        .filter(f => f.startsWith(String(timestamp)))
        .sort()
        .reverse();
      
      if (recentFiles.length > 0) {
        filePath = path.join(tempDir, recentFiles[0]);
      }
    }
    
    if (!filePath) {
      throw new Error('下载完成但找不到文件');
    }
    
    // 读取文件
    const fileBuffer = await fs.readFile(filePath);
    console.log(`[链接导入] 文件大小: ${fileBuffer.length} bytes`);
    
    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `sentence_files/${timestamp}_${videoTitle || 'download'}.mp3`,
      contentType: 'audio/mpeg',
    });
    
    // 清理临时文件
    try {
      await fs.unlink(filePath);
    } catch (e) {}
    
    // 存储到数据库
    const supabase = getSupabaseClient();
    
    const { data: file, error: fileError } = await supabase
      .from('sentence_files')
      .insert({
        title: videoTitle || title || '未命名文件',
        description: `来源: ${url}`,
        original_audio_url: fileKey,
        original_duration: duration,
        source_type: 'link',
        source_url: url,
        status: 'audio_ready',
        created_by: user_id || null,
      })
      .select()
      .single();
    
    if (fileError || !file) {
      throw new Error(fileError?.message || '创建失败');
    }
    
    // 生成原始音频的签名 URL 供前端播放和下载
    const originalAudioSignedUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 7, // 7天有效
    });
    
    res.json({
      success: true,
      file: {
        ...file,
        original_audio_signed_url: originalAudioSignedUrl,
      },
      message: '从链接创建成功',
    });
  } catch (error) {
    console.error('[链接导入] 失败:', error);
    res.status(500).json({ 
      error: '导入失败', 
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/sentence-files/:id/extract-text
 * 从音频提取文本
 */
router.post('/:id/extract-text', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    // 获取文件信息
    const { data: file, error: fileError } = await supabase
      .from('sentence_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    if (!file.original_audio_url) {
      return res.status(400).json({ error: '文件没有音频' });
    }
    
    // 生成签名 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: file.original_audio_url,
      expireTime: 86400,
    });
    
    console.log(`[提取文本] 开始处理文件 ${id}`);
    
    // 调用 ASR
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
      lang: 'en',
    } as any);
    
    // 获取原始文本
    let rawText = asrResult.text || asrResult.rawData?.result?.text || '';
    console.log(`[提取文本] 原始文本长度: ${rawText.length}`);
    
    // 检查是否有标点符号，如果没有则使用 LLM 添加
    const hasPunctuation = /[.!?。！？]/.test(rawText);
    
    if (!hasPunctuation && rawText.length > 20) {
      console.log(`[提取文本] 文本缺少标点，使用 LLM 添加...`);
      
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
        
        rawText = punctResponse.content.trim();
        console.log(`[提取文本] 添加标点后长度: ${rawText.length}`);
      } catch (llmError) {
        console.log(`[提取文本] LLM 添加标点失败: ${(llmError as Error).message}`);
      }
    }
    
    // 段落划分：使用 LLM 根据文章逻辑划分段落
    console.log(`[提取文本] 开始段落划分...`);
    let paragraphedText = rawText;
    
    try {
      const llmClient = new LLMClient(new Config(), customHeaders);
      const paragraphResponse = await llmClient.invoke([
        {
          role: 'system',
          content: `You are a text formatting assistant. Your task is to divide a continuous English text into logical paragraphs.

Rules:
1. Keep ALL original text exactly as is - do NOT change, add, or remove any words
2. Analyze the content structure and identify natural topic transitions
3. Start a new paragraph when:
   - The speaker introduces a new topic or idea
   - There's a logical shift in the discussion
   - A new section or phase is mentioned
   - There's a clear transition phrase (like "Now let's...", "Moving on to...", "First...", "Second...", "Finally...")
4. Separate paragraphs with a blank line (double newline)
5. Keep sentences that belong to the same topic/idea together in one paragraph
6. Return ONLY the formatted text without any explanation or commentary

For a speech or presentation:
- Introduction and greeting should be one paragraph
- Each main topic/section should be its own paragraph
- Conclusion or summary should be a separate paragraph`
        },
        {
          role: 'user',
          content: `Please divide this English text into logical paragraphs. Keep every word exactly as it is, just add blank lines between paragraphs:\n\n${rawText}`
        }
      ], { temperature: 0.3 });
      
      paragraphedText = paragraphResponse.content.trim();
      console.log(`[提取文本] 段落划分后长度: ${paragraphedText.length}`);
      
      // 计算段落数
      const paragraphCount = paragraphedText.split(/\n\s*\n/).filter((p: string) => p.trim()).length;
      console.log(`[提取文本] 划分为 ${paragraphCount} 个段落`);
      
    } catch (llmError) {
      console.log(`[提取文本] LLM 段落划分失败: ${(llmError as Error).message}`);
      // 如果段落划分失败，使用原始文本
    }
    
    // 更新数据库
    const { error: updateError } = await supabase
      .from('sentence_files')
      .update({
        text_content: paragraphedText,
        status: 'text_ready',
      })
      .eq('id', id);
    
    if (updateError) {
      throw new Error(updateError.message);
    }
    
    res.json({
      success: true,
      text: paragraphedText,
      message: '文本提取成功',
    });
  } catch (error) {
    console.error('[提取文本] 失败:', error);
    res.status(500).json({ error: '提取失败', message: (error as Error).message });
  }
});

/**
 * PUT /api/v1/sentence-files/:id/text
 * 更新文本内容
 * Body: { text: string }
 */
router.put('/:id/text', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (text === undefined) {
      return res.status(400).json({ error: '请提供文本内容' });
    }
    
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('sentence_files')
      .update({
        text_content: text,
        status: 'text_ready',
      })
      .eq('id', id);
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ success: true, message: '文本已更新' });
  } catch (error) {
    console.error('更新文本失败:', error);
    res.status(500).json({ error: '更新失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/sentence-files/:id/split-sentences
 * 按文本切分句子（按空行分割）
 * Body: { }
 */
router.post('/:id/split-sentences', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const supabase = getSupabaseClient();
    
    // 获取文件信息
    const { data: file, error: fileError } = await supabase
      .from('sentence_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    if (!file.text_content) {
      return res.status(400).json({ error: '请先提取或输入文本' });
    }
    
    // 按空行分割句子
    const sentences = file.text_content
      .split(/\n\s*\n/)  // 按空行分割
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    
    console.log(`[切分句子] 共 ${sentences.length} 个句子`);
    
    // 删除旧句子
    await supabase
      .from('sentence_file_items')
      .delete()
      .eq('sentence_file_id', id);
    
    // 插入新句子（初始时间戳为0）
    const sentencesData = sentences.map((text: string, index: number) => ({
      sentence_file_id: parseInt(id),
      sentence_index: index,
      text,
      start_time: 0,
      end_time: 0,
    }));
    
    const { error: insertError } = await supabase
      .from('sentence_file_items')
      .insert(sentencesData);
    
    if (insertError) {
      throw new Error(insertError.message);
    }
    
    // 更新文件状态
    await supabase
      .from('sentence_files')
      .update({ status: 'completed' })
      .eq('id', id);
    
    res.json({
      success: true,
      count: sentences.length,
      message: `成功切分 ${sentences.length} 个句子`,
    });
  } catch (error) {
    console.error('切分句子失败:', error);
    res.status(500).json({ error: '切分失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/sentence-files/:id/sentences
 * 获取句子的详细列表
 */
router.get('/:id/sentences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    const { data: sentences, error } = await supabase
      .from('sentence_file_items')
      .select('*')
      .eq('sentence_file_id', id)
      .order('sentence_index');
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ sentences: sentences || [] });
  } catch (error) {
    console.error('获取句子列表失败:', error);
    res.status(500).json({ error: '获取失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/sentence-files/:id/sentences
 * 批量保存句子（包括时间戳）
 * Body: { sentences: Array<{ id?: number, text: string, order_number: number, start_time?: number, end_time?: number }> }
 */
router.post('/:id/sentences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sentences } = req.body;
    
    if (!sentences || !Array.isArray(sentences)) {
      return res.status(400).json({ error: '请提供句子数据' });
    }
    
    console.log(`[保存句子] 文件 ${id}, 句子数量: ${sentences.length}`);
    
    const supabase = getSupabaseClient();
    
    // 先删除旧句子
    await supabase
      .from('sentence_file_items')
      .delete()
      .eq('sentence_file_id', id);
    
    // 批量插入新句子
    const fileIdNum = parseInt(Array.isArray(id) ? id[0] : id);
    const sentencesData = sentences.map((s: any, index: number) => ({
      sentence_file_id: fileIdNum,
      sentence_index: index,
      text: s.text,
      // 时间戳单位：前端传秒，数据库存毫秒
      start_time: s.start_time !== null && s.start_time !== undefined ? Math.round(s.start_time * 1000) : null,
      end_time: s.end_time !== null && s.end_time !== undefined ? Math.round(s.end_time * 1000) : null,
    }));
    
    const { error: insertError } = await supabase
      .from('sentence_file_items')
      .insert(sentencesData);
    
    if (insertError) {
      throw new Error(insertError.message);
    }
    
    res.json({ success: true, message: '句子保存成功' });
  } catch (error) {
    console.error('保存句子失败:', error);
    res.status(500).json({ error: '保存失败', message: (error as Error).message });
  }
});

/**
 * PUT /api/v1/sentence-files/:id/sentences/:sentenceId
 * 更新单个句子的时间戳
 * Body: { start_time: number, end_time: number, text?: string }
 */
router.put('/:id/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { id, sentenceId } = req.params;
    const { start_time, end_time, text } = req.body;
    
    const supabase = getSupabaseClient();
    
    const updateData: Record<string, any> = {};
    if (start_time !== undefined) updateData.start_time = Math.round(start_time);
    if (end_time !== undefined) updateData.end_time = Math.round(end_time);
    if (text !== undefined) updateData.text = text;
    
    const { error } = await supabase
      .from('sentence_file_items')
      .update(updateData)
      .eq('id', sentenceId)
      .eq('sentence_file_id', id);
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ success: true, message: '句子已更新' });
  } catch (error) {
    console.error('更新句子失败:', error);
    res.status(500).json({ error: '更新失败', message: (error as Error).message });
  }
});

/**
 * DELETE /api/v1/sentence-files/:id
 * 删除句库文件
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    // 获取文件信息（用于删除对象存储中的文件）
    const { data: file } = await supabase
      .from('sentence_files')
      .select('original_audio_url')
      .eq('id', id)
      .single();
    
    // 删除数据库记录（级联删除句子）
    const { error } = await supabase
      .from('sentence_files')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ success: true, message: '文件已删除' });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ error: '删除失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/sentence-files/:id/audio-url
 * 获取音频签名URL
 */
router.get('/:id/audio-url', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    const { data: file, error } = await supabase
      .from('sentence_files')
      .select('original_audio_url')
      .eq('id', id)
      .single();
    
    if (error || !file || !file.original_audio_url) {
      return res.status(404).json({ error: '音频不存在' });
    }
    
    const audioUrl = await storage.generatePresignedUrl({
      key: file.original_audio_url,
      expireTime: 86400,
    });
    
    res.json({ audioUrl });
  } catch (error) {
    console.error('获取音频URL失败:', error);
    res.status(500).json({ error: '获取失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/sentence-files/:id/generate-audio
 * 生成句子语音片段
 * 从原始音频中切分每个句子的语音片段
 */
router.post('/:id/generate-audio', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    console.log(`[生成音频] 开始处理文件 ${id}`);
    
    // 获取文件信息
    const { data: file, error: fileError } = await supabase
      .from('sentence_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 获取句子列表
    const { data: sentences, error: sentencesError } = await supabase
      .from('sentence_file_items')
      .select('*')
      .eq('sentence_file_id', id)
      .order('sentence_index', { ascending: true });
    
    if (sentencesError || !sentences || sentences.length === 0) {
      return res.status(400).json({ error: '没有可处理的句子' });
    }
    
    // 过滤出有有效时间戳的句子（start_time > 0 且 end_time > 0）
    const validSentences = sentences.filter(s => 
      s.start_time != null && s.start_time > 0 && 
      s.end_time != null && s.end_time > 0 &&
      s.end_time > s.start_time
    );
    
    if (validSentences.length === 0) {
      return res.status(400).json({ error: '没有句子有有效的时间戳，请先设置时间轴' });
    }
    
    console.log(`[生成音频] 共 ${sentences.length} 个句子，其中 ${validSentences.length} 个有有效时间戳`);
    
    // 生成原始音频的签名 URL
    const audioUrl = await storage.generatePresignedUrl({
      key: file.original_audio_url,
      expireTime: 3600,
    });
    
    // 创建临时目录
    const tempDir = `/tmp/sentence_audio_${id}_${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // 下载原始音频
      const originalAudioPath = `${tempDir}/original.mp3`;
      console.log(`[生成音频] 下载原始音频: ${audioUrl}`);
      
      const audioResponse = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      
      await fs.writeFile(originalAudioPath, Buffer.from(audioResponse.data));
      console.log(`[生成音频] 原始音频已下载: ${originalAudioPath}`);
      
      // 处理每个句子
      let successCount = 0;
      let failCount = 0;
      
      for (const sentence of validSentences) {
        try {
          const startTime = sentence.start_time / 1000; // 转换为秒
          const endTime = sentence.end_time / 1000;
          const duration = endTime - startTime;
          
          const sentenceAudioPath = `${tempDir}/sentence_${sentence.id}.mp3`;
          
          // 使用 ffmpeg 切分音频
          const ffmpegCmd = `ffmpeg -y -ss ${startTime} -i "${originalAudioPath}" -t ${duration} -acodec libmp3lame -ab 128k "${sentenceAudioPath}"`;
          console.log(`[生成音频] 切分句子 ${sentence.id}: ${ffmpegCmd}`);
          
          await execAsync(ffmpegCmd, { timeout: 30000 });
          
          // 检查文件是否生成
          const stat = await fs.stat(sentenceAudioPath);
          if (stat.size === 0) {
            throw new Error('生成的音频文件为空');
          }
          
          // 上传到对象存储
          const audioBuffer = await fs.readFile(sentenceAudioPath);
          const audioKey = await storage.uploadFile({
            fileContent: audioBuffer,
            fileName: `sentence-audio/${id}/${sentence.id}.mp3`,
            contentType: 'audio/mpeg',
          });
          
          // 更新数据库
          const { error: updateError } = await supabase
            .from('sentence_file_items')
            .update({ audio_url: audioKey })
            .eq('id', sentence.id);
          
          if (updateError) {
            console.error(`[生成音频] 更新数据库失败:`, updateError);
            throw new Error('更新数据库失败');
          }
          
          console.log(`[生成音频] 句子 ${sentence.id} 处理成功`);
          successCount++;
          
        } catch (sentenceError) {
          console.error(`[生成音频] 句子 ${sentence.id} 处理失败:`, sentenceError);
          failCount++;
        }
      }
      
      // 清理临时文件
      await fs.rm(tempDir, { recursive: true, force: true });
      
      // 更新文件状态为已完成
      await supabase
        .from('sentence_files')
        .update({ status: 'completed' })
        .eq('id', id);
      
      console.log(`[生成音频] 处理完成: 成功 ${successCount}, 失败 ${failCount}`);
      
      res.json({
        success: true,
        message: `音频生成完成：成功 ${successCount} 个，失败 ${failCount} 个`,
        successCount,
        failCount,
      });
      
    } catch (processError) {
      // 清理临时文件
      try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) {}
      throw processError;
    }
    
  } catch (error) {
    console.error('生成音频失败:', error);
    res.status(500).json({ error: '生成失败', message: (error as Error).message });
  }
});

export default router;
