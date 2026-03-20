import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage, ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
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
 * 上传音频文件并创建学习材料
 * Body: FormData { file: audio file, title: string, description?: string }
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
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

    // 按句子分割文本
    const sentences = splitIntoSentences(asrResult.text);
    
    // 计算每个句子的时间范围（假设平均语速）
    const totalDuration = asrResult.duration || sentences.length * 3000;
    const avgSentenceDuration = totalDuration / sentences.length;
    
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
    const sentencesData = sentences.map((text, index) => ({
      material_id: material.id,
      sentence_index: index,
      text,
      start_time: index * avgSentenceDuration,
      end_time: (index + 1) * avgSentenceDuration,
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
 * 将文本分割成句子
 */
function splitIntoSentences(text: string): string[] {
  // 按标点符号分割
  const sentences = text
    .replace(/([。！？.!?])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // 如果分割后句子太少，尝试按逗号分割
  if (sentences.length < 3) {
    return text
      .replace(/([，,。！？.!?])/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  return sentences;
}

export default router;
