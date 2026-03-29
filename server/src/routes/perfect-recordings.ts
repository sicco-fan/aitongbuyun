import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

/**
 * 保存完美发音记录
 * POST /api/v1/perfect-recordings
 * Body: { userId, sentenceId, sentenceFileId?, sentenceText, audioKey }
 */
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { userId, sentenceId, sentenceFileId, sentenceText, audioKey } = req.body;

    if (!userId || !sentenceId || !sentenceText) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, sentenceId, sentenceText' 
      });
    }

    // 检查是否已存在该用户该句子的完美发音记录
    const { data: existing } = await supabase
      .from('perfect_recordings')
      .select('id')
      .eq('user_id', userId)
      .eq('sentence_id', sentenceId)
      .single();

    if (existing) {
      // 已存在，更新记录（保留最新的录音）
      const { data, error } = await supabase
        .from('perfect_recordings')
        .update({
          audio_key: audioKey,
          sentence_file_id: sentenceFileId,
          sentence_text: sentenceText,
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('更新完美发音记录失败:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.json({ success: true, data });
    }

    // 创建新记录
    const { data, error } = await supabase
      .from('perfect_recordings')
      .insert({
        user_id: userId,
        sentence_id: sentenceId,
        sentence_file_id: sentenceFileId || null,
        sentence_text: sentenceText,
        audio_key: audioKey,
      })
      .select()
      .single();

    if (error) {
      console.error('保存完美发音记录失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('保存完美发音记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 获取用户的完美发音记录列表
 * GET /api/v1/perfect-recordings
 * Query: userId, limit?, sentenceFileId?, sentenceId?
 */
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { userId, limit = 10, sentenceFileId, sentenceId } = req.query;

    console.log('[完美发音] GET 请求参数:', { userId, sentenceId, sentenceFileId, limit });

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    let query = supabase
      .from('perfect_recordings')
      .select('*')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (sentenceId) {
      console.log('[完美发音] 筛选 sentence_id:', Number(sentenceId));
      query = query.eq('sentence_id', Number(sentenceId));
    } else if (sentenceFileId) {
      console.log('[完美发音] 筛选 sentence_file_id:', Number(sentenceFileId));
      query = query.eq('sentence_file_id', Number(sentenceFileId));
    }

    const { data, error } = await query;

    console.log('[完美发音] 查询结果:', data?.length, '条记录');

    if (error) {
      console.error('获取完美发音记录失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // 获取签名URL
    const recordsWithUrls = await Promise.all(
      (data || []).map(async (record) => {
        if (record.audio_key) {
          const { data: urlData } = await supabase.storage
            .from('audio')
            .createSignedUrl(record.audio_key, 3600); // 1小时有效期
          return { ...record, audio_url: urlData?.signedUrl };
        }
        return record;
      })
    );

    res.json({ success: true, data: recordsWithUrls });
  } catch (error) {
    console.error('获取完美发音记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 获取某个句子的完美发音记录（所有人的，用于社交功能）
 * GET /api/v1/perfect-recordings/sentence/:sentenceId
 * Query: limit?
 */
router.get('/sentence/:sentenceId', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { sentenceId } = req.params;
    const { limit = 10 } = req.query;

    const { data, error } = await supabase
      .from('perfect_recordings')
      .select('*')
      .eq('sentence_id', Number(sentenceId))
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      console.error('获取句子完美发音记录失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // 获取签名URL
    const recordsWithUrls = await Promise.all(
      (data || []).map(async (record) => {
        if (record.audio_key) {
          const { data: urlData } = await supabase.storage
            .from('audio')
            .createSignedUrl(record.audio_key, 3600);
          return { ...record, audio_url: urlData?.signedUrl };
        }
        return record;
      })
    );

    res.json({ success: true, data: recordsWithUrls });
  } catch (error) {
    console.error('获取句子完美发音记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 删除完美发音记录
 * DELETE /api/v1/perfect-recordings/:id
 * Query: userId
 */
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    // 先获取记录，确认所有权
    const { data: record } = await supabase
      .from('perfect_recordings')
      .select('audio_key')
      .eq('id', Number(id))
      .eq('user_id', userId as string)
      .single();

    if (!record) {
      return res.status(404).json({ 
        success: false, 
        error: 'Record not found or not owned by user' 
      });
    }

    // 删除存储的音频文件
    if (record.audio_key) {
      await supabase.storage.from('audio').remove([record.audio_key]);
    }

    // 删除数据库记录
    const { error } = await supabase
      .from('perfect_recordings')
      .delete()
      .eq('id', Number(id))
      .eq('user_id', userId as string);

    if (error) {
      console.error('删除完美发音记录失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除完美发音记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
