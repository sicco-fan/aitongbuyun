import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = Router();

/**
 * GET /api/v1/error-words
 * 获取用户的错题列表
 * Query: user_id, sentence_file_id (可选，筛选特定句库)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, sentence_file_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('error_words')
      .select('*')
      .eq('user_id', user_id)
      .order('error_count', { ascending: false })
      .order('last_error_at', { ascending: false });
    
    if (sentence_file_id) {
      query = query.eq('sentence_file_id', sentence_file_id);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(error.message);
    }
    
    // 按单词聚合统计
    const wordStats: Record<string, {
      word: string;
      totalCount: number;
      sentences: Array<{
        sentence_file_id: number;
        sentence_index: number;
        sentence_text: string | null;
        error_count: number;
        last_error_at: string;
      }>;
    }> = {};
    
    for (const item of data || []) {
      const word = item.word.toLowerCase();
      if (!wordStats[word]) {
        wordStats[word] = {
          word,
          totalCount: 0,
          sentences: [],
        };
      }
      wordStats[word].totalCount += item.error_count;
      wordStats[word].sentences.push({
        sentence_file_id: item.sentence_file_id,
        sentence_index: item.sentence_index,
        sentence_text: item.sentence_text,
        error_count: item.error_count,
        last_error_at: item.last_error_at,
      });
    }
    
    // 转换为数组并按总错误次数排序
    const result = Object.values(wordStats).sort((a, b) => b.totalCount - a.totalCount);
    
    res.json({
      success: true,
      data: result,
      totalUniqueWords: result.length,
      totalErrors: data?.reduce((sum, item) => sum + item.error_count, 0) || 0,
    });
  } catch (error) {
    console.error('获取错题列表失败:', error);
    res.status(500).json({ error: '获取错题列表失败' });
  }
});

/**
 * GET /api/v1/error-words/sentences
 * 获取有错题的句子列表（用于错题优先模式）
 * Query: user_id, sentence_file_id
 */
router.get('/sentences', async (req: Request, res: Response) => {
  try {
    const { user_id, sentence_file_id } = req.query;
    
    if (!user_id || !sentence_file_id) {
      return res.status(400).json({ error: '缺少用户ID或句库ID' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('error_words')
      .select('sentence_index, sentence_text, error_count')
      .eq('user_id', user_id)
      .eq('sentence_file_id', sentence_file_id)
      .order('error_count', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }
    
    // 按句子索引聚合
    const sentenceMap = new Map<number, {
      sentence_index: number;
      sentence_text: string | null;
      totalErrors: number;
      errorWords: string[];
    }>();
    
    for (const item of data || []) {
      const idx = item.sentence_index;
      if (!sentenceMap.has(idx)) {
        sentenceMap.set(idx, {
          sentence_index: idx,
          sentence_text: item.sentence_text,
          totalErrors: 0,
          errorWords: [],
        });
      }
      const entry = sentenceMap.get(idx)!;
      entry.totalErrors += item.error_count;
      // @ts-expect-error word is string
      entry.errorWords.push(item.word);
    }
    
    // 按错误次数排序
    const result = Array.from(sentenceMap.values()).sort((a, b) => b.totalErrors - a.totalErrors);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取错题句子失败:', error);
    res.status(500).json({ error: '获取错题句子失败' });
  }
});

/**
 * POST /api/v1/error-words
 * 记录一个错题
 * Body: { user_id, sentence_file_id, sentence_index, word, sentence_text? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, sentence_file_id, sentence_index, word, sentence_text } = req.body;
    
    if (!user_id || !sentence_file_id || sentence_index === undefined || !word) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    
    // 检查是否已存在
    const { data: existing, error: fetchError } = await supabase
      .from('error_words')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', sentence_file_id)
      .eq('sentence_index', sentence_index)
      .eq('word', word.toLowerCase())
      .maybeSingle();
    
    if (fetchError) {
      throw new Error(fetchError.message);
    }
    
    if (existing) {
      // 更新错误次数
      const { error: updateError } = await supabase
        .from('error_words')
        .update({
          error_count: existing.error_count + 1,
          last_error_at: now,
          updated_at: now,
          sentence_text: sentence_text || existing.sentence_text,
        })
        .eq('id', existing.id);
      
      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      // 插入新记录
      const { error: insertError } = await supabase
        .from('error_words')
        .insert({
          user_id,
          sentence_file_id,
          sentence_index,
          word: word.toLowerCase(),
          sentence_text,
          error_count: 1,
          last_error_at: now,
        });
      
      if (insertError) {
        throw new Error(insertError.message);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('记录错题失败:', error);
    res.status(500).json({ error: '记录错题失败' });
  }
});

/**
 * DELETE /api/v1/error-words
 * 清除某个单词的错题记录
 * Query: user_id, word
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { user_id, word, sentence_file_id, sentence_index } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('error_words')
      .delete()
      .eq('user_id', user_id);
    
    if (word) {
      query = query.eq('word', (word as string).toLowerCase());
    }
    
    if (sentence_file_id) {
      query = query.eq('sentence_file_id', sentence_file_id);
    }
    
    if (sentence_index !== undefined) {
      query = query.eq('sentence_index', sentence_index);
    }
    
    const { error } = await query;
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('清除错题失败:', error);
    res.status(500).json({ error: '清除错题失败' });
  }
});

/**
 * GET /api/v1/error-words/stats
 * 获取用户错题统计
 * Query: user_id
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('error_words')
      .select('word, error_count')
      .eq('user_id', user_id);
    
    if (error) {
      throw new Error(error.message);
    }
    
    const uniqueWords = new Set(data?.map(d => d.word.toLowerCase()) || []).size;
    const totalErrors = data?.reduce((sum, d) => sum + (d.error_count || 0), 0) || 0;
    
    res.json({
      success: true,
      data: {
        uniqueWords,
        totalErrors,
        totalRecords: data?.length || 0,
      },
    });
  } catch (error) {
    console.error('获取错题统计失败:', error);
    res.status(500).json({ error: '获取错题统计失败' });
  }
});

/**
 * POST /api/v1/error-words/reduce
 * 减少错题的错误次数（练习正确时调用）
 * Body: { user_id, sentence_file_id, sentence_index, word }
 * 返回: { success, remaining_count, cleared } - remaining_count 为剩余错误次数，cleared 表示是否已清零
 */
router.post('/reduce', async (req: Request, res: Response) => {
  try {
    const { user_id, sentence_file_id, sentence_index, word } = req.body;
    
    if (!user_id || !sentence_file_id || sentence_index === undefined || !word) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    
    // 查找错题记录
    const { data: existing, error: fetchError } = await supabase
      .from('error_words')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', sentence_file_id)
      .eq('sentence_index', sentence_index)
      .eq('word', word.toLowerCase())
      .maybeSingle();
    
    if (fetchError) {
      throw new Error(fetchError.message);
    }
    
    if (!existing) {
      // 没有错题记录，直接返回
      return res.json({
        success: true,
        remaining_count: 0,
        cleared: true,
        message: '该单词没有错题记录',
      });
    }
    
    const newCount = existing.error_count - 1;
    
    if (newCount <= 0) {
      // 错误次数清零，删除记录
      const { error: deleteError } = await supabase
        .from('error_words')
        .delete()
        .eq('id', existing.id);
      
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      res.json({
        success: true,
        remaining_count: 0,
        cleared: true,
        message: '恭喜！该单词的错误次数已清零',
      });
    } else {
      // 减少错误次数
      const { error: updateError } = await supabase
        .from('error_words')
        .update({
          error_count: newCount,
          updated_at: now,
        })
        .eq('id', existing.id);
      
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      res.json({
        success: true,
        remaining_count: newCount,
        cleared: false,
        message: `练习成功！还剩 ${newCount} 次错误待攻克`,
      });
    }
  } catch (error) {
    console.error('减少错题次数失败:', error);
    res.status(500).json({ error: '减少错题次数失败' });
  }
});

export default router;
