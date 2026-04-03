import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { requireAdmin } from '../middleware/auth';

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
 * 获取句库学习统计（包括自制句库和精品课程）
 * 精品课程按课程级别聚合显示，不显示课时级别
 * Query: user_id
 */
router.get('/files', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取所有学习汇总记录
    const { data: fileStats, error } = await client
      .from('file_learning_summary')
      .select('*')
      .eq('user_id', user_id)
      .order('last_learned_at', { ascending: false });
    
    if (error) throw error;
    
    if (!fileStats || fileStats.length === 0) {
      return res.json({ success: true, file_stats: [] });
    }
    
    // 获取所有 sentence_file_id
    const sentenceFileIds = fileStats
      .map(s => s.sentence_file_id)
      .filter(id => id !== null);
    
    // 查询自制句库信息
    const { data: sentenceFiles, error: sfError } = await client
      .from('sentence_files')
      .select('id, title, description')
      .in('id', sentenceFileIds);
    
    if (sfError) console.error('获取句库信息失败:', sfError);
    
    // 查询精品课程课时信息（可能是 lessonId）
    const { data: lessons, error: lessonsError } = await client
      .from('lessons')
      .select('id, title, course_id, lesson_number')
      .in('id', sentenceFileIds);
    
    if (lessonsError) console.error('获取课时信息失败:', lessonsError);
    
    // 获取课程信息（用于显示课程名称）
    const courseIds = lessons?.map(l => l.course_id).filter(id => id !== null) || [];
    let courses: any[] = [];
    if (courseIds.length > 0) {
      const { data: coursesData, error: coursesError } = await client
        .from('courses')
        .select('id, title')
        .in('id', courseIds);
      
      if (!coursesError && coursesData) {
        courses = coursesData;
      }
    }
    
    // 创建映射
    const sentenceFileMap = new Map(
      (sentenceFiles || []).map(f => [f.id, f])
    );
    const lessonMap = new Map(
      (lessons || []).map(l => [l.id, l])
    );
    const courseMap = new Map(
      courses.map(c => [c.id, c])
    );
    
    // 分类：自制句库 vs 精品课程
    const selfMadeStats: any[] = [];
    const courseStatsMap = new Map<number, {
      course_id: number;
      course_title: string;
      learn_count: number;
      total_duration: number;
      total_score: number;
      last_learned_at: string | null;
    }>();
    
    fileStats.forEach(stat => {
      const sentenceFile = sentenceFileMap.get(stat.sentence_file_id);
      const lesson = lessonMap.get(stat.sentence_file_id);
      
      if (sentenceFile) {
        // 自制句库，直接添加
        selfMadeStats.push({
          ...stat,
          sentence_files: {
            title: sentenceFile.title,
            description: sentenceFile.description || '',
            sourceType: 'sentence_file',
          },
        });
      } else if (lesson) {
        // 精品课程课时，按课程聚合
        const courseId = lesson.course_id;
        const course = courseMap.get(courseId);
        
        if (!course) return;
        
        const existing = courseStatsMap.get(courseId) || {
          course_id: courseId,
          course_title: course.title,
          learn_count: 0,
          total_duration: 0,
          total_score: 0,
          last_learned_at: null,
        };
        
        existing.learn_count += stat.learn_count || 0;
        existing.total_duration += stat.total_duration || 0;
        existing.total_score += stat.total_score || 0;
        
        // 取最近的学习时间
        if (stat.last_learned_at) {
          if (!existing.last_learned_at || stat.last_learned_at > existing.last_learned_at) {
            existing.last_learned_at = stat.last_learned_at;
          }
        }
        
        courseStatsMap.set(courseId, existing);
      }
    });
    
    // 将课程统计转换为结果格式
    const courseStats = Array.from(courseStatsMap.values()).map(course => ({
      id: `course_${course.course_id}`,
      user_id: user_id as string,
      sentence_file_id: course.course_id,
      learn_count: course.learn_count,
      total_duration: course.total_duration,
      total_score: course.total_score,
      last_learned_at: course.last_learned_at,
      sentence_files: {
        title: course.course_title,
        description: '',
        sourceType: 'course',
      },
    }));
    
    // 合并结果：自制句库 + 课程级别统计
    const enrichedStats = [...selfMadeStats, ...courseStats];
    
    // 按最后学习时间排序
    enrichedStats.sort((a, b) => {
      const timeA = a.last_learned_at || '';
      const timeB = b.last_learned_at || '';
      return timeB.localeCompare(timeA);
    });
    
    res.json({ 
      success: true, 
      file_stats: enrichedStats
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

/**
 * GET /api/v1/stats/learners
 * 获取所有学习者列表（不按课程筛选）
 * 权限要求：仅管理员可访问
 */
router.get('/learners', requireAdmin, async (req, res) => {
  try {
    const client = getSupabaseClient();
    
    // 1. 获取所有用户的每日统计
    const { data: dailyStats, error: dailyError } = await client
      .from('daily_stats')
      .select('user_id, total_score, total_duration, sentences_completed, date')
      .order('date', { ascending: false });
    
    if (dailyError) throw dailyError;
    
    // 2. 获取总句子数（用于计算进度）
    const { count: totalSentences, error: countError } = await client
      .from('sentence_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ready');
    
    if (countError) console.error('获取句子总数失败:', countError);
    
    // 3. 汇总每个用户的学习数据
    const learnerMap = new Map<string, {
      user_id: string;
      total_score: number;
      total_duration: number;
      sentences_completed: number;
      learning_days: number;
      today_score: number;
      today_duration: number;
      today_sentences: number;
      last_learned_at: string | null;
    }>();
    
    const today = getTodayString();
    
    if (dailyStats && dailyStats.length > 0) {
      dailyStats.forEach(stat => {
        if (!stat.user_id) return;
        
        const existing = learnerMap.get(stat.user_id) || {
          user_id: stat.user_id,
          total_score: 0,
          total_duration: 0,
          sentences_completed: 0,
          learning_days: 0,
          today_score: 0,
          today_duration: 0,
          today_sentences: 0,
          last_learned_at: null,
        };
        
        existing.total_score += stat.total_score || 0;
        existing.total_duration += stat.total_duration || 0;
        existing.sentences_completed += stat.sentences_completed || 0;
        existing.learning_days += 1;
        
        if (stat.date === today) {
          existing.today_score = stat.total_score || 0;
          existing.today_duration = stat.total_duration || 0;
          existing.today_sentences = stat.sentences_completed || 0;
        }
        
        if (!existing.last_learned_at || stat.date > existing.last_learned_at) {
          existing.last_learned_at = stat.date;
        }
        
        learnerMap.set(stat.user_id, existing);
      });
    }
    
    // 4. 获取用户信息（昵称、用户名、手机号）
    const userIds = Array.from(learnerMap.keys());
    let userInfoMap = new Map<string, { nickname: string; username: string; phone: string }>();
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, nickname, username, phone')
        .in('id', userIds);
      
      if (!usersError && users) {
        users.forEach(u => {
          userInfoMap.set(u.id, {
            nickname: u.nickname || u.username || `学习者_${u.id.slice(-6)}`,
            username: u.username || '',
            phone: u.phone || '',
          });
        });
      }
    }
    
    // 5. 组装返回数据
    const learners = Array.from(learnerMap.values()).map(learner => {
      const userInfo = userInfoMap.get(learner.user_id) || {
        nickname: `学习者_${learner.user_id.slice(-6)}`,
        username: '',
        phone: '',
      };
      
      return {
        ...learner,
        nickname: userInfo.nickname,
        username: userInfo.username,
        phone: userInfo.phone,
        total_score: Math.round(learner.total_score * 100) / 100,
        total_duration_minutes: Math.round(learner.total_duration / 60),
        progress_percent: (totalSentences ?? 0) > 0 
          ? Math.min(Math.round((learner.sentences_completed / (totalSentences ?? 1)) * 100), 100) 
          : 0,
      };
    });
    
    learners.sort((a, b) => b.total_score - a.total_score);
    
    res.json({ 
      success: true, 
      learners,
      total_sentences: totalSentences || 0,
      total_learners: learners.length,
    });
  } catch (error) {
    console.error('获取学习者列表失败:', error);
    res.status(500).json({ error: '获取学习者列表失败' });
  }
});

/**
 * GET /api/v1/stats/user-trend/:userId
 * 获取用户学习趋势数据（最近7天）
 * Query: course_id (可选)
 * 权限要求：仅管理员可访问
 */
router.get('/user-trend/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { course_id } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取最近7天的数据
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const { data: dailyStats, error } = await client
      .from('daily_stats')
      .select('date, total_score, total_duration, sentences_completed')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .order('date', { ascending: true });
    
    if (error) throw error;
    
    // 填充缺失的日期
    const trendData: Array<{
      date: string;
      score: number;
      duration: number;
      sentences: number;
    }> = [];
    
    const statsMap = new Map<string, { score: number; duration: number; sentences: number }>();
    if (dailyStats) {
      dailyStats.forEach(s => {
        statsMap.set(s.date, {
          score: s.total_score || 0,
          duration: s.total_duration || 0,
          sentences: s.sentences_completed || 0,
        });
      });
    }
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const stats = statsMap.get(dateStr) || { score: 0, duration: 0, sentences: 0 };
      trendData.push({
        date: dateStr,
        ...stats,
      });
    }
    
    res.json({ 
      success: true, 
      trend_data: trendData,
    });
  } catch (error) {
    console.error('获取学习趋势失败:', error);
    res.status(500).json({ error: '获取学习趋势失败' });
  }
});

/**
 * GET /api/v1/stats/course-learners/:courseId
 * 获取课程的学习者列表（管理员功能）
 * 返回：学习者名单、积分、学习时长、完成句子数、今日进度等
 * 权限要求：仅管理员可访问
 * 
 * 注意：由于当前数据库结构限制，此API返回的是所有用户的学习统计
 * 课程ID参数暂时仅用于标识调用来源
 */
router.get('/course-learners/:courseId', requireAdmin, async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    if (isNaN(courseId)) {
      return res.status(400).json({ error: '无效的课程ID' });
    }

    const client = getSupabaseClient();
    
    // 1. 获取课程总句子数（用于计算进度）
    const { data: lessons, error: lessonsError } = await client
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);
    
    if (lessonsError) throw lessonsError;
    
    const lessonIds = lessons?.map(l => l.id) || [];
    let totalSentences = 0;
    
    if (lessonIds.length > 0) {
      const { count, error: countError } = await client
        .from('lesson_sentences')
        .select('*', { count: 'exact', head: true })
        .in('lesson_id', lessonIds);
      
      if (!countError) {
        totalSentences = count || 0;
      }
    }
    
    // 2. 获取所有用户的每日统计（汇总）
    const { data: dailyStats, error: dailyError } = await client
      .from('daily_stats')
      .select('user_id, total_score, total_duration, sentences_completed, date')
      .order('date', { ascending: false });
    
    if (dailyError) throw dailyError;
    
    // 3. 汇总每个用户的学习数据
    const learnerMap = new Map<string, {
      user_id: string;
      total_score: number;
      total_duration: number;
      sentences_completed: number;
      learning_days: number;
      today_score: number;
      today_duration: number;
      today_sentences: number;
      last_learned_at: string | null;
    }>();
    
    const today = getTodayString();
    
    if (dailyStats && dailyStats.length > 0) {
      dailyStats.forEach(stat => {
        if (!stat.user_id) return;
        
        const existing = learnerMap.get(stat.user_id) || {
          user_id: stat.user_id,
          total_score: 0,
          total_duration: 0,
          sentences_completed: 0,
          learning_days: 0,
          today_score: 0,
          today_duration: 0,
          today_sentences: 0,
          last_learned_at: null,
        };
        
        existing.total_score += stat.total_score || 0;
        existing.total_duration += stat.total_duration || 0;
        existing.sentences_completed += stat.sentences_completed || 0;
        existing.learning_days += 1;
        
        // 今日统计
        if (stat.date === today) {
          existing.today_score = stat.total_score || 0;
          existing.today_duration = stat.total_duration || 0;
          existing.today_sentences = stat.sentences_completed || 0;
        }
        
        // 最近学习时间
        if (!existing.last_learned_at || stat.date > existing.last_learned_at) {
          existing.last_learned_at = stat.date;
        }
        
        learnerMap.set(stat.user_id, existing);
      });
    }
    
    // 4. 获取用户信息（昵称、用户名、手机号）
    const userIds = Array.from(learnerMap.keys());
    let userInfoMap = new Map<string, { nickname: string; username: string; phone: string }>();
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, nickname, username, phone')
        .in('id', userIds);
      
      if (!usersError && users) {
        users.forEach(u => {
          userInfoMap.set(u.id, {
            nickname: u.nickname || u.username || `学习者_${u.id.slice(-6)}`,
            username: u.username || '',
            phone: u.phone || '',
          });
        });
      }
    }
    
    // 5. 组装返回数据
    const learners = Array.from(learnerMap.values()).map(learner => {
      const userInfo = userInfoMap.get(learner.user_id) || {
        nickname: `学习者_${learner.user_id.slice(-6)}`,
        username: '',
        phone: '',
      };
      
      return {
        ...learner,
        nickname: userInfo.nickname,
        username: userInfo.username,
        phone: userInfo.phone,
        total_score: Math.round(learner.total_score * 100) / 100,
        total_duration_minutes: Math.round(learner.total_duration / 60),
        progress_percent: totalSentences > 0 
          ? Math.min(Math.round((learner.sentences_completed / totalSentences) * 100), 100) 
          : 0,
      };
    });
    
    // 按总积分排序
    learners.sort((a, b) => b.total_score - a.total_score);
    
    res.json({ 
      success: true, 
      learners,
      total_sentences: totalSentences,
      total_learners: learners.length,
    });
  } catch (error) {
    console.error('获取课程学习者失败:', error);
    res.status(500).json({ error: '获取课程学习者失败' });
  }
});

/**
 * GET /api/v1/stats/user-errors/:userId
 * 获取用户的错题分析
 * Query: course_id (可选，筛选特定课程的错题)
 * 权限要求：仅管理员可访问
 */
router.get('/user-errors/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { course_id } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取错题记录
    let query = client
      .from('error_words')
      .select('word, error_count, last_error_at, sentence_text, sentence_file_id')
      .eq('user_id', userId)
      .order('error_count', { ascending: false })
      .limit(50);
    
    const { data: errorWords, error } = await query;
    
    if (error) throw error;
    
    // 按错误次数分组统计
    const wordStats = new Map<string, { count: number; sentences: string[] }>();
    
    if (errorWords) {
      errorWords.forEach(record => {
        const existing = wordStats.get(record.word) || { count: 0, sentences: [] };
        existing.count += record.error_count;
        if (record.sentence_text && !existing.sentences.includes(record.sentence_text)) {
          existing.sentences.push(record.sentence_text);
        }
        wordStats.set(record.word, existing);
      });
    }
    
    // 转换为数组并排序
    const weakWords = Array.from(wordStats.entries())
      .map(([word, data]) => ({
        word,
        error_count: data.count,
        example_sentences: data.sentences.slice(0, 3), // 最多显示3个例句
      }))
      .sort((a, b) => b.error_count - a.error_count)
      .slice(0, 20); // 最多返回20个薄弱单词
    
    res.json({ 
      success: true, 
      weak_words: weakWords,
      total_errors: weakWords.reduce((sum, w) => sum + w.error_count, 0),
    });
  } catch (error) {
    console.error('获取错题分析失败:', error);
    res.status(500).json({ error: '获取错题分析失败' });
  }
});

/**
 * GET /api/v1/stats/course-progress/:courseId
 * 获取用户在某课程的学习进度
 * Query: user_id
 */
router.get('/course-progress/:courseId', async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const { user_id } = req.query;
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: '无效的课程ID' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 1. 获取课程所有课时
    const { data: lessons, error: lessonsError } = await client
      .from('lessons')
      .select('id, lesson_number, title')
      .eq('course_id', courseId)
      .order('lesson_number', { ascending: true });
    
    if (lessonsError) throw lessonsError;
    
    if (!lessons || lessons.length === 0) {
      return res.json({ success: true, lessons: [], total_progress: 0 });
    }
    
    const lessonIds = lessons.map(l => l.id);
    
    // 2. 获取每个课时的句子数
    const { data: sentenceCounts, error: countError } = await client
      .from('lesson_sentences')
      .select('lesson_id, id')
      .in('lesson_id', lessonIds);
    
    if (countError) throw countError;
    
    // 统计每个课时的句子数
    const lessonSentenceCounts = new Map<number, number>();
    const sentenceLessonMap = new Map<number, number>();
    if (sentenceCounts) {
      sentenceCounts.forEach(s => {
        lessonSentenceCounts.set(s.lesson_id, (lessonSentenceCounts.get(s.lesson_id) || 0) + 1);
        sentenceLessonMap.set(s.id, s.lesson_id);
      });
    }
    
    // 3. 获取用户的学习记录
    const sentenceIds = sentenceCounts?.map(s => s.id) || [];
    const { data: records, error: recordsError } = await client
      .from('learning_records')
      .select('sentence_id, is_completed')
      .eq('user_id', user_id as string)
      .in('sentence_id', sentenceIds);
    
    if (recordsError) throw recordsError;
    
    // 统计每个课时的完成句子数
    const lessonCompletedCounts = new Map<number, number>();
    if (records) {
      records.forEach(r => {
        if (r.is_completed && r.sentence_id) {
          const lessonId = sentenceLessonMap.get(r.sentence_id);
          if (lessonId) {
            lessonCompletedCounts.set(lessonId, (lessonCompletedCounts.get(lessonId) || 0) + 1);
          }
        }
      });
    }
    
    // 4. 组装返回数据
    let totalSentences = 0;
    let totalCompleted = 0;
    
    const lessonsProgress = lessons.map(lesson => {
      const total = lessonSentenceCounts.get(lesson.id) || 0;
      const completed = lessonCompletedCounts.get(lesson.id) || 0;
      totalSentences += total;
      totalCompleted += completed;
      
      return {
        lesson_id: lesson.id,
        lesson_number: lesson.lesson_number,
        title: lesson.title,
        total_sentences: total,
        completed_sentences: completed,
        progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
    
    res.json({ 
      success: true, 
      lessons: lessonsProgress,
      total_sentences: totalSentences,
      total_completed: totalCompleted,
      total_progress: totalSentences > 0 ? Math.round((totalCompleted / totalSentences) * 100) : 0,
    });
  } catch (error) {
    console.error('获取课程进度失败:', error);
    res.status(500).json({ error: '获取课程进度失败' });
  }
});

export default router;
