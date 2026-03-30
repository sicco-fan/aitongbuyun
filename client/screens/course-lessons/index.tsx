import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { getLastLearningPosition, LastLearningPosition } from '@/utils/learningStorage';
import { 
  saveAudioToLocal, 
  generateCourseAudioKey,
  checkCourseAudioStatus,
} from '@/utils/audioStorage';
import RNSSE from 'react-native-sse';

interface Lesson {
  id: number;
  lesson_number: number;
  title: string;
  description: string;
  sentences_count: number;
  learned?: boolean; // 是否学过
  cached?: number; // 已缓存句子数
  total?: number; // 总句子数
}

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function CourseLessonsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ courseId: string }>();
  const courseId = params.courseId ? parseInt(params.courseId, 10) : null;
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLearningPosition, setLastLearningPosition] = useState<LastLearningPosition | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0, lessonTitle: '' });

  const fetchData = useCallback(async () => {
    if (!courseId) return;
    
    try {
      // 获取最后学习位置
      const lastPosition = await getLastLearningPosition();
      setLastLearningPosition(lastPosition);
      
      // 获取课程信息
      const courseRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses`);
      const courseData = await courseRes.json();
      
      if (courseData.courses) {
        const foundCourse = courseData.courses.find((c: Course) => c.id === courseId);
        setCourse(foundCourse || null);
      }
      
      // 获取课时列表
      const lessonsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/${courseId}/lessons`);
      const lessonsData = await lessonsRes.json();
      
      if (lessonsData.lessons) {
        // 获取用户对每个课时的学习状态
        let lessonsWithStatus = lessonsData.lessons;
        
        if (user?.id) {
          const lessonIds = lessonsData.lessons.map((l: Lesson) => l.id);
          
          // 查询 file_learning_summary 表获取学习状态
          const statsRes = await fetch(
            `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/files?user_id=${user.id}`
          );
          const statsData = await statsRes.json();
          
          if (statsData.success && statsData.file_stats) {
            // 创建已学习的课时ID集合
            const learnedLessonIds = new Set(
              statsData.file_stats
                .filter((s: any) => s.sentence_files?.sourceType === 'course')
                .map((s: any) => s.sentence_file_id)
            );
            
            // 标记每个课时是否学过
            lessonsWithStatus = lessonsData.lessons.map((l: Lesson) => ({
              ...l,
              learned: learnedLessonIds.has(l.id),
            }));
          }
        }
        
        // 检查每个课时的本地音频缓存状态
        const lessonsWithCache = await Promise.all(
          lessonsWithStatus.map(async (l: Lesson) => {
            const sentencesCount = l.sentences_count || 0;
            if (sentencesCount > 0) {
              const status = await checkCourseAudioStatus(courseId, [{ 
                id: l.id, 
                sentences_count: sentencesCount 
              }]);
              return {
                ...l,
                cached: status.cached,
                total: status.total,
              };
            }
            return { ...l, cached: 0, total: 0 };
          })
        );
        
        setLessons(lessonsWithCache);
      }
    } catch (error) {
      console.error('获取课时列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLessonClick = useCallback((lessonId: number, lessonNumber: number, lessonTitle: string) => {
    router.push('/lesson-practice', { 
      lessonId: lessonId.toString(), 
      title: lessonTitle,
      courseId: course?.id?.toString(),
      courseTitle: course?.title,
      lessonNumber: lessonNumber.toString(),
    });
  }, [router, course]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * 生成全部音频（实时流式生成，保存到本地）
   */
  const handleGenerateAllAudio = useCallback(async () => {
    if (!courseId || !course) return;
    
    // 保存已确认的 courseId，用于 SSE 回调
    const currentCourseId = courseId;
    
    setIsGenerating(true);
    setGenerateProgress({ current: 0, total: 0, lessonTitle: '' });
    
    // 使用 SSE 实时生成音频
    const sse = new RNSSE(
      `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/${currentCourseId}/generate-audio`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    
    sse.addEventListener('message', async (event) => {
      try {
        if (!event.data || event.data === '[DONE]') {
          sse.close();
          setIsGenerating(false);
          setGenerateProgress({ current: 0, total: 0, lessonTitle: '' });
          Alert.alert('完成', '音频生成完成');
          return;
        }
        
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setGenerateProgress({
            current: data.current,
            total: data.total,
            lessonTitle: data.lessonTitle || '',
          });
        } else if (data.type === 'audio') {
          // 保存音频到本地
          const audioKey = generateCourseAudioKey(currentCourseId, data.lessonId, data.sentenceIndex);
          await saveAudioToLocal(audioKey, data.audioBase64);
          console.log(`[音频生成] 已保存: ${audioKey}`);
        } else if (data.type === 'error') {
          Alert.alert('错误', data.message);
          sse.close();
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('解析SSE消息失败:', err);
      }
    });
    
    sse.addEventListener('error', (event) => {
      console.error('SSE连接错误:', event);
      setIsGenerating(false);
      Alert.alert('错误', '连接失败，请重试');
    });
  }, [courseId, course]);

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载课时中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FontAwesome6 name="chevron-left" size={16} color={theme.primary} />
          <ThemedText variant="body" color={theme.primary} style={styles.backButtonText}>
            返回课程列表
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerContent}>
              <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
                {course?.title || '课程'}
              </ThemedText>
              <ThemedText variant="small" color={theme.textSecondary} style={styles.subtitle}>
                {course?.description || '选择一课开始学习'}
              </ThemedText>
            </View>
            {!isGenerating && (
              <TouchableOpacity 
                style={styles.generateButton} 
                onPress={handleGenerateAllAudio}
              >
                <FontAwesome6 name="wand-magic-sparkles" size={14} color={theme.primary} />
                <ThemedText variant="smallMedium" color={theme.primary}>生成音频</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          
          {/* 生成进度 */}
          {isGenerating && generateProgress.total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(generateProgress.current / generateProgress.total) * 100}%` }
                  ]} 
                />
              </View>
              <ThemedText variant="caption" color={theme.textMuted}>
                {generateProgress.current}/{generateProgress.total} - {generateProgress.lessonTitle}
              </ThemedText>
            </View>
          )}
        </View>

        {lessons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="book-open" size={48} color={theme.textMuted} />
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
              暂无课时
            </ThemedText>
          </View>
        ) : (
          lessons.map((lesson) => {
            // 检查是否是上次学习的课时
            const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && 
                                  lastLearningPosition.lessonId === lesson.id;
            // 检查是否学过
            const hasLearned = lesson.learned;
            // 检查音频缓存状态
            const hasAudioCache = lesson.cached && lesson.cached > 0;
            const allCached = lesson.cached === lesson.total;
            
            return (
              <TouchableOpacity
                key={lesson.id}
                style={[
                  styles.lessonCard,
                  isLastLearned && styles.lastLearnedCard,
                  hasLearned && !isLastLearned && styles.learnedCard,
                ]}
                onPress={() => handleLessonClick(lesson.id, lesson.lesson_number, lesson.title)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.lessonNumber,
                  hasLearned && { backgroundColor: theme.success + '20' }
                ]}>
                  <ThemedText 
                    variant="h4" 
                    color={hasLearned ? theme.success : theme.primary} 
                    style={styles.lessonNumberText}
                  >
                    {lesson.lesson_number}
                  </ThemedText>
                </View>
                <View style={styles.lessonInfo}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.lessonTitle}>
                    {lesson.title}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={styles.lessonMeta}>
                    {lesson.sentences_count} 个句子
                    {hasLearned && ' · 已学过'}
                    {hasAudioCache && !allCached && ` · 缓存 ${lesson.cached}/${lesson.total}`}
                    {allCached && ' · 已缓存'}
                  </ThemedText>
                  {/* 上次学习提示 */}
                  {isLastLearned && (
                    <View style={[styles.lastLearnedBadge, { backgroundColor: theme.success + '20' }]}>
                      <FontAwesome6 name="clock-rotate-left" size={10} color={theme.success} />
                      <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 4 }}>
                        上次学到 第 {lastLearningPosition.sentenceIndex + 1}/{lastLearningPosition.totalSentences} 句
                      </ThemedText>
                    </View>
                  )}
                </View>
                <FontAwesome6
                  name="chevron-right"
                  size={20}
                  color={theme.textMuted}
                  style={styles.arrowIcon}
                />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
