import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

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
