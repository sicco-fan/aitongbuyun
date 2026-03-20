import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage, ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();
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

    const { buffer, originalname, mimetype } = req.file;
    const fileName = `audio/${Date.now()}_${originalname}`;

    // 上传到对象存储
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
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
    
    const asrResult = await asrClient.recognize({
      uid: 'user',
      url: audioUrl,
    });

    // 处理句子和时间戳
    const sentences = processASRResult(asrResult);
    const totalDuration = asrResult.duration || sentences.length * 3000;
    
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
 */
interface SentenceWithTime {
  text: string;
  start_time: number;
  end_time: number;
}

function processASRResult(asrResult: { text: string; duration?: number; utterances?: any[]; rawData?: any }): SentenceWithTime[] {
  const MAX_WORDS = 6;
  const result: SentenceWithTime[] = [];

  // 尝试从 rawData 中获取 utterances（带时间戳的片段）
  const utterances = asrResult.utterances || asrResult.rawData?.utterances || [];

  if (utterances && utterances.length > 0) {
    // 使用 ASR 返回的时间戳
    for (const utterance of utterances) {
      const text = (utterance.text || '').trim();
      const startTime = utterance.start_time || 0;
      const endTime = utterance.end_time || 0;
      const duration = endTime - startTime;

      if (!text) continue;

      const words = text.split(/\s+/).filter((w: string) => w.length > 0);

      if (words.length <= MAX_WORDS) {
        // 长度合适，直接添加
        result.push({ text, start_time: startTime, end_time: endTime });
      } else {
        // 太长，按单词分割并按比例估算时间
        const wordCount = words.length;
        const avgWordDuration = duration / wordCount;

        for (let i = 0; i < wordCount; i += MAX_WORDS) {
          const chunkWords = words.slice(i, i + MAX_WORDS);
          const chunkText = chunkWords.join(' ');
          const chunkStart = startTime + i * avgWordDuration;
          const chunkEnd = startTime + Math.min(i + MAX_WORDS, wordCount) * avgWordDuration;

          result.push({ text: chunkText, start_time: Math.round(chunkStart), end_time: Math.round(chunkEnd) });
        }
      }
    }
  } else {
    // 没有时间戳信息，使用文本分割并估算时间
    const totalDuration = asrResult.duration || 0;
    const sentences = splitIntoSentences(asrResult.text);

    if (sentences.length > 0) {
      // 计算总单词数
      const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(w => w.length > 0).length, 0);
      const avgWordDuration = totalDuration / totalWords;

      let currentTime = 0;
      for (const text of sentences) {
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const duration = Math.round(words.length * avgWordDuration);

        result.push({ text, start_time: currentTime, end_time: currentTime + duration });
        currentTime += duration;
      }
    }
  }

  return result;
}

/**
 * 将文本分割成短句（每句控制在5-6个单词以内，确保容易记忆）
 */
function splitIntoSentences(text: string): string[] {
  // 最大单词数限制 - 改为6，确保短小易记
  const MAX_WORDS = 6;
  
  // 先按主要标点符号分割
  const primarySplit = text
    .replace(/([。！？.!?\n]+)/g, '|||SPLIT|||')
    .split('|||SPLIT|||')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  const result: string[] = [];
  
  for (const segment of primarySplit) {
    const words = segment.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length <= MAX_WORDS) {
      // 长度合适，直接添加
      if (segment.trim()) {
        result.push(segment.trim());
      }
    } else {
      // 太长，需要进一步分割
      // 尝试按逗号分割
      const commaSplit = segment
        .replace(/([，,;；])/g, '|||COMMA|||')
        .split('|||COMMA|||')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      let currentChunk: string[] = [];
      
      for (const part of commaSplit) {
        const partWords = part.split(/\s+/).filter(w => w.length > 0);
        
        if (currentChunk.length + partWords.length <= MAX_WORDS) {
          currentChunk.push(part);
        } else {
          // 当前块已满，保存并开始新块
          if (currentChunk.length > 0) {
            result.push(currentChunk.join(', '));
          }
          currentChunk = [part];
          
          // 如果单个部分就超过限制，强制按单词数分割
          if (partWords.length > MAX_WORDS) {
            for (let i = 0; i < partWords.length; i += MAX_WORDS) {
              const chunk = partWords.slice(i, i + MAX_WORDS).join(' ');
              if (chunk) {
                result.push(chunk);
              }
            }
            currentChunk = [];
          }
        }
      }
      
      if (currentChunk.length > 0) {
        result.push(currentChunk.join(', '));
      }
    }
  }
  
  // 如果结果太少，强制按单词数分割
  if (result.length < 2 && text.trim()) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += MAX_WORDS) {
      const chunk = words.slice(i, i + MAX_WORDS).join(' ');
      if (chunk) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }
  
  return result.filter(s => s.trim().length > 0);
}

export default router;
