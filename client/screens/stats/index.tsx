import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, View, TouchableOpacity, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface StatsOverview {
  total_score: number;
  total_duration: number;
  total_sentences: number;
  learning_days: number;
  streak_days: number;
  today: {
    score: number;
    duration: number;
    sentences: number;
  };
}

interface FileStat {
  id: number;
  user_id: string;
  sentence_file_id: number;
  learn_count: number;
  total_duration: number;
  total_score: number;
  last_learned_at: string | null;
  sentence_files: {
    title: string;
    description: string | null;
    sourceType?: 'sentence_file' | 'lesson' | 'unknown';
    courseTitle?: string;
    lessonNumber?: number;
  } | null;
}

export default function StatsScreen() {
  const { theme, isDark } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [fileStats, setFileStats] = useState<FileStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 获取统计概览
      const overviewRes = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/overview?user_id=${user.id}`
      );
      const overviewData = await overviewRes.json();
      if (overviewData.success) {
        setOverview(overviewData.overview);
      }

      // 获取句库统计
      const filesRes = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/files?user_id=${user.id}`
      );
      const filesData = await filesRes.json();
      if (filesData.success) {
        setFileStats(filesData.file_stats || []);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchData();
      }
    }, [user?.id, fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${mins}分`;
  };

  // 格式化分数
  const formatScore = (score: number): string => {
    return Math.round(score).toLocaleString();
  };

  // 格式化日期
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '未学习';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  if (authLoading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.emptyContainer}>
          <FontAwesome6 name="chart-line" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textSecondary} style={styles.emptyText}>
            登录后查看学习统计
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* 今日概览 */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="h3" color={theme.textPrimary}>今日学习</ThemedText>
        </View>
        
        <View style={styles.todayCards}>
          <View style={[styles.statCard, { backgroundColor: theme.primary }]}>
            <FontAwesome6 name="star" size={20} color="#FFF" />
            <Text style={styles.statValue}>{formatScore(overview?.today.score || 0)}</Text>
            <Text style={styles.statLabel}>今日分数</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.success }]}>
            <FontAwesome6 name="clock" size={20} color="#FFF" />
            <Text style={styles.statValue}>{formatDuration(overview?.today.duration || 0)}</Text>
            <Text style={styles.statLabel}>学习时长</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.accent }]}>
            <FontAwesome6 name="circle-check" size={20} color="#FFF" />
            <Text style={styles.statValue}>{overview?.today.sentences || 0}</Text>
            <Text style={styles.statLabel}>完成句子</Text>
          </View>
        </View>

        {/* 总体统计 */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="h3" color={theme.textPrimary}>学习总览</ThemedText>
        </View>
        
        <View style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{formatScore(overview?.total_score || 0)}</Text>
              <Text style={styles.overviewLabel}>总分数</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{formatDuration(overview?.total_duration || 0)}</Text>
              <Text style={styles.overviewLabel}>总时长</Text>
            </View>
          </View>
          <View style={[styles.overviewRow, { borderTopWidth: 1, borderTopColor: theme.borderLight }]}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{overview?.streak_days || 0}</Text>
              <Text style={styles.overviewLabel}>连续天数</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{overview?.learning_days || 0}</Text>
              <Text style={styles.overviewLabel}>学习天数</Text>
            </View>
          </View>
        </View>

        {/* 句库学习记录 */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="h3" color={theme.textPrimary}>句库学习</ThemedText>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : fileStats.length === 0 ? (
          <View style={styles.emptyCard}>
            <ThemedText variant="body" color={theme.textMuted}>暂无学习记录</ThemedText>
          </View>
        ) : (
          <View style={styles.fileListCard}>
            {fileStats.map((stat, index) => (
              <View key={stat.id || index} style={[
                styles.fileItem,
                index < fileStats.length - 1 && styles.fileItemBorder
              ]}>
                <View style={[
                  styles.fileIconSmall,
                  stat.sentence_files?.sourceType === 'lesson' && { backgroundColor: theme.accent + '15' }
                ]}>
                  <FontAwesome6 
                    name={stat.sentence_files?.sourceType === 'lesson' ? 'graduation-cap' : 'book'} 
                    size={14} 
                    color={stat.sentence_files?.sourceType === 'lesson' ? theme.accent : theme.primary} 
                  />
                </View>
                <View style={styles.fileItemInfo}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} numberOfLines={1}>
                    {stat.sentence_files?.title || '未知句库'}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    已学{stat.learn_count}次 · {formatDate(stat.last_learned_at)}
                  </ThemedText>
                </View>
                <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
