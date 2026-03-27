import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

/**
 * GET /api/v1/learning-records/stats
 * 获取用户的学习统计
 * Query: user_id
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const supabase = getSupabaseClient();
    
    // 获取用户所有句库的学习汇总记录
    const { data: summaries, error } = await supabase
      .from('file_learning_summary')
      .select('last_sentence_index')
      .eq('user_id', user_id);
    
    if (error) {
      throw new Error(error.message);
    }
    
    // 计算已学习的句子数量（按句库汇总的最大句子索引）
    const learnedSentences = summaries?.reduce(
      (sum, s) => sum + (s.last_sentence_index || 0), 0
    ) || 0;
    
    res.json({
      success: true,
      data: {
        learnedSentences,
        totalFiles: summaries?.length || 0,
      },
    });
  } catch (error) {
    console.error('获取学习统计失败:', error);
    res.status(500).json({ error: '获取学习统计失败' });
  }
});

/**
 * GET /api/v1/learning-records/progress/:fileId
 * 获取句库的学习进度
 * Query: user_id
 */
router.get('/progress/:fileId', async (req: Request, res: Response) => {
  try {
    const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const supabase = getSupabaseClient();
    
    // 获取学习汇总记录
    const { data: summary, error } = await supabase
      .from('file_learning_summary')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', fileId)
      .maybeSingle();
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({
      success: true,
      progress: {
        lastSentenceIndex: summary?.last_sentence_index || 0,
        learnCount: summary?.learn_count || 0,
        totalDuration: summary?.total_duration || 0,
        totalScore: summary?.total_score || 0,
        lastLearnedAt: summary?.last_learned_at || null,
      },
    });
  } catch (error) {
    console.error('获取学习进度失败:', error);
    res.status(500).json({ error: '获取学习进度失败' });
  }
});

/**
 * POST /api/v1/learning-records/progress/:fileId
 * 保存句库的学习进度
 * Body: { 
 *   user_id: string, 
 *   sentence_index: number, 
 *   score?: number, 
 *   duration_seconds?: number,
 *   sentence_completed?: boolean  // 是否完成了一个句子（用于统计句子完成数）
 * }
 */
router.post('/progress/:fileId', async (req: Request, res: Response) => {
  try {
    const fileId = Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId;
    const { user_id, sentence_index, score, duration_seconds, sentence_completed } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    if (sentence_index === undefined || sentence_index === null) {
      return res.status(400).json({ error: '缺少句子索引' });
    }
    
    const supabase = getSupabaseClient();
    
    // 检查是否已有记录
    const { data: existing, error: fetchError } = await supabase
      .from('file_learning_summary')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', fileId)
      .maybeSingle();
    
    if (fetchError) {
      throw new Error(fetchError.message);
    }
    
    const now = new Date().toISOString();
    const today = now.split('T')[0]; // YYYY-MM-DD
    
    if (existing) {
      // 更新记录
      const updateData: Record<string, unknown> = {
        last_sentence_index: sentence_index,
        last_learned_at: now,
        updated_at: now,
        learn_count: (existing.learn_count || 0) + 1,
      };
      
      if (score !== undefined) {
        updateData.total_score = (existing.total_score || 0) + score;
      }
      
      if (duration_seconds !== undefined) {
        updateData.total_duration = (existing.total_duration || 0) + duration_seconds;
      }
      
      const { error: updateError } = await supabase
        .from('file_learning_summary')
        .update(updateData)
        .eq('id', existing.id);
      
      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      // 创建新记录
      const { error: insertError } = await supabase
        .from('file_learning_summary')
        .insert({
          user_id,
          sentence_file_id: parseInt(fileId),
          last_sentence_index: sentence_index,
          last_learned_at: now,
          learn_count: 1,
          total_score: score || 0,
          total_duration: duration_seconds || 0,
        });
      
      if (insertError) {
        throw new Error(insertError.message);
      }
    }
    
    // 更新每日统计表 daily_stats
    // 只有当有积分或有学习时长时才更新
    if ((score !== undefined && score > 0) || (duration_seconds !== undefined && duration_seconds > 0)) {
      // 检查今日是否已有记录
      const { data: existingDaily, error: dailyFetchError } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_id', user_id)
        .eq('date', today)
        .maybeSingle();
      
      if (dailyFetchError) {
        console.error('获取每日统计失败:', dailyFetchError);
      } else if (existingDaily) {
        // 更新今日记录
        const updateDailyData: Record<string, unknown> = {
          updated_at: now,
        };
        
        if (score !== undefined && score > 0) {
          updateDailyData.total_score = (existingDaily.total_score || 0) + score;
        }
        
        if (duration_seconds !== undefined && duration_seconds > 0) {
          updateDailyData.total_duration = (existingDaily.total_duration || 0) + duration_seconds;
        }
        
        // 只有当 sentence_completed 为 true 时才增加句子完成数
        if (sentence_completed === true) {
          updateDailyData.sentences_completed = (existingDaily.sentences_completed || 0) + 1;
        }
        
        await supabase
          .from('daily_stats')
          .update(updateDailyData)
          .eq('id', existingDaily.id);
      } else {
        // 创建今日记录
        await supabase
          .from('daily_stats')
          .insert({
            user_id,
            date: today,
            total_score: score || 0,
            total_duration: duration_seconds || 0,
            sentences_completed: sentence_completed === true ? 1 : 0,
          });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('保存学习进度失败:', error);
    res.status(500).json({ error: '保存学习进度失败' });
  }
});

/**
 * POST /api/v1/learning-records
 * 更新或创建学习记录
 * Body: { sentence_id: number, attempts: number, is_completed: boolean }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sentence_id, attempts, is_completed } = req.body;

    if (!sentence_id) {
      return res.status(400).json({ error: '缺少句子ID' });
    }

    const supabase = getSupabaseClient();

    // 检查是否已存在记录
    const { data: existingRecord } = await supabase
      .from('learning_records')
      .select('*')
      .eq('sentence_id', sentence_id)
      .single();

    let result;
    if (existingRecord) {
      // 更新记录
      const updateData: Record<string, unknown> = {
        attempts: attempts ?? existingRecord.attempts + 1,
        is_completed: is_completed ?? existingRecord.is_completed,
      };
      
      if (is_completed && !existingRecord.is_completed) {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('learning_records')
        .update(updateData)
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      result = data;
    } else {
      // 创建新记录
      const { data, error } = await supabase
        .from('learning_records')
        .insert({
          sentence_id,
          attempts: attempts ?? 1,
          is_completed: is_completed ?? false,
          completed_at: is_completed ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      result = data;
    }

    res.json({ success: true, record: result });
  } catch (error) {
    console.error('更新学习记录失败:', error);
    res.status(500).json({ error: '更新学习记录失败' });
  }
});

/**
 * GET /api/v1/learning-records/material/:materialId
 * 获取某个材料的学习进度统计
 */
router.get('/material/:materialId', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const supabase = getSupabaseClient();

    // 获取材料的所有句子
    const { data: sentences, error: sentencesError } = await supabase
      .from('sentences')
      .select('id')
      .eq('material_id', materialId);

    if (sentencesError) throw new Error(sentencesError.message);

    const sentenceIds = sentences?.map(s => s.id) || [];

    if (sentenceIds.length === 0) {
      return res.json({
        total: 0,
        completed: 0,
        total_attempts: 0,
        progress: 0,
      });
    }

    // 获取学习记录
    const { data: records, error: recordsError } = await supabase
      .from('learning_records')
      .select('*')
      .in('sentence_id', sentenceIds);

    if (recordsError) throw new Error(recordsError.message);

    const completedCount = records?.filter(r => r.is_completed).length || 0;
    const totalAttempts = records?.reduce((sum, r) => sum + (r.attempts || 0), 0) || 0;

    res.json({
      total: sentenceIds.length,
      completed: completedCount,
      total_attempts: totalAttempts,
      progress: Math.round((completedCount / sentenceIds.length) * 100),
    });
  } catch (error) {
    console.error('获取学习进度失败:', error);
    res.status(500).json({ error: '获取学习进度失败' });
  }
});

/**
 * POST /api/v1/learning-records/reset/:materialId
 * 重置某个材料的学习记录
 */
router.post('/reset/:materialId', async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const supabase = getSupabaseClient();

    // 获取材料的所有句子
    const { data: sentences } = await supabase
      .from('sentences')
      .select('id')
      .eq('material_id', materialId);

    const sentenceIds = sentences?.map(s => s.id) || [];

    if (sentenceIds.length === 0) {
      return res.json({ success: true });
    }

    // 删除所有学习记录
    const { error } = await supabase
      .from('learning_records')
      .delete()
      .in('sentence_id', sentenceIds);

    if (error) throw new Error(error.message);

    res.json({ success: true });
  } catch (error) {
    console.error('重置学习记录失败:', error);
    res.status(500).json({ error: '重置学习记录失败' });
  }
});

export default router;
