import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';
import { LineChart } from 'react-native-gifted-charts';

interface Course {
  id: number;
  title: string;
}

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
  trend_data?: TrendDataPoint[];
}

interface TrendDataPoint {
  date: string;
  score: number;
  duration: number;
  sentences: number;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

/**
 * 学习监控页面
 * 显示课程学习者的学习情况和错题分析
 * 支持课程筛选、学习趋势图表、导出报告
 * 
 * 权限要求：仅 admin 或 teacher 角色可访问
 */
export default function LearningMonitorScreen() {
  const router = useSafeRouter();
  const { theme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // 权限检查：仅 admin 或 teacher 可访问
  const canAccess = user?.role === 'admin' || user?.role === 'teacher';

  // 课程筛选
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);

  // 学习者数据
  const [learners, setLearners] = useState<Learner[]>([]);
  const [totalSentences, setTotalSentences] = useState(0);
  const [loading, setLoading] = useState(true);

  // 详情Modal
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [learnerDetail, setLearnerDetail] = useState<LearnerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 导出状态
  const [exporting, setExporting] = useState(false);

  // 无权限时返回上一页
  useEffect(() => {
    if (!canAccess) {
      const timer = setTimeout(() => {
        router.back();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [canAccess]);

  // 获取课程列表
  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const data = await response.json();
      
      if (data.files) {
        setCourses(data.files.map((f: any) => ({ id: f.id, title: f.title || f.name })));
      }
    } catch (error) {
      console.error('获取课程列表失败:', error);
    }
  }, []);

  // 获取学习者列表
  const fetchLearners = useCallback(async () => {
    try {
      setLoading(true);
      let url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/learners`;
      if (selectedCourseId) {
        url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/course-learners/${selectedCourseId}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setLearners(data.learners);
        setTotalSentences(data.total_sentences);
      } else {
        setLearners([]);
        setTotalSentences(0);
      }
    } catch (error) {
      console.error('获取学习者列表失败:', error);
      setLearners([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  // 初始化加载
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 当课程选择变化时刷新学习者列表
  useFocusEffect(
    useCallback(() => {
      fetchLearners();
    }, [fetchLearners])
  );

  // 获取学习者详情（错题分析 + 趋势数据）
  const fetchLearnerDetail = async (learner: Learner) => {
    try {
      setDetailLoading(true);
      setSelectedLearner(learner);
      setShowDetailModal(true);
      
      // 获取错题分析
      const errorResponse = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/user-errors/${learner.user_id}`
      );
      const errorData = await errorResponse.json();
      
      // 获取趋势数据
      const trendResponse = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/user-trend/${learner.user_id}${selectedCourseId ? `?course_id=${selectedCourseId}` : ''}`
      );
      const trendData = await trendResponse.json();
      
      if (errorData.success) {
        setLearnerDetail({
          ...errorData,
          trend_data: trendData.success ? trendData.trend_data : [],
        });
      }
    } catch (error) {
      console.error('获取学习者详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 导出学习报告
  const handleExportReport = async () => {
    if (learners.length === 0) {
      Alert.alert('提示', '暂无数据可导出');
      return;
    }

    try {
      setExporting(true);
      
      // 生成报告内容
      const courseName = selectedCourseId 
        ? courses.find(c => c.id === selectedCourseId)?.title || '未知课程'
        : '所有课程';
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('zh-CN');
      
      let reportContent = `学习报告\n`;
      reportContent += `====================\n`;
      reportContent += `导出时间: ${dateStr}\n`;
      reportContent += `课程: ${courseName}\n`;
      reportContent += `学习者总数: ${learners.length}\n`;
      reportContent += `总句子数: ${totalSentences}\n`;
      reportContent += `\n学习者详情:\n`;
      reportContent += `--------------------\n`;
      
      learners.forEach((learner, index) => {
        reportContent += `\n${index + 1}. ${learner.nickname}\n`;
        reportContent += `   总积分: ${Math.round(learner.total_score)}\n`;
        reportContent += `   学习时长: ${learner.total_duration_minutes}分钟\n`;
        reportContent += `   完成句子: ${learner.sentences_completed}\n`;
        reportContent += `   学习天数: ${learner.learning_days}天\n`;
        reportContent += `   进度: ${learner.progress_percent}%\n`;
        reportContent += `   今日积分: ${Math.round(learner.today_score)}\n`;
        reportContent += `   今日时长: ${Math.round(learner.today_duration / 60)}分钟\n`;
        reportContent += `   今日句子: ${learner.today_sentences}\n`;
      });

      // 保存到文件
      const fileName = `学习报告_${dateStr.replace(/\//g, '-')}.txt`;
      const filePath = `${(FileSystem as any).documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, reportContent);
      
      // 分享文件
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert('成功', `报告已保存到: ${filePath}`);
      }
    } catch (error) {
      console.error('导出报告失败:', error);
      Alert.alert('错误', '导出报告失败，请重试');
    } finally {
      setExporting(false);
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

  // 渲染课程筛选器
  const renderCoursePicker = () => (
    <Modal
      visible={coursePickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCoursePickerVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContent}>
          <View style={styles.modalHeader}>
            <ThemedText variant="h4" color={theme.textPrimary}>选择课程</ThemedText>
            <TouchableOpacity onPress={() => setCoursePickerVisible(false)}>
              <FontAwesome6 name="times" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          
          <ScrollView>
            <TouchableOpacity
              style={[styles.pickerItem, selectedCourseId === null && styles.pickerItemSelected]}
              onPress={() => {
                setSelectedCourseId(null);
                setCoursePickerVisible(false);
              }}
            >
              <ThemedText 
                variant="bodyMedium" 
                color={selectedCourseId === null ? theme.primary : theme.textPrimary}
              >
                全部课程
              </ThemedText>
              {selectedCourseId === null && (
                <FontAwesome6 name="check" size={16} color={theme.primary} />
              )}
            </TouchableOpacity>
            
            {courses.map(course => (
              <TouchableOpacity
                key={course.id}
                style={[styles.pickerItem, selectedCourseId === course.id && styles.pickerItemSelected]}
                onPress={() => {
                  setSelectedCourseId(course.id);
                  setCoursePickerVisible(false);
                }}
              >
                <ThemedText 
                  variant="bodyMedium" 
                  color={selectedCourseId === course.id ? theme.primary : theme.textPrimary}
                >
                  {course.title}
                </ThemedText>
                {selectedCourseId === course.id && (
                  <FontAwesome6 name="check" size={16} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

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

  // 渲染趋势图表
  const renderTrendChart = () => {
    if (!learnerDetail?.trend_data || learnerDetail.trend_data.length === 0) {
      return (
        <View style={styles.emptyState}>
          <ThemedText variant="small" color={theme.textMuted}>暂无趋势数据</ThemedText>
        </View>
      );
    }

    const data = learnerDetail.trend_data.slice(-7); // 最近7天
    const chartData = data.map(d => ({
      value: d.score,
      label: d.date.slice(5), // MM-DD
    }));

    return (
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={280}
          height={150}
          color={theme.primary}
          thickness={2}
          curved
          initialSpacing={20}
          endSpacing={20}
          yAxisColor={theme.border}
          xAxisColor={theme.border}
          yAxisTextStyle={{ color: theme.textMuted, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 10 }}
          rulesColor={theme.borderLight}
          rulesType="solid"
          noOfSections={4}
          maxValue={Math.max(...chartData.map(d => d.value), 100)}
        />
      </View>
    );
  };

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

            {/* 学习趋势 */}
            <View style={{ marginBottom: Spacing.lg }}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitle}>
                  <FontAwesome6 name="chart-line" size={14} color={theme.primary} />
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    学习趋势（近7天积分）
                  </ThemedText>
                </View>
              </View>
              
              {detailLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: Spacing.lg }} />
              ) : renderTrendChart()}
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

  // 无权限时显示提示
  if (!canAccess) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.permissionDenied}>
          <FontAwesome6 name="lock" size={48} color={theme.textMuted} style={styles.emptyIcon} />
          <ThemedText variant="h4" color={theme.textPrimary} style={{ marginTop: Spacing.lg }}>
            无访问权限
          </ThemedText>
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: Spacing.sm, textAlign: 'center' }}>
            此功能仅限管理员和教师访问
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.md }}>
            正在返回上一页...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 标题与操作 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <FontAwesome6 name="users" size={18} color={theme.primary} />
            <ThemedText variant="h4" color={theme.textPrimary}>
              学习监控
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <TouchableOpacity 
              onPress={() => setCoursePickerVisible(true)}
              style={styles.actionButton}
            >
              <FontAwesome6 name="filter" size={16} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleExportReport}
              disabled={exporting}
              style={styles.actionButton}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <FontAwesome6 name="file-export" size={16} color={theme.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={fetchLearners}>
              <FontAwesome6 name="refresh" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 当前筛选 */}
        {selectedCourseId && (
          <View style={styles.filterTag}>
            <ThemedText variant="small" color={theme.primary}>
              {courses.find(c => c.id === selectedCourseId)?.title}
            </ThemedText>
            <TouchableOpacity onPress={() => setSelectedCourseId(null)}>
              <FontAwesome6 name="times" size={12} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}

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

      {/* 课程筛选Modal */}
      {renderCoursePicker()}

      {/* 详情Modal */}
      {renderDetailModal()}
    </Screen>
  );
}
