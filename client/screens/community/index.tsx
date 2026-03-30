import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

// 类型定义
interface CheckInStatus {
  today_checked: boolean;
  streak_days: number;
  month_check_ins: string[];
}

interface RankingUser {
  user_id: string;
  nickname: string;
  avatar_url?: string;
  rank: number;
  total_duration?: number;
  total_hours?: number;
  streak_days?: number;
  accuracy?: number;
  sentence_count?: number;
}

interface Post {
  id: number;
  content: string;
  post_type: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  user_id: string;
  user: {
    nickname: string;
    avatar_url?: string;
  };
  topics?: {
    id: number;
    title: string;
  };
  is_liked?: boolean;
}

interface Topic {
  id: number;
  title: string;
  description?: string;
  post_count: number;
}

type RankingTab = 'study_time' | 'streak' | 'accuracy';

export default function CommunityScreen() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // 状态
  const [refreshing, setRefreshing] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus | null>(null);
  const [rankingTab, setRankingTab] = useState<RankingTab>('study_time');
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  
  // 弹窗状态
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');

  // 获取打卡状态
  const fetchCheckInStatus = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/check-in/status?user_id=${user.id}`
      );
      const data = await response.json();
      if (data.success) {
        setCheckInStatus(data);
      }
    } catch (error) {
      console.error('获取打卡状态失败:', error);
    }
  };

  // 获取排行榜
  const fetchRanking = async () => {
    try {
      const endpoint = rankingTab === 'study_time' 
        ? 'ranking/study-time'
        : rankingTab === 'streak'
        ? 'ranking/streak'
        : 'ranking/accuracy';
      
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/${endpoint}?limit=10`
      );
      const data = await response.json();
      if (data.success) {
        setRanking(data.ranking);
      }
    } catch (error) {
      console.error('获取排行榜失败:', error);
    }
  };

  // 获取话题列表
  const fetchTopics = async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/topics`
      );
      const data = await response.json();
      if (data.success) {
        setTopics(data.topics);
      }
    } catch (error) {
      console.error('获取话题失败:', error);
    }
  };

  // 获取动态列表
  const fetchPosts = async () => {
    try {
      let url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/posts?limit=20`;
      if (selectedTopic) {
        url += `&topic_id=${selectedTopic}`;
      }
      
      const response = await fetch(url, {
        headers: user?.id ? { 'x-user-id': user.id } : {},
      });
      const data = await response.json();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('获取动态失败:', error);
    }
  };

  // 初始化加载
  useEffect(() => {
    if (isAuthenticated) {
      fetchCheckInStatus();
    }
    fetchRanking();
    fetchTopics();
    fetchPosts();
  }, [isAuthenticated, rankingTab, selectedTopic]);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchCheckInStatus(),
      fetchRanking(),
      fetchTopics(),
      fetchPosts(),
    ]);
    setRefreshing(false);
  };

  // 打卡
  const handleCheckIn = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/check-in`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        }
      );
      const data = await response.json();
      if (data.success) {
        fetchCheckInStatus();
      }
    } catch (error) {
      console.error('打卡失败:', error);
    }
  };

  // 点赞
  const handleLike = async (postId: number, isLiked: boolean) => {
    if (!user?.id) return;
    try {
      await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/posts/${postId}/like`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        }
      );
      fetchPosts();
    } catch (error) {
      console.error('点赞失败:', error);
    }
  };

  // 发布动态
  const handlePost = async () => {
    if (!user?.id || !postContent.trim()) return;
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            content: postContent.trim(),
            topic_id: selectedTopic,
          }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setPostContent('');
        setShowPostModal(false);
        fetchPosts();
      }
    } catch (error) {
      console.error('发布动态失败:', error);
    }
  };

  // 获取评论
  const fetchComments = async (postId: number) => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/posts/${postId}/comments`
      );
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('获取评论失败:', error);
    }
  };

  // 发表评论
  const handleComment = async () => {
    if (!user?.id || !commentText.trim() || !selectedPostId) return;
    try {
      await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/community/posts/${selectedPostId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            content: commentText.trim(),
          }),
        }
      );
      setCommentText('');
      fetchComments(selectedPostId);
      fetchPosts();
    } catch (error) {
      console.error('发表评论失败:', error);
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return dateStr.split('T')[0];
  };

  // 渲染打卡日历
  const renderCalendar = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isChecked = checkInStatus?.month_check_ins?.includes(dateStr);
      const isToday = i === today.getDate();
      
      days.push(
        <View
          key={i}
          style={[
            styles.calendarDay,
            isChecked && styles.calendarDayChecked,
            isToday && !isChecked && styles.calendarDayToday,
          ]}
        >
          <Text style={[
            styles.calendarDayText,
            isChecked && styles.calendarDayTextChecked,
          ]}>
            {i}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarWeekDays}>
          {weekDays.map((day, index) => (
            <Text key={index} style={styles.weekDayText}>{day}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>{days}</View>
      </View>
    );
  };

  // 渲染排行榜项
  const renderRankingItem = ({ item, index }: { item: RankingUser; index: number }) => {
    const isTop3 = item.rank <= 3;
    const badgeStyle = item.rank === 1 ? styles.rankBadge1 
      : item.rank === 2 ? styles.rankBadge2 
      : item.rank === 3 ? styles.rankBadge3 
      : styles.rankBadgeOther;

    let valueText = '';
    if (rankingTab === 'study_time') {
      valueText = `${item.total_hours?.toFixed(1) || 0}h`;
    } else if (rankingTab === 'streak') {
      valueText = `${item.streak_days || 0}天`;
    } else {
      valueText = `${item.accuracy || 0}%`;
    }

    return (
      <View style={[styles.rankingItem, index === ranking.length - 1 && styles.rankingItemLast]}>
        <View style={[styles.rankBadge, badgeStyle]}>
          <Text style={[styles.rankText, !isTop3 && styles.rankTextOther]}>
            {item.rank}
          </Text>
        </View>
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/36' }}
          style={styles.avatar}
        />
        <View style={styles.rankingUserInfo}>
          <ThemedText variant="smallMedium" color={theme.textPrimary}>
            {item.nickname}
          </ThemedText>
        </View>
        <ThemedText variant="bodyMedium" color={theme.primary}>
          {valueText}
        </ThemedText>
      </View>
    );
  };

  // 渲染动态项
  const renderPostItem = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image
          source={{ uri: item.user?.avatar_url || 'https://via.placeholder.com/40' }}
          style={styles.postAvatar}
        />
        <View style={styles.postUserInfo}>
          <ThemedText variant="smallMedium" color={theme.textPrimary}>
            {item.user?.nickname || '匿名用户'}
          </ThemedText>
          <ThemedText variant="tiny" color={theme.textMuted}>
            {formatTime(item.created_at)}
          </ThemedText>
        </View>
      </View>
      <ThemedText variant="body" color={theme.textPrimary} style={styles.postContent}>
        {item.content}
      </ThemedText>
      {item.topics && (
        <ThemedText variant="small" color={theme.primary} style={styles.postTopic}>
          #{item.topics.title}
        </ThemedText>
      )}
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id, item.is_liked || false)}
        >
          <FontAwesome6 
            name={item.is_liked ? "heart" : "heart"} 
            size={16} 
            color={item.is_liked ? theme.error : theme.textMuted} 
            solid={item.is_liked}
          />
          <Text style={[styles.actionText, item.is_liked && styles.actionTextLiked]}>
            {item.like_count || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            setSelectedPostId(item.id);
            fetchComments(item.id);
            setShowCommentsModal(true);
          }}
        >
          <FontAwesome6 name="comment" size={16} color={theme.textMuted} />
          <Text style={styles.actionText}>{item.comment_count || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <FontAwesome6 name="users" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: Spacing.md }}>
            请登录后查看社区内容
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* 打卡卡片 */}
        <View style={styles.checkInCard}>
          <View style={styles.checkInHeader}>
            <View style={styles.checkInLeft}>
              <View style={styles.checkInIcon}>
                <FontAwesome6 name="fire" size={24} color={theme.primary} />
              </View>
              <View style={styles.checkInInfo}>
                <Text style={styles.streakNumber}>{checkInStatus?.streak_days || 0}</Text>
                <Text style={styles.streakLabel}>连续打卡天数</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.checkInButton, checkInStatus?.today_checked && styles.checkInButtonDisabled]}
              onPress={handleCheckIn}
              disabled={checkInStatus?.today_checked}
            >
              <Text style={styles.checkInButtonText}>
                {checkInStatus?.today_checked ? '已打卡' : '打卡'}
              </Text>
            </TouchableOpacity>
          </View>
          {renderCalendar()}
        </View>

        {/* 排行榜 */}
        <View style={styles.rankingSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}>
              <FontAwesome6 name="trophy" size={18} color={theme.primary} style={{ marginRight: 8 }} />
              <ThemedText variant="h4" color={theme.textPrimary}>排行榜</ThemedText>
            </View>
          </View>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, rankingTab === 'study_time' && styles.tabActive]}
              onPress={() => setRankingTab('study_time')}
            >
              <Text style={[styles.tabText, rankingTab === 'study_time' && styles.tabTextActive]}>
                勤奋榜
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, rankingTab === 'streak' && styles.tabActive]}
              onPress={() => setRankingTab('streak')}
            >
              <Text style={[styles.tabText, rankingTab === 'streak' && styles.tabTextActive]}>
                坚持榜
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, rankingTab === 'accuracy' && styles.tabActive]}
              onPress={() => setRankingTab('accuracy')}
            >
              <Text style={[styles.tabText, rankingTab === 'accuracy' && styles.tabTextActive]}>
                学霸榜
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rankingCard}>
            <FlatList
              data={ranking}
              renderItem={renderRankingItem}
              keyExtractor={(item) => item.user_id}
              scrollEnabled={false}
            />
          </View>
        </View>

        {/* 话题 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <FontAwesome6 name="hashtag" size={18} color={theme.accent} style={{ marginRight: 8 }} />
            <ThemedText variant="h4" color={theme.textPrimary}>热门话题</ThemedText>
          </View>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.topicsScroll}
        >
          <TouchableOpacity
            style={[styles.topicTag, selectedTopic === null && styles.topicTagActive]}
            onPress={() => setSelectedTopic(null)}
          >
            <Text style={[styles.topicTagText, selectedTopic === null && styles.topicTagTextActive]}>
              全部
            </Text>
          </TouchableOpacity>
          {topics.map((topic) => (
            <TouchableOpacity
              key={topic.id}
              style={[styles.topicTag, selectedTopic === topic.id && styles.topicTagActive]}
              onPress={() => setSelectedTopic(topic.id)}
            >
              <Text style={[styles.topicTagText, selectedTopic === topic.id && styles.topicTagTextActive]}>
                #{topic.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 动态列表 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <FontAwesome6 name="comments" size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <ThemedText variant="h4" color={theme.textPrimary}>最新动态</ThemedText>
          </View>
          <TouchableOpacity onPress={() => setShowPostModal(true)}>
            <FontAwesome6 name="plus" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome6 name="inbox" size={48} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted} style={styles.emptyText}>
                暂无动态，快来发布第一条吧
              </ThemedText>
            </View>
          }
        />
      </ScrollView>

      {/* 发布动态弹窗 */}
      <Modal
        visible={showPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>发布动态</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={[styles.commentTextInput, { height: 120, textAlignVertical: 'top' }]}
                placeholder="分享你的学习心得..."
                placeholderTextColor={theme.textMuted}
                multiline
                value={postContent}
                onChangeText={setPostContent}
              />
              <TouchableOpacity
                style={[styles.checkInButton, { marginTop: Spacing.md, alignSelf: 'flex-end' }]}
                onPress={handlePost}
              >
                <Text style={styles.checkInButtonText}>发布</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 评论弹窗 */}
      <Modal
        visible={showCommentsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>评论 ({comments.length})</Text>
              <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <View style={{ flexDirection: 'row', marginBottom: Spacing.md }}>
                    <Image
                      source={{ uri: item.user?.avatar_url || 'https://via.placeholder.com/32' }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <ThemedText variant="smallMedium" color={theme.textPrimary}>
                        {item.user?.nickname || '匿名用户'}
                      </ThemedText>
                      <ThemedText variant="small" color={theme.textSecondary} style={{ marginTop: 2 }}>
                        {item.content}
                      </ThemedText>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <ThemedText variant="small" color={theme.textMuted} style={{ textAlign: 'center' }}>
                    暂无评论
                  </ThemedText>
                }
              />
              <View style={styles.commentInput}>
                <FontAwesome6 name="comment" size={16} color={theme.textMuted} />
                <TextInput
                  style={styles.commentTextInput}
                  placeholder="写下你的评论..."
                  placeholderTextColor={theme.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                />
                <TouchableOpacity onPress={handleComment}>
                  <FontAwesome6 name="paper-plane" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
