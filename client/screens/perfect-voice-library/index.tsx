import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  Text, 
  Alert, 
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing } from '@/constants/theme';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Recording {
  id: number;
  user_id: string;
  user_nickname?: string;
  sentence_id: number;
  sentence_file_id?: number;
  sentence_text: string;
  audio_key: string;
  audio_url?: string;
  duration_seconds: number;
  is_favorite: boolean;
  is_shared: boolean;
  created_at: string;
}

interface Stats {
  totalCount: number;
  favoriteCount: number;
  sharedCount: number;
  uniqueSentenceCount: number;
  badgeLevel: number;
  badgeName: string;
  nextBadgeThreshold: number | null;
}

type FilterType = 'all' | 'favorite' | 'shared';

export default function PerfectVoiceLibraryScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/stats?userId=${user.id}`
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, [user?.id]);

  // 获取录音列表
  const fetchRecordings = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    if (!user?.id) return;
    
    if (refresh) {
      setRefreshing(true);
    } else if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const favoriteOnly = filter === 'favorite';
      const sharedOnly = filter === 'shared';
      
      let url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings?userId=${user.id}&page=${pageNum}&pageSize=20`;
      if (favoriteOnly) {
        url += '&favoriteOnly=true';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        if (refresh || pageNum === 1) {
          setRecordings(data.data || []);
        } else {
          setRecordings(prev => [...prev, ...(data.data || [])]);
        }
        setHasMore(data.pagination.page < data.pagination.totalPages);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('获取录音列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.id, filter]);

  // 初始加载
  useFocusEffect(
    useCallback(() => {
      fetchStats();
      fetchRecordings(1);
    }, [fetchStats, fetchRecordings])
  );

  // 筛选变化时重新加载
  useEffect(() => {
    if (user?.id) {
      fetchRecordings(1);
    }
  }, [filter]);

  // 下拉刷新
  const handleRefresh = () => {
    fetchStats();
    fetchRecordings(1, true);
  };

  // 加载更多
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchRecordings(page + 1);
    }
  };

  // 播放录音
  const playRecording = async (record: Recording) => {
    try {
      // 如果正在播放同一个，则停止
      if (playingId === record.id) {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingId(null);
        return;
      }
      
      // 停止之前的播放
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      if (!record.audio_url) {
        Alert.alert('错误', '音频地址无效');
        return;
      }
      
      const { sound } = await Audio.Sound.createAsync({ uri: record.audio_url });
      soundRef.current = sound;
      setPlayingId(record.id);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setPlayingId(null);
        }
      });
      
      await sound.playAsync();
    } catch (error) {
      console.error('播放失败:', error);
      Alert.alert('播放失败', '无法播放该录音');
      setPlayingId(null);
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (record: Recording) => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/${record.id}/favorite`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            isFavorite: !record.is_favorite,
          }),
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setRecordings(prev => 
          prev.map(r => r.id === record.id ? { ...r, is_favorite: !r.is_favorite } : r)
        );
        fetchStats(); // 刷新统计
      }
    } catch (error) {
      console.error('切换收藏失败:', error);
      Alert.alert('错误', '操作失败');
    }
  };

  // 切换分享状态
  const toggleShare = async (record: Recording) => {
    const newShared = !record.is_shared;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/${record.id}/share`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            isShared: newShared,
          }),
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setRecordings(prev => 
          prev.map(r => r.id === record.id ? { ...r, is_shared: newShared } : r)
        );
        fetchStats(); // 刷新统计
        
        Alert.alert(
          '成功',
          newShared ? '已分享，其他用户学习该句时可以听到您的发音' : '已取消分享'
        );
      }
    } catch (error) {
      console.error('切换分享失败:', error);
      Alert.alert('错误', '操作失败');
    }
  };

  // 删除录音
  const deleteRecording = (record: Recording) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条录音吗？删除后无法恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/${record.id}?userId=${user?.id}`,
                { method: 'DELETE' }
              );
              
              const data = await response.json();
              if (data.success) {
                setRecordings(prev => prev.filter(r => r.id !== record.id));
                fetchStats(); // 刷新统计
                Alert.alert('成功', '已删除');
              }
            } catch (error) {
              console.error('删除失败:', error);
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  // 计算进度
  const progressPercent = stats?.nextBadgeThreshold 
    ? Math.min((stats.totalCount / stats.nextBadgeThreshold) * 100, 100)
    : 100;

  // 清理音频
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  if (!user) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ThemedText variant="body" color={theme.textMuted}>请先登录</ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* 统计卡片 */}
        {stats && (
          <View style={styles.statsSection}>
            <View style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <View style={styles.statsTitle}>
                  <FontAwesome6 name="star" size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600' }}>
                    完美发音库
                  </Text>
                </View>
                {stats.badgeName && (
                  <View style={styles.badgeContainer}>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '500' }}>
                      {stats.badgeName}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.statsNumbers}>
                <View style={styles.statItem}>
                  <FontAwesome6 name="microphone" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '700', marginTop: 4 }}>
                    {stats.totalCount}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                    总录音
                  </Text>
                </View>
                
                <View style={styles.statItem}>
                  <FontAwesome6 name="star" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '700', marginTop: 4 }}>
                    {stats.favoriteCount}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                    已收藏
                  </Text>
                </View>
                
                <View style={styles.statItem}>
                  <FontAwesome6 name="share" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '700', marginTop: 4 }}>
                    {stats.sharedCount}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                    已分享
                  </Text>
                </View>
              </View>
              
              {/* 进度条 */}
              {stats.nextBadgeThreshold && (
                <View style={styles.progressSection}>
                  <View style={styles.progressLabel}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                      距离下一个徽章
                    </Text>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>
                      {stats.totalCount} / {stats.nextBadgeThreshold}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* 筛选标签 */}
        <View style={styles.filterSection}>
          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={{ 
                color: filter === 'all' ? theme.buttonPrimaryText : theme.textSecondary,
                fontWeight: '500',
              }}>
                全部
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'favorite' && styles.filterTabActive]}
              onPress={() => setFilter('favorite')}
            >
              <Text style={{ 
                color: filter === 'favorite' ? theme.buttonPrimaryText : theme.textSecondary,
                fontWeight: '500',
              }}>
                已收藏
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'shared' && styles.filterTabActive]}
              onPress={() => setFilter('shared')}
            >
              <Text style={{ 
                color: filter === 'shared' ? theme.buttonPrimaryText : theme.textSecondary,
                fontWeight: '500',
              }}>
                已分享
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 录音列表 */}
        <View style={styles.listSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : recordings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <FontAwesome6 name="microphone-slash" size={48} color={theme.textMuted} />
              </View>
              <ThemedText variant="body" color={theme.textMuted}>
                {filter === 'all' ? '暂无完美发音记录' : 
                 filter === 'favorite' ? '暂无收藏记录' : '暂无分享记录'}
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.sm }}>
                学习句子时，一遍过即可保存完美发音
              </ThemedText>
            </View>
          ) : (
            <>
              {recordings.map((record) => (
                <View 
                  key={record.id} 
                  style={[
                    styles.recordingItem, 
                    record.is_favorite && styles.recordingItemFavorite
                  ]}
                >
                  <View style={styles.recordingHeader}>
                    <ThemedText 
                      variant="body" 
                      color={theme.textPrimary} 
                      style={styles.sentenceText}
                      numberOfLines={2}
                    >
                      {record.sentence_text}
                    </ThemedText>
                    <View style={styles.recordingActions}>
                      {/* 收藏按钮 */}
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.actionBtnFavorite,
                          record.is_favorite && styles.actionBtnFavoriteActive,
                        ]}
                        onPress={() => toggleFavorite(record)}
                      >
                        <FontAwesome6 
                          name={record.is_favorite ? 'star' : 'star'} 
                          size={14} 
                          color={record.is_favorite ? '#FFF' : theme.accent} 
                        />
                      </TouchableOpacity>
                      
                      {/* 分享按钮 */}
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.actionBtnShare,
                          record.is_shared && styles.actionBtnShareActive,
                        ]}
                        onPress={() => toggleShare(record)}
                      >
                        <FontAwesome6 
                          name="share" 
                          size={14} 
                          color={record.is_shared ? '#FFF' : theme.primary} 
                        />
                      </TouchableOpacity>
                      
                      {/* 删除按钮 */}
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDelete]}
                        onPress={() => deleteRecording(record)}
                      >
                        <FontAwesome6 name="trash" size={14} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.recordingMeta}>
                    <View style={styles.metaItem}>
                      <FontAwesome6 name="clock" size={12} color={theme.textMuted} />
                      <ThemedText variant="small" color={theme.textMuted}>
                        {record.duration_seconds > 0 
                          ? `${record.duration_seconds}秒` 
                          : '未知时长'}
                      </ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <FontAwesome6 name="calendar" size={12} color={theme.textMuted} />
                      <ThemedText variant="small" color={theme.textMuted}>
                        {new Date(record.created_at).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    {record.is_shared && (
                      <View style={styles.metaItem}>
                        <FontAwesome6 name="users" size={12} color={theme.primary} />
                        <ThemedText variant="small" color={theme.primary}>
                          已公开
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  
                  {/* 播放按钮 */}
                  <TouchableOpacity 
                    style={styles.playButton}
                    onPress={() => playRecording(record)}
                  >
                    <FontAwesome6 
                      name={playingId === record.id ? 'stop' : 'play'} 
                      size={16} 
                      color={theme.primary} 
                    />
                    <ThemedText variant="body" color={theme.primary}>
                      {playingId === record.id ? '停止' : '播放'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* 加载更多 */}
              {hasMore && (
                <TouchableOpacity 
                  style={styles.loadMoreBtn}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <ThemedText variant="body" color={theme.primary}>
                      加载更多
                    </ThemedText>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
