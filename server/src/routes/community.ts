import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

// ==================== 工具函数 ====================

function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// ==================== 打卡相关 API ====================

/**
 * POST /api/v1/community/check-in
 * 用户打卡
 * Body: { user_id: string }
 */
router.post('/check-in', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    const today = getTodayString();
    
    // 检查今日是否已打卡
    const { data: existingCheckIn, error: checkError } = await client
      .from('check_ins')
      .select('*')
      .eq('user_id', user_id)
      .eq('check_date', today)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existingCheckIn) {
      return res.json({ 
        success: true, 
        message: '今日已打卡',
        check_in: existingCheckIn,
        already_checked: true
      });
    }
    
    // 获取今日学习统计
    const { data: todayStats } = await client
      .from('daily_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .maybeSingle();
    
    // 计算连续打卡天数
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const { data: yesterdayCheckIn } = await client
      .from('check_ins')
      .select('streak_days')
      .eq('user_id', user_id)
      .eq('check_date', yesterdayStr)
      .maybeSingle();
    
    const streakDays = yesterdayCheckIn ? (yesterdayCheckIn.streak_days || 0) + 1 : 1;
    
    // 创建打卡记录
    const { data: checkIn, error: insertError } = await client
      .from('check_ins')
      .insert({
        user_id,
        check_date: today,
        streak_days: streakDays,
        duration_seconds: todayStats?.total_duration || 0,
        sentences_completed: todayStats?.sentences_completed || 0
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // 检查是否获得徽章
    const earnedBadges: string[] = [];
    
    // 检查连续打卡徽章
    const streakBadgeRequirements = [7, 30, 100, 365];
    for (const days of streakBadgeRequirements) {
      if (streakDays >= days) {
        // 检查是否已有该徽章
        const { data: existingBadge } = await client
          .from('badges')
          .select('id, name')
          .eq('code', `streak_${days}`)
          .single();
        
        if (existingBadge) {
          const { data: userBadge } = await client
            .from('user_badges')
            .select('id')
            .eq('user_id', user_id)
            .eq('badge_id', existingBadge.id)
            .maybeSingle();
          
          if (!userBadge) {
            await client
              .from('user_badges')
              .insert({ user_id, badge_id: existingBadge.id });
            earnedBadges.push(existingBadge.name);
          }
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: '打卡成功',
      check_in: checkIn,
      streak_days: streakDays,
      earned_badges: earnedBadges
    });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({ error: '打卡失败' });
  }
});

/**
 * GET /api/v1/community/check-in/status
 * 获取用户打卡状态
 * Query: user_id
 */
router.get('/check-in/status', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    const today = getTodayString();
    
    // 获取今日打卡状态
    const { data: todayCheckIn, error: todayError } = await client
      .from('check_ins')
      .select('*')
      .eq('user_id', user_id)
      .eq('check_date', today)
      .maybeSingle();
    
    if (todayError) throw todayError;
    
    // 获取当前连续打卡天数
    let streakDays = 0;
    if (todayCheckIn) {
      streakDays = todayCheckIn.streak_days || 1;
    } else {
      // 检查昨天的打卡记录
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const { data: yesterdayCheckIn } = await client
        .from('check_ins')
        .select('streak_days')
        .eq('user_id', user_id)
        .eq('check_date', yesterdayStr)
        .maybeSingle();
      
      if (yesterdayCheckIn) {
        streakDays = yesterdayCheckIn.streak_days || 0;
      }
    }
    
    // 获取本月打卡记录
    const monthStart = getMonthStart();
    const { data: monthCheckIns, error: monthError } = await client
      .from('check_ins')
      .select('check_date')
      .eq('user_id', user_id)
      .gte('check_date', monthStart)
      .order('check_date', { ascending: true });
    
    if (monthError) throw monthError;
    
    // 获取用户徽章
    const { data: userBadges } = await client
      .from('user_badges')
      .select(`
        earned_at,
        badges (code, name, description, icon)
      `)
      .eq('user_id', user_id);
    
    res.json({ 
      success: true, 
      today_checked: !!todayCheckIn,
      streak_days: streakDays,
      month_check_ins: monthCheckIns?.map(c => c.check_date) || [],
      badges: userBadges || []
    });
  } catch (error) {
    console.error('获取打卡状态失败:', error);
    res.status(500).json({ error: '获取打卡状态失败' });
  }
});

/**
 * GET /api/v1/community/check-in/calendar
 * 获取打卡日历数据
 * Query: user_id, year, month
 */
router.get('/check-in/calendar', async (req, res) => {
  try {
    const { user_id, year, month } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const yearNum = parseInt(year as string) || new Date().getFullYear();
    const monthNum = parseInt(month as string) || (new Date().getMonth() + 1);
    
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = monthNum === 12 
      ? `${yearNum + 1}-01-01` 
      : `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-01`;
    
    const { data: checkIns, error } = await client
      .from('check_ins')
      .select('check_date, streak_days, duration_seconds, sentences_completed')
      .eq('user_id', user_id)
      .gte('check_date', startDate)
      .lt('check_date', endDate)
      .order('check_date', { ascending: true });
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      check_ins: checkIns || []
    });
  } catch (error) {
    console.error('获取打卡日历失败:', error);
    res.status(500).json({ error: '获取打卡日历失败' });
  }
});

// ==================== 排行榜 API ====================

/**
 * GET /api/v1/community/ranking/study-time
 * 学习时长排行榜（本周）
 * Query: limit (默认20)
 */
router.get('/ranking/study-time', async (req, res) => {
  try {
    const { limit = '20' } = req.query;
    const client = getSupabaseClient();
    
    const weekStart = getWeekStart();
    
    // 获取本周学习数据
    const { data: dailyStats, error } = await client
      .from('daily_stats')
      .select('user_id, total_duration')
      .gte('date', weekStart);
    
    if (error) throw error;
    
    // 汇总用户学习时长
    const userDurationMap = new Map<string, number>();
    dailyStats?.forEach(stat => {
      if (stat.user_id) {
        userDurationMap.set(
          stat.user_id, 
          (userDurationMap.get(stat.user_id) || 0) + (stat.total_duration || 0)
        );
      }
    });
    
    // 获取用户信息
    const userIds = Array.from(userDurationMap.keys());
    let userInfoMap = new Map();
    
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, username')
        .in('id', userIds);
      
      const { data: profiles } = await client
        .from('user_profiles')
        .select('user_id, avatar_url, show_in_ranking')
        .in('user_id', userIds);
      
      users?.forEach(u => {
        const profile = profiles?.find(p => p.user_id === u.id);
        userInfoMap.set(u.id, {
          nickname: u.nickname || u.username || `用户${u.id.slice(-6)}`,
          avatar_url: profile?.avatar_url,
          show_in_ranking: profile?.show_in_ranking !== false
        });
      });
    }
    
    // 排序并返回
    const limitNum = parseInt(limit as string, 10) || 20;
    const ranking = Array.from(userDurationMap.entries())
      .filter(([userId]) => userInfoMap.get(userId)?.show_in_ranking !== false)
      .map(([userId, duration]) => ({
        user_id: userId,
        nickname: userInfoMap.get(userId)?.nickname || `用户${userId.slice(-6)}`,
        avatar_url: userInfoMap.get(userId)?.avatar_url,
        total_duration: duration,
        total_hours: Math.round(duration / 3600 * 10) / 10
      }))
      .sort((a, b) => b.total_duration - a.total_duration)
      .slice(0, limitNum)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    res.json({ success: true, ranking });
  } catch (error) {
    console.error('获取学习时长排行榜失败:', error);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

/**
 * GET /api/v1/community/ranking/streak
 * 连续打卡排行榜
 * Query: limit (默认20)
 */
router.get('/ranking/streak', async (req, res) => {
  try {
    const { limit = '20' } = req.query;
    const client = getSupabaseClient();
    
    // 获取每个用户最新的打卡记录
    const { data: checkIns, error } = await client
      .from('check_ins')
      .select('user_id, streak_days, check_date')
      .order('check_date', { ascending: false });
    
    if (error) throw error;
    
    // 获取每个用户的最大连续天数
    const userStreakMap = new Map<string, { streak: number; last_date: string }>();
    const today = getTodayString();
    
    checkIns?.forEach(ci => {
      if (!ci.user_id) return;
      const existing = userStreakMap.get(ci.user_id);
      if (!existing || ci.check_date > existing.last_date) {
        userStreakMap.set(ci.user_id, {
          streak: ci.streak_days || 1,
          last_date: ci.check_date
        });
      }
    });
    
    // 过滤掉连续天数已断的用户
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // 获取用户信息
    const userIds = Array.from(userStreakMap.keys());
    let userInfoMap = new Map();
    
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, username')
        .in('id', userIds);
      
      const { data: profiles } = await client
        .from('user_profiles')
        .select('user_id, avatar_url, show_in_ranking')
        .in('user_id', userIds);
      
      users?.forEach(u => {
        const profile = profiles?.find(p => p.user_id === u.id);
        userInfoMap.set(u.id, {
          nickname: u.nickname || u.username || `用户${u.id.slice(-6)}`,
          avatar_url: profile?.avatar_url,
          show_in_ranking: profile?.show_in_ranking !== false
        });
      });
    }
    
    // 排序并返回
    const limitNum = parseInt(limit as string, 10) || 20;
    const ranking = Array.from(userStreakMap.entries())
      .filter(([userId, data]) => {
        const userInfo = userInfoMap.get(userId);
        return userInfo?.show_in_ranking !== false && 
               (data.last_date === today || data.last_date === yesterdayStr);
      })
      .map(([userId, data]) => ({
        user_id: userId,
        nickname: userInfoMap.get(userId)?.nickname || `用户${userId.slice(-6)}`,
        avatar_url: userInfoMap.get(userId)?.avatar_url,
        streak_days: data.streak
      }))
      .sort((a, b) => b.streak_days - a.streak_days)
      .slice(0, limitNum)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    res.json({ success: true, ranking });
  } catch (error) {
    console.error('获取连续打卡排行榜失败:', error);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

/**
 * GET /api/v1/community/ranking/accuracy
 * 正确率排行榜（本周，需完成一定量句子）
 * Query: limit (默认20), min_sentences (默认10)
 */
router.get('/ranking/accuracy', async (req, res) => {
  try {
    const { limit = '20', min_sentences = '10' } = req.query;
    const client = getSupabaseClient();
    
    const weekStart = getWeekStart();
    const minSentences = parseInt(min_sentences as string, 10) || 10;
    
    // 获取本周学习记录
    const { data: learningStats, error } = await client
      .from('learning_stats')
      .select('user_id, words_correct, words_total')
      .gte('created_at', weekStart);
    
    if (error) throw error;
    
    // 计算每个用户的正确率和句子数
    const userStatsMap = new Map<string, { 
      total_correct: number; 
      total_words: number; 
      sentence_count: number 
    }>();
    
    learningStats?.forEach(stat => {
      if (!stat.user_id) return;
      const existing = userStatsMap.get(stat.user_id) || {
        total_correct: 0,
        total_words: 0,
        sentence_count: 0
      };
      existing.total_correct += stat.words_correct || 0;
      existing.total_words += stat.words_total || 0;
      existing.sentence_count += 1;
      userStatsMap.set(stat.user_id, existing);
    });
    
    // 获取用户信息
    const userIds = Array.from(userStatsMap.keys());
    let userInfoMap = new Map();
    
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, username')
        .in('id', userIds);
      
      const { data: profiles } = await client
        .from('user_profiles')
        .select('user_id, avatar_url, show_in_ranking')
        .in('user_id', userIds);
      
      users?.forEach(u => {
        const profile = profiles?.find(p => p.user_id === u.id);
        userInfoMap.set(u.id, {
          nickname: u.nickname || u.username || `用户${u.id.slice(-6)}`,
          avatar_url: profile?.avatar_url,
          show_in_ranking: profile?.show_in_ranking !== false
        });
      });
    }
    
    // 排序并返回
    const limitNum = parseInt(limit as string, 10) || 20;
    const ranking = Array.from(userStatsMap.entries())
      .filter(([userId, stats]) => {
        const userInfo = userInfoMap.get(userId);
        return userInfo?.show_in_ranking !== false && 
               stats.sentence_count >= minSentences &&
               stats.total_words > 0;
      })
      .map(([userId, stats]) => ({
        user_id: userId,
        nickname: userInfoMap.get(userId)?.nickname || `用户${userId.slice(-6)}`,
        avatar_url: userInfoMap.get(userId)?.avatar_url,
        accuracy: Math.round((stats.total_correct / stats.total_words) * 100),
        sentence_count: stats.sentence_count
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, limitNum)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    
    res.json({ success: true, ranking });
  } catch (error) {
    console.error('获取正确率排行榜失败:', error);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// ==================== 动态相关 API ====================

/**
 * POST /api/v1/community/posts
 * 发布动态
 * Body: { user_id: string, content: string, topic_id?: number, post_type?: string, metadata?: object }
 */
router.post('/posts', async (req, res) => {
  try {
    const { user_id, content, topic_id, post_type, metadata } = req.body;
    
    if (!user_id || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = getSupabaseClient();
    
    const { data: post, error } = await client
      .from('posts')
      .insert({
        user_id,
        content,
        topic_id: topic_id || null,
        post_type: post_type || 'dynamic',
        metadata: metadata ? JSON.stringify(metadata) : null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // 更新话题帖子数
    if (topic_id) {
      await client.rpc('increment_topic_post_count', { topic_id });
    }
    
    res.json({ success: true, post });
  } catch (error) {
    console.error('发布动态失败:', error);
    res.status(500).json({ error: '发布动态失败' });
  }
});

/**
 * GET /api/v1/community/posts
 * 获取动态列表
 * Query: topic_id?, user_id?, page?, limit?
 */
router.get('/posts', async (req, res) => {
  try {
    const { topic_id, user_id, page = '1', limit = '20' } = req.query;
    const client = getSupabaseClient();
    
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const offset = (pageNum - 1) * limitNum;
    
    let query = client
      .from('posts')
      .select(`
        id,
        content,
        post_type,
        metadata,
        like_count,
        comment_count,
        created_at,
        user_id,
        topics (id, title)
      `)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    
    if (topic_id) {
      query = query.eq('topic_id', topic_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    
    const { data: posts, error } = await query;
    
    if (error) throw error;
    
    // 获取用户信息
    const userIds = [...new Set(posts?.map(p => p.user_id) || [])];
    let userInfoMap = new Map();
    
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, username')
        .in('id', userIds);
      
      const { data: profiles } = await client
        .from('user_profiles')
        .select('user_id, avatar_url')
        .in('user_id', userIds);
      
      users?.forEach(u => {
        const profile = profiles?.find(p => p.user_id === u.id);
        userInfoMap.set(u.id, {
          nickname: u.nickname || u.username || `用户${u.id.slice(-6)}`,
          avatar_url: profile?.avatar_url
        });
      });
    }
    
    // 检查当前用户是否已点赞
    const currentUserId = req.headers['x-user-id'] as string;
    let likedPostIds = new Set<number>();
    
    if (currentUserId && posts && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const { data: likes } = await client
        .from('likes')
        .select('target_id')
        .eq('user_id', currentUserId)
        .eq('target_type', 'post')
        .in('target_id', postIds);
      
      likes?.forEach(l => likedPostIds.add(l.target_id));
    }
    
    const postsWithUser = posts?.map(post => ({
      ...post,
      user: userInfoMap.get(post.user_id) || { nickname: '未知用户', avatar_url: null },
      is_liked: likedPostIds.has(post.id)
    })) || [];
    
    res.json({ success: true, posts: postsWithUser, page: pageNum, limit: limitNum });
  } catch (error) {
    console.error('获取动态列表失败:', error);
    res.status(500).json({ error: '获取动态列表失败' });
  }
});

/**
 * POST /api/v1/community/posts/:postId/like
 * 点赞/取消点赞动态
 * Body: { user_id: string }
 */
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 检查是否已点赞
    const { data: existingLike, error: checkError } = await client
      .from('likes')
      .select('id')
      .eq('user_id', user_id)
      .eq('target_type', 'post')
      .eq('target_id', parseInt(postId))
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existingLike) {
      // 取消点赞
      await client
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      
      // 更新点赞数
      await client
        .from('posts')
        .update({ like_count: client.rpc('decrement', { x: 1 }) })
        .eq('id', postId);
      
      res.json({ success: true, liked: false, message: '取消点赞' });
    } else {
      // 添加点赞
      await client
        .from('likes')
        .insert({
          user_id,
          target_type: 'post',
          target_id: parseInt(postId)
        });
      
      // 更新点赞数
      const { data: post } = await client
        .from('posts')
        .select('like_count')
        .eq('id', postId)
        .single();
      
      await client
        .from('posts')
        .update({ like_count: (post?.like_count || 0) + 1 })
        .eq('id', postId);
      
      res.json({ success: true, liked: true, message: '点赞成功' });
    }
  } catch (error) {
    console.error('点赞操作失败:', error);
    res.status(500).json({ error: '点赞操作失败' });
  }
});

/**
 * POST /api/v1/community/posts/:postId/comments
 * 发布评论
 * Body: { user_id: string, content: string, parent_id?: number }
 */
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id, content, parent_id } = req.body;
    
    if (!user_id || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = getSupabaseClient();
    
    const { data: comment, error } = await client
      .from('comments')
      .insert({
        post_id: parseInt(postId),
        user_id,
        content,
        parent_id: parent_id || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // 更新评论数
    const { data: post } = await client
      .from('posts')
      .select('comment_count')
      .eq('id', postId)
      .single();
    
    await client
      .from('posts')
      .update({ comment_count: (post?.comment_count || 0) + 1 })
      .eq('id', postId);
    
    res.json({ success: true, comment });
  } catch (error) {
    console.error('发布评论失败:', error);
    res.status(500).json({ error: '发布评论失败' });
  }
});

/**
 * GET /api/v1/community/posts/:postId/comments
 * 获取评论列表
 */
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const client = getSupabaseClient();
    
    const { data: comments, error } = await client
      .from('comments')
      .select(`
        id,
        content,
        like_count,
        created_at,
        user_id,
        parent_id
      `)
      .eq('post_id', parseInt(postId))
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // 获取用户信息
    const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
    let userInfoMap = new Map();
    
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, username')
        .in('id', userIds);
      
      const { data: profiles } = await client
        .from('user_profiles')
        .select('user_id, avatar_url')
        .in('user_id', userIds);
      
      users?.forEach(u => {
        const profile = profiles?.find(p => p.user_id === u.id);
        userInfoMap.set(u.id, {
          nickname: u.nickname || u.username || `用户${u.id.slice(-6)}`,
          avatar_url: profile?.avatar_url
        });
      });
    }
    
    const commentsWithUser = comments?.map(comment => ({
      ...comment,
      user: userInfoMap.get(comment.user_id) || { nickname: '未知用户', avatar_url: null }
    })) || [];
    
    res.json({ success: true, comments: commentsWithUser });
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({ error: '获取评论列表失败' });
  }
});

// ==================== 话题相关 API ====================

/**
 * GET /api/v1/community/topics
 * 获取话题列表
 */
router.get('/topics', async (req, res) => {
  try {
    const client = getSupabaseClient();
    
    const { data: topics, error } = await client
      .from('topics')
      .select('*')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, topics: topics || [] });
  } catch (error) {
    console.error('获取话题列表失败:', error);
    res.status(500).json({ error: '获取话题列表失败' });
  }
});

/**
 * GET /api/v1/community/topics/:topicId
 * 获取话题详情
 */
router.get('/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const client = getSupabaseClient();
    
    const { data: topic, error } = await client
      .from('topics')
      .select('*')
      .eq('id', parseInt(topicId))
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, topic });
  } catch (error) {
    console.error('获取话题详情失败:', error);
    res.status(500).json({ error: '获取话题详情失败' });
  }
});

// ==================== 自动生成动态 API ====================

/**
 * POST /api/v1/community/auto-post/learning
 * 自动生成学习动态
 * Body: { user_id: string, type: string, data: object }
 * type: 'complete_lesson' | 'conquer_words' | 'streak_achieved' | 'daily_summary'
 */
router.post('/auto-post/learning', async (req, res) => {
  try {
    const { user_id, type, data } = req.body;
    
    if (!user_id || !type) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    let content = '';
    let metadata: Record<string, unknown> = { type, ...data };
    
    switch (type) {
      case 'complete_lesson':
        content = `完成了《${data.course_title || '课程'}》第${data.lesson_number || 1}课，正确率 ${data.accuracy || 0}% 🎉`;
        break;
      case 'conquer_words':
        content = `今日攻克了 ${data.word_count || 0} 个薄弱词汇 💪`;
        break;
      case 'streak_achieved':
        content = `已连续打卡 ${data.streak_days || 1} 天！坚持就是胜利 🔥`;
        break;
      case 'daily_summary':
        content = `今天学习了 ${(data.duration_minutes || 0)} 分钟，完成 ${data.sentences || 0} 句。继续加油！📚`;
        break;
      default:
        return res.status(400).json({ error: '无效的动态类型' });
    }
    
    const client = getSupabaseClient();
    
    const { data: post, error } = await client
      .from('posts')
      .insert({
        user_id,
        content,
        post_type: 'achievement',
        metadata: JSON.stringify(metadata)
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, post });
  } catch (error) {
    console.error('自动生成动态失败:', error);
    res.status(500).json({ error: '自动生成动态失败' });
  }
});

export default router;
