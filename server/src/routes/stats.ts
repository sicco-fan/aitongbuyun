import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

// 类型定义
interface FileLearningSummary {
  id: number;
  user_id: string;
  sentence_file_id: number;
  learn_count: number;
  total_duration: number;
  total_score: number;
  last_learned_at: string | null;
}

interface DailyStats {
  id: number;
  user_id: string;
  date: string;
  total_score: number;
  total_duration: number;
  sentences_completed: number;
}

/**
 * 计算分数系数
 * 第1次：1.0，第2次：0.95，...，最低0.5
 */
function calculateScoreMultiplier(learnCount: number): number {
  return Math.max(1.0 - (learnCount - 1) * 0.05, 0.5);
}

/**
 * 获取今天日期字符串 (YYYY-MM-DD)
 */
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * POST /api/v1/stats/record
 * 保存学习记录并更新统计
 * Body: {
 *   user_id: string,
 *   sentence_file_id: number,
 *   sentence_item_id: number,
 *   words_correct: number,
 *   words_total: number,
 *   duration_seconds: number
 * }
 */
router.post('/record', async (req, res) => {
  try {
    const { 
      user_id, 
      sentence_file_id, 
      sentence_item_id, 
      words_correct, 
      words_total, 
      duration_seconds 
    } = req.body;
    
    if (!user_id || !sentence_file_id || !sentence_item_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = getSupabaseClient();
    
    // 1. 获取该句库的学习次数
    const { data: summary, error: summaryError } = await client
      .from('file_learning_summary')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', sentence_file_id)
      .maybeSingle();
    
    if (summaryError) throw summaryError;
    
    const summaryData = summary as FileLearningSummary | null;
    const learnCount = (summaryData?.learn_count || 0) + 1;
    const scoreMultiplier = calculateScoreMultiplier(learnCount);
    
    // 计算本次得分
    const score = words_correct * scoreMultiplier;
    
    // 2. 保存学习记录
    const { error: recordError } = await client
      .from('learning_stats')
      .insert({
        user_id,
        sentence_file_id,
        sentence_item_id,
        words_correct: words_correct || 0,
        words_total: words_total || 0,
        score,
        duration_seconds: duration_seconds || 0
      });
    
    if (recordError) throw recordError;
    
    // 3. 更新每日统计
    const today = getTodayString();
    
    const { data: existingDaily, error: dailyError } = await client
      .from('daily_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .maybeSingle();
    
    if (dailyError) throw dailyError;
    
    if (existingDaily) {
      // 更新现有记录
      await client
        .from('daily_stats')
        .update({
          total_score: (existingDaily.total_score || 0) + score,
          total_duration: (existingDaily.total_duration || 0) + (duration_seconds || 0),
          sentences_completed: (existingDaily.sentences_completed || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDaily.id);
    } else {
      // 创建新记录
      await client
        .from('daily_stats')
        .insert({
          user_id,
          date: today,
          total_score: score,
          total_duration: duration_seconds || 0,
          sentences_completed: 1
        });
    }
    
    // 4. 更新句库学习汇总
    if (summaryData) {
      await client
        .from('file_learning_summary')
        .update({
          learn_count: learnCount,
          total_duration: (summaryData.total_duration || 0) + (duration_seconds || 0),
          total_score: (summaryData.total_score || 0) + score,
          last_learned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', summaryData.id);
    } else {
      await client
        .from('file_learning_summary')
        .insert({
          user_id,
          sentence_file_id,
          learn_count: 1,
          total_duration: duration_seconds || 0,
          total_score: score,
          last_learned_at: new Date().toISOString()
        });
    }
    
    res.json({ 
      success: true, 
      score,
      score_multiplier: scoreMultiplier,
      learn_count: learnCount
    });
  } catch (error) {
    console.error('保存学习记录失败:', error);
    res.status(500).json({ error: '保存学习记录失败' });
  }
});

/**
 * POST /api/v1/stats/daily
 * 直接更新每日学习统计（用于课程模式等场景）
 * Body: {
 *   user_id: string,
 *   score?: number,
 *   duration_seconds?: number,
 *   sentences_completed?: number
 * }
 */
router.post('/daily', async (req, res) => {
  try {
    const { user_id, score, duration_seconds, sentences_completed } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    // 至少需要一项数据才更新
    if ((!score || score <= 0) && (!duration_seconds || duration_seconds <= 0) && (!sentences_completed || sentences_completed <= 0)) {
      return res.json({ success: true, message: '无数据需要更新' });
    }
    
    const client = getSupabaseClient();
    const today = getTodayString();
    const now = new Date().toISOString();
    
    // 检查今日是否已有记录
    const { data: existingDaily, error: dailyFetchError } = await client
      .from('daily_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .maybeSingle();
    
    if (dailyFetchError) {
      console.error('获取每日统计失败:', dailyFetchError);
      throw dailyFetchError;
    }
    
    if (existingDaily) {
      // 更新今日记录
      const updateData: Record<string, unknown> = {
        updated_at: now,
      };
      
      if (score !== undefined && score > 0) {
        updateData.total_score = (existingDaily.total_score || 0) + score;
      }
      
      if (duration_seconds !== undefined && duration_seconds > 0) {
        updateData.total_duration = (existingDaily.total_duration || 0) + duration_seconds;
      }
      
      if (sentences_completed !== undefined && sentences_completed > 0) {
        updateData.sentences_completed = (existingDaily.sentences_completed || 0) + sentences_completed;
      }
      
      const { error: updateError } = await client
        .from('daily_stats')
        .update(updateData)
        .eq('id', existingDaily.id);
      
      if (updateError) {
        throw updateError;
      }
    } else {
      // 创建今日记录
      const { error: insertError } = await client
        .from('daily_stats')
        .insert({
          user_id,
          date: today,
          total_score: score || 0,
          total_duration: duration_seconds || 0,
          sentences_completed: sentences_completed || 0,
        });
      
      if (insertError) {
        throw insertError;
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新每日统计失败:', error);
    res.status(500).json({ error: '更新每日统计失败' });
  }
});

/**
 * GET /api/v1/stats/overview
 * 获取用户统计概览
 * Query: user_id
 */
router.get('/overview', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取总分数和总时长
    const { data: dailyStats, error: dailyError } = await client
      .from('daily_stats')
      .select('total_score, total_duration, sentences_completed')
      .eq('user_id', user_id);
    
    if (dailyError) throw dailyError;
    
    // 计算总计
    const totalScore = dailyStats?.reduce((sum, d) => sum + (d.total_score || 0), 0) || 0;
    const totalDuration = dailyStats?.reduce((sum, d) => sum + (d.total_duration || 0), 0) || 0;
    const totalSentences = dailyStats?.reduce((sum, d) => sum + (d.sentences_completed || 0), 0) || 0;
    
    // 获取今日统计
    const today = getTodayString();
    const { data: todayStats, error: todayError } = await client
      .from('daily_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .maybeSingle();
    
    if (todayError) throw todayError;
    
    // 获取学习天数
    const uniqueDays = dailyStats?.length || 0;
    
    // 获取连续学习天数
    const { data: recentDays, error: recentError } = await client
      .from('daily_stats')
      .select('date')
      .eq('user_id', user_id)
      .order('date', { ascending: false })
      .limit(30);
    
    if (recentError) throw recentError;
    
    let streakDays = 0;
    if (recentDays && recentDays.length > 0) {
      const todayDate = new Date(today);
      let checkDate = todayDate;
      
      for (let i = 0; i < recentDays.length; i++) {
        const expectedDate = checkDate.toISOString().split('T')[0];
        if (recentDays[i].date === expectedDate) {
          streakDays++;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else if (i === 0 && recentDays[i].date !== expectedDate) {
          // 今天还没学习，检查昨天
          checkDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
          if (recentDays[i].date === checkDate.toISOString().split('T')[0]) {
            streakDays++;
            checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
    
    res.json({ 
      success: true, 
      overview: {
        total_score: Math.round(totalScore * 100) / 100,
        total_duration: totalDuration, // 秒
        total_sentences: totalSentences,
        learning_days: uniqueDays,
        streak_days: streakDays,
        today: {
          score: todayStats?.total_score || 0,
          duration: todayStats?.total_duration || 0,
          sentences: todayStats?.sentences_completed || 0
        }
      }
    });
  } catch (error) {
    console.error('获取统计概览失败:', error);
    res.status(500).json({ error: '获取统计概览失败' });
  }
});

/**
 * GET /api/v1/stats/daily
 * 获取每日统计记录
 * Query: user_id, days (可选，默认7天)
 */
router.get('/daily', async (req, res) => {
  try {
    const { user_id, days = '7' } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    const daysNum = parseInt(days as string, 10) || 7;
    
    // 计算起始日期
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum + 1);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const { data: dailyStats, error } = await client
      .from('daily_stats')
      .select('*')
      .eq('user_id', user_id)
      .gte('date', startDateStr)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      daily_stats: dailyStats || []
    });
  } catch (error) {
    console.error('获取每日统计失败:', error);
    res.status(500).json({ error: '获取每日统计失败' });
  }
});

/**
 * GET /api/v1/stats/files
 * 获取句库学习统计
 * Query: user_id
 */
router.get('/files', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data: fileStats, error } = await client
      .from('file_learning_summary')
      .select(`
        *,
        sentence_files(title, description)
      `)
      .eq('user_id', user_id)
      .order('last_learned_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      file_stats: fileStats || []
    });
  } catch (error) {
    console.error('获取句库统计失败:', error);
    res.status(500).json({ error: '获取句库统计失败' });
  }
});

/**
 * GET /api/v1/stats/file/:file_id
 * 获取指定句库的学习详情
 * Query: user_id
 */
router.get('/file/:file_id', async (req, res) => {
  try {
    const { file_id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取句库汇总信息
    const { data: summary, error: summaryError } = await client
      .from('file_learning_summary')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', file_id)
      .maybeSingle();
    
    if (summaryError) throw summaryError;
    
    // 获取最近的学习记录
    const { data: records, error: recordsError } = await client
      .from('learning_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('sentence_file_id', file_id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (recordsError) throw recordsError;
    
    // 计算平均正确率
    const avgCorrectRate = records && records.length > 0
      ? records.reduce((sum, r) => sum + (r.words_correct / (r.words_total || 1)), 0) / records.length
      : 0;
    
    res.json({ 
      success: true, 
      summary,
      records: records || [],
      avg_correct_rate: Math.round(avgCorrectRate * 100) / 100
    });
  } catch (error) {
    console.error('获取句库学习详情失败:', error);
    res.status(500).json({ error: '获取句库学习详情失败' });
  }
});

export default router;
