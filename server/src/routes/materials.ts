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

// ============== 后台管理 API ==============

/**
 * PUT /api/v1/materials/:id/sentences/:sentenceId
 * 更新句子内容（文本、开始时间、结束时间）
 */
router.put('/:id/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { id, sentenceId } = req.params;
    const { text, start_time, end_time, sentence_index } = req.body;

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
      return res.status(500).json({ error: '更新句子失败' });
    }

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

export default router;
