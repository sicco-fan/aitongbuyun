import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

const router = express.Router();

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 每个句子最多保留的记录数
const MAX_RECORDS_PER_SENTENCE = 10;

/**
 * 保存完美发音记录（支持多条）
 * POST /api/v1/perfect-recordings
 * Body: { userId, userNickname?, sentenceId, sentenceFileId?, sentenceText, audioKey, durationSeconds? }
 */
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { userId, userNickname, sentenceId, sentenceFileId, sentenceText, audioKey, durationSeconds } = req.body;

    if (!userId || !sentenceId || !sentenceText || !audioKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, sentenceId, sentenceText, audioKey' 
      });
    }

    // 创建新记录
    const { data: newRecord, error: insertError } = await supabase
      .from('perfect_recordings')
      .insert({
        user_id: userId,
        user_nickname: userNickname || null,
        sentence_id: sentenceId,
        sentence_file_id: sentenceFileId || null,
        sentence_text: sentenceText,
        audio_key: audioKey,
        duration_seconds: durationSeconds || 0,
        is_favorite: false,
        is_shared: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('保存完美发音记录失败:', insertError);
      return res.status(500).json({ success: false, error: insertError.message });
    }

    // 检查该用户该句子的记录数，如果超过限制则清理最旧的非收藏记录
    const { data: allRecords } = await supabase
      .from('perfect_recordings')
      .select('id, is_favorite, created_at')
      .eq('user_id', userId)
      .eq('sentence_id', sentenceId)
      .order('created_at', { ascending: false });

    if (allRecords && allRecords.length > MAX_RECORDS_PER_SENTENCE) {
      // 找出需要删除的记录（非收藏且最旧的）
      const recordsToDelete = allRecords
        .filter(r => !r.is_favorite)
        .slice(MAX_RECORDS_PER_SENTENCE);

      if (recordsToDelete.length > 0) {
        const idsToDelete = recordsToDelete.map(r => r.id);
        await supabase
          .from('perfect_recordings')
          .delete()
          .in('id', idsToDelete);
        console.log(`[完美发音] 自动清理了 ${idsToDelete.length} 条旧记录`);
      }
    }

    res.json({ success: true, data: newRecord });
  } catch (error) {
    console.error('保存完美发音记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 获取用户的完美发音记录列表（带分页和筛选）
 * GET /api/v1/perfect-recordings
 * Query: userId, page?, pageSize?, sentenceFileId?, sentenceId?, favoriteOnly?
 */
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { userId, page = 1, pageSize = 20, sentenceFileId, sentenceId, favoriteOnly } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    const offset = (Number(page) - 1) * Number(pageSize);

    // 构建查询
    let query = supabase
      .from('perfect_recordings')
      .select('*', { count: 'exact' })
      .eq('user_id', userId as string);

    if (sentenceId) {
      query = query.eq('sentence_id', Number(sentenceId));
    } else if (sentenceFileId) {
      query = query.eq('sentence_file_id', Number(sentenceFileId));
    }

    if (favoriteOnly === 'true') {
      query = query.eq('is_favorite', true);
    }

    query = query
      .order('is_favorite', { ascending: true }) // 收藏的排前面
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('获取完美发音记录失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // 获取签名URL
    const recordsWithUrls = await Promise.all(
      (data || []).map(async (record) => {
        if (record.audio_key) {
          try {
            const audioUrl = await storage.generatePresignedUrl({
              key: record.audio_key,
              expireTime: 3600,
            });
            return { ...record, audio_url: audioUrl };
          } catch (urlError) {
            console.error('[完美发音] 生成签名URL失败:', urlError);
            return record;
          }
        }
        return record;
      })
    );

    res.json({ 
      success: true, 
      data: recordsWithUrls,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(pageSize)),
      }
    });
  } catch (error) {
    console.error('获取完美发音记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 获取某个句子的公开分享发音记录（其他用户可以听）
 * GET /api/v1/perfect-recordings/public/:sentenceId
 * Query: limit?, excludeUserId? (排除自己的记录)
 */
router.get('/public/:sentenceId', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { sentenceId } = req.params;
    const { limit = 10, excludeUserId } = req.query;

    let query = supabase
      .from('perfect_recordings')
      .select(`
        id,
        user_id,
        user_nickname,
        sentence_id,
        sentence_text,
        audio_key,
        duration_seconds,
        is_favorite,
        is_shared,
        created_at
      `)
      .eq('sentence_id', Number(sentenceId))
      .eq('is_shared', true)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取公开分享记录失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // 获取签名URL并隐藏用户ID
    const recordsWithUrls = await Promise.all(
      (data || []).map(async (record) => {
        if (record.audio_key) {
          try {
            const audioUrl = await storage.generatePresignedUrl({
              key: record.audio_key,
              expireTime: 3600,
            });
            return { 
              ...record, 
              audio_url: audioUrl,
              // 隐藏敏感信息
              user_id: 'anonymous',
            };
          } catch (urlError) {
            console.error('[完美发音] 生成签名URL失败:', urlError);
            return { ...record, user_id: 'anonymous' };
          }
        }
        return { ...record, user_id: 'anonymous' };
      })
    );

    res.json({ success: true, data: recordsWithUrls });
  } catch (error) {
    console.error('获取公开分享记录异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 设置/取消收藏
 * PUT /api/v1/perfect-recordings/:id/favorite
 * Body: { userId, isFavorite }
 */
router.put('/:id/favorite', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { userId, isFavorite } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    const { data, error } = await supabase
      .from('perfect_recordings')
      .update({ is_favorite: isFavorite })
      .eq('id', Number(id))
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('更新收藏状态失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Record not found or not owned by user' 
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('更新收藏状态异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * 设置/取消公开分享
 * PUT /api/v1/perfect-recordings/:id/share
 * Body: { userId, isShared }
 */
router.put('/:id/share', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { userId, isShared } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    const { data, error } = await supabase
      .from('perfect_recordings')
      .update({ is_shared: isShared })
      .eq('id', Number(id))
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('更新分享状态失败:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Record not found or not owned by user' 
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('更新分享状态异常:', error);
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

/**
 * 获取用户完美发音统计数据
 * GET /api/v1/perfect-recordings/stats
 * Query: userId
 */
router.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    // 获取总记录数
    const { count: totalCount } = await supabase
      .from('perfect_recordings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId as string);

    // 获取收藏数量
    const { count: favoriteCount } = await supabase
      .from('perfect_recordings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId as string)
      .eq('is_favorite', true);

    // 获取分享数量
    const { count: sharedCount } = await supabase
      .from('perfect_recordings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId as string)
      .eq('is_shared', true);

    // 获取不同句子数
    const { data: uniqueSentences } = await supabase
      .from('perfect_recordings')
      .select('sentence_id')
      .eq('user_id', userId as string);

    const uniqueSentenceCount = new Set(uniqueSentences?.map(r => r.sentence_id) || []).size;

    // 计算徽章等级
    let badgeLevel = 0;
    let badgeName = '';
    if (totalCount && totalCount >= 500) {
      badgeLevel = 4;
      badgeName = '发音大师';
    } else if (totalCount && totalCount >= 100) {
      badgeLevel = 3;
      badgeName = '发音达人';
    } else if (totalCount && totalCount >= 50) {
      badgeLevel = 2;
      badgeName = '发音能手';
    } else if (totalCount && totalCount >= 10) {
      badgeLevel = 1;
      badgeName = '发音新星';
    }

    res.json({
      success: true,
      data: {
        totalCount: totalCount || 0,
        favoriteCount: favoriteCount || 0,
        sharedCount: sharedCount || 0,
        uniqueSentenceCount,
        badgeLevel,
        badgeName,
        nextBadgeThreshold: totalCount && totalCount < 10 ? 10 : 
                            totalCount && totalCount < 50 ? 50 :
                            totalCount && totalCount < 100 ? 100 :
                            totalCount && totalCount < 500 ? 500 : null,
      }
    });
  } catch (error) {
    console.error('获取统计数据异常:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
