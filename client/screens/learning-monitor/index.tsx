import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { createStyles } from './styles';

interface Learner {
  user_id: string;
  nickname: string;
  total_score: number;
  total_duration_minutes: number;
  sentences_completed: number;
  learning_days: number;
  today_score: number;
  today_duration: number;
  today_sentences: number;
  progress_percent: number;
  last_learned_at: string | null;
}

interface WeakWord {
  word: string;
  error_count: number;
  example_sentences: string[];
}

interface LearnerDetail {
  weak_words: WeakWord[];
  total_errors: number;
}

/**
 * 学习监控页面
 * 显示课程学习者的学习情况和错题分析
 */
export default function LearningMonitorScreen() {
  const router = useSafeRouter();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // 从路由参数获取课程ID
  const params = useSafeSearchParams<{ courseId?: string }>();
  const courseId = params.courseId;

  // 状态
  const [learners, setLearners] = useState<Learner[]>([]);
  const [totalSentences, setTotalSentences] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [learnerDetail, setLearnerDetail] = useState<LearnerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 获取学习者列表
  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    fetchLearners();
  }, [courseId]);

  const fetchLearners = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/course-learners/${courseId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setLearners(data.learners);
        setTotalSentences(data.total_sentences);
      }
    } catch (error) {
      console.error('获取学习者列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取学习者详情（错题分析）
  const fetchLearnerDetail = async (learner: Learner) => {
    try {
      setDetailLoading(true);
      setSelectedLearner(learner);
      setShowDetailModal(true);
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/user-errors/${learner.user_id}`
      );
      const data = await response.json();
      
      if (data.success) {
        setLearnerDetail(data);
      }
    } catch (error) {
      console.error('获取学习者详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
  };

  // 获取排名颜色
  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700'; // 金色
    if (rank === 2) return '#C0C0C0'; // 银色
    if (rank === 3) return '#CD7F32'; // 铜色
    return theme.primary;
  };

  // 渲染学习者卡片
  const renderLearnerCard = (learner: Learner, index: number) => {
    const rank = index + 1;
    
    return (
      <TouchableOpacity
        key={learner.user_id}
        style={styles.learnerCard}
        onPress={() => fetchLearnerDetail(learner)}
        activeOpacity={0.7}
      >
        <View style={styles.learnerHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: getRankColor(rank) + '20' }]}>
            <FontAwesome6 
              name="user" 
              size={20} 
              color={getRankColor(rank)} 
            />
          </View>
          <View style={styles.learnerInfo}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.learnerName}>
              {learner.nickname}
            </ThemedText>
            <View style={styles.learnerMeta}>
              <View style={[styles.learnerRank, { backgroundColor: getRankColor(rank) + '20' }]}>
                <ThemedText variant="small" color={getRankColor(rank)}>
                  第{rank}名
                </ThemedText>
              </View>
              <ThemedText variant="small" color={theme.textMuted}>
                学习{learner.learning_days}天
              </ThemedText>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText variant="h4" color={theme.primary}>
              {Math.round(learner.total_score)}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              积分
            </ThemedText>
          </View>
        </View>

        {/* 进度条 */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <ThemedText variant="small" color={theme.textSecondary}>
              课程进度
            </ThemedText>
            <ThemedText variant="small" color={theme.primary}>
              {learner.progress_percent}%
            </ThemedText>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${learner.progress_percent}%` }
              ]} 
            />
          </View>
        </View>

        {/* 今日数据 */}
        <View style={styles.todayStats}>
          <View style={styles.todayItem}>
            <ThemedText variant="bodyMedium" color={theme.primary}>
              {Math.round(learner.today_score)}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              今日积分
            </ThemedText>
          </View>
          <View style={styles.todayItem}>
            <ThemedText variant="bodyMedium" color={theme.textSecondary}>
              {formatDuration(learner.today_duration)}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              今日时长
            </ThemedText>
          </View>
          <View style={styles.todayItem}>
            <ThemedText variant="bodyMedium" color={theme.success}>
              {learner.today_sentences}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              今日句子
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染错题卡片
  const renderWeakWord = (item: WeakWord, index: number) => (
    <View key={item.word + index} style={styles.errorCard}>
      <View style={styles.wordHeader}>
        <ThemedText variant="h4" color={theme.textPrimary} style={styles.wordText}>
          {item.word}
        </ThemedText>
        <View style={styles.errorBadge}>
          <ThemedText variant="small" color={theme.error}>
            错{item.error_count}次
          </ThemedText>
        </View>
      </View>
      {item.example_sentences.length > 0 && (
        <View style={styles.exampleSentence}>
          <ThemedText variant="small" color={theme.textMuted} numberOfLines={2}>
            例：{item.example_sentences[0]}
          </ThemedText>
        </View>
      )}
    </View>
  );

  // 详情Modal
  const renderDetailModal = () => (
    <Modal
      visible={showDetailModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDetailModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <ThemedText variant="h4" color={theme.textPrimary}>
              {selectedLearner?.nickname} 的学习情况
            </ThemedText>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <FontAwesome6 name="times" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* 总体统计 */}
            <View style={{ marginBottom: Spacing.lg }}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitle}>
                  <FontAwesome6 name="chart-simple" size={14} color={theme.primary} />
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    学习统计
                  </ThemedText>
                </View>
              </View>
              
              <View style={[styles.learnerCard, { marginBottom: Spacing.md }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  <View style={styles.todayItem}>
                    <ThemedText variant="h3" color={theme.primary}>
                      {Math.round(selectedLearner?.total_score || 0)}
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>总积分</ThemedText>
                  </View>
                  <View style={styles.todayItem}>
                    <ThemedText variant="h3" color={theme.textSecondary}>
                      {selectedLearner?.total_duration_minutes || 0}
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>学习分钟</ThemedText>
                  </View>
                  <View style={styles.todayItem}>
                    <ThemedText variant="h3" color={theme.success}>
                      {selectedLearner?.sentences_completed || 0}
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>完成句子</ThemedText>
                  </View>
                </View>
              </View>
            </View>

            {/* 薄弱单词 */}
            <View>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitle}>
                  <FontAwesome6 name="triangle-exclamation" size={14} color={theme.error} />
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    薄弱单词 ({learnerDetail?.total_errors || 0}个错误)
                  </ThemedText>
                </View>
              </View>

              {detailLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: Spacing.xl }} />
              ) : learnerDetail?.weak_words?.length ? (
                learnerDetail.weak_words.map((word, idx) => renderWeakWord(word, idx))
              ) : (
                <View style={styles.emptyState}>
                  <FontAwesome6 name="check-circle" size={48} color={theme.success} style={styles.emptyIcon} />
                  <ThemedText variant="body" color={theme.textMuted}>
                    太棒了！暂无薄弱单词
                  </ThemedText>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 标题 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <FontAwesome6 name="users" size={18} color={theme.primary} />
            <ThemedText variant="h4" color={theme.textPrimary}>
              学习者概览
            </ThemedText>
          </View>
          <TouchableOpacity onPress={fetchLearners}>
            <FontAwesome6 name="refresh" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 统计卡片 */}
        <ThemedView level="default" style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText variant="h2" color={theme.buttonPrimaryText}>
                {learners.length}
              </ThemedText>
              <ThemedText variant="small" color={theme.buttonPrimaryText}>
                学习者
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText variant="h2" color={theme.buttonPrimaryText}>
                {totalSentences}
              </ThemedText>
              <ThemedText variant="small" color={theme.buttonPrimaryText}>
                总句子
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* 学习者列表 */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing.xl }} />
        ) : learners.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome6 name="user-group" size={48} color={theme.textMuted} style={styles.emptyIcon} />
            <ThemedText variant="body" color={theme.textMuted}>
              暂无学习者数据
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.xs }}>
              分享课程给朋友开始学习吧
            </ThemedText>
          </View>
        ) : (
          learners.map((learner, index) => renderLearnerCard(learner, index))
        )}
      </ScrollView>

      {/* 详情Modal */}
      {renderDetailModal()}
    </Screen>
  );
}
