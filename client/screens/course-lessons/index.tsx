import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
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
  isLocalStorageSupported,
  hasAudioLocal,
} from '@/utils/audioStorage';
import RNSSE from 'react-native-sse';

interface Lesson {
  id: number;
  lesson_number: number;
  title: string;
  description: string;
  sentences_count: number;
  learned?: boolean;
  cached?: number;
  total?: number;
  isDownloading?: boolean;
  downloadProgress?: number;
}

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
}

// 全局下载状态管理（退出页面后仍保持）
const downloadingLessons = new Map<number, { 
  controller: AbortController;
  progress: number;
  total: number;
}>();

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

  const fetchData = useCallback(async () => {
    if (!courseId) return;
    
    try {
      const lastPosition = await getLastLearningPosition();
      setLastLearningPosition(lastPosition);
      
      const courseRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses`);
      const courseData = await courseRes.json();
      
      if (courseData.courses) {
        const foundCourse = courseData.courses.find((c: Course) => c.id === courseId);
        setCourse(foundCourse || null);
      }
      
      const lessonsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/${courseId}/lessons`);
      const lessonsData = await lessonsRes.json();
      
      if (lessonsData.lessons) {
        let lessonsWithStatus = lessonsData.lessons;
        
        if (user?.id) {
          const statsRes = await fetch(
            `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/files?user_id=${user.id}`
          );
          const statsData = await statsRes.json();
          
          if (statsData.success && statsData.file_stats) {
            const learnedLessonIds = new Set(
              statsData.file_stats
                .filter((s: any) => s.sentence_files?.sourceType === 'course')
                .map((s: any) => s.sentence_file_id)
            );
            
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
            if (sentencesCount > 0 && isLocalStorageSupported()) {
              const status = await checkCourseAudioStatus(courseId, [{ 
                id: l.id, 
                sentences_count: sentencesCount 
              }]);
              return {
                ...l,
                cached: status.cached,
                total: status.total,
                isDownloading: downloadingLessons.has(l.id),
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

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * 开始后台下载课时音频
   */
  const startBackgroundDownload = useCallback(async (lessonId: number, lessonTitle: string) => {
    if (!courseId || !isLocalStorageSupported()) return;
    
    // 检查是否已在下载中
    if (downloadingLessons.has(lessonId)) {
      Alert.alert('提示', '该课时正在下载中，请稍候');
      return;
    }
    
    const controller = new AbortController();
    downloadingLessons.set(lessonId, { controller, progress: 0, total: 0 });
    
    // 更新UI状态
    setLessons(prev => prev.map(l => 
      l.id === lessonId ? { ...l, isDownloading: true, downloadProgress: 0 } : l
    ));
    
    console.log(`[后台下载] 开始下载课时 ${lessonId} 的音频...`);
    
    try {
      const sse = new RNSSE(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}/generate-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          lineEndingCharacter: '\n', // 显式指定换行符，避免自动检测失败
        }
      );
      
      let totalSentences = 0;
      let currentProgress = 0;
      
      sse.addEventListener('message', async (event) => {
        try {
          if (!event.data || event.data === '[DONE]') {
            sse.close();
            downloadingLessons.delete(lessonId);
            
            // 更新UI：下载完成
            setLessons(prev => prev.map(l => {
              if (l.id === lessonId) {
                return { 
                  ...l, 
                  isDownloading: false, 
                  cached: l.total, 
                  downloadProgress: undefined 
                };
              }
              return l;
            }));
            
            console.log(`[后台下载] 课时 ${lessonId} 下载完成`);
            return;
          }
          
          const data = JSON.parse(event.data);
          
          if (data.type === 'start') {
            totalSentences = data.total;
            downloadingLessons.get(lessonId)!.total = totalSentences;
          } else if (data.type === 'progress') {
            currentProgress = data.current;
            downloadingLessons.get(lessonId)!.progress = currentProgress;
            
            setLessons(prev => prev.map(l => 
              l.id === lessonId 
                ? { ...l, downloadProgress: currentProgress / totalSentences, cached: currentProgress }
                : l
            ));
          } else if (data.type === 'audio') {
            // 兼容后端返回的字段名 (audio_base64 或 audioBase64)
            const audioBase64 = data.audio_base64 || data.audioBase64;
            if (audioBase64) {
              const audioKey = generateCourseAudioKey(courseId, lessonId, data.sentence_index || data.sentenceIndex);
              await saveAudioToLocal(audioKey, audioBase64);
            }
          } else if (data.type === 'error') {
            console.error(`[后台下载] 错误: ${data.message}`);
            sse.close();
            downloadingLessons.delete(lessonId);
            setLessons(prev => prev.map(l => 
              l.id === lessonId ? { ...l, isDownloading: false, downloadProgress: undefined } : l
            ));
          }
        } catch (err) {
          console.error('解析SSE消息失败:', err);
        }
      });
      
      sse.addEventListener('error', (event) => {
        console.error('SSE连接错误:', event);
        downloadingLessons.delete(lessonId);
        setLessons(prev => prev.map(l => 
          l.id === lessonId ? { ...l, isDownloading: false, downloadProgress: undefined } : l
        ));
      });
      
    } catch (error) {
      console.error('[后台下载] 失败:', error);
      downloadingLessons.delete(lessonId);
      setLessons(prev => prev.map(l => 
        l.id === lessonId ? { ...l, isDownloading: false, downloadProgress: undefined } : l
      ));
    }
  }, [courseId]);

  /**
   * 点击课时：检查缓存状态，决定是下载还是学习
   */
  const handleLessonClick = useCallback(async (lessonId: number, lessonNumber: number, lessonTitle: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    
    // Web 端：直接进入学习（使用在线TTS）
    if (Platform.OS === 'web') {
      router.push('/lesson-practice', { 
        lessonId: lessonId.toString(), 
        title: lessonTitle,
        courseId: course?.id?.toString(),
        courseTitle: course?.title,
        lessonNumber: lessonNumber.toString(),
      });
      return;
    }
    
    // 检查是否正在下载
    if (lesson.isDownloading) {
      Alert.alert('下载中', '该课时音频正在下载中，请稍候...');
      return;
    }
    
    // 检查是否已完全缓存
    const allCached = lesson.cached === (lesson.total || 0) && (lesson.total || 0) > 0;
    
    if (allCached) {
      // 已缓存：直接进入学习，不弹窗
      router.push('/lesson-practice', { 
        lessonId: lessonId.toString(), 
        title: lessonTitle,
        courseId: course?.id?.toString(),
        courseTitle: course?.title,
        lessonNumber: lessonNumber.toString(),
      });
    } else {
      // 未缓存或部分缓存：询问是否下载
      const message = lesson.cached && lesson.cached > 0
        ? `已缓存 ${lesson.cached}/${lesson.total} 句，是否继续下载剩余音频？\n\n下载完成后可离线学习。`
        : '该课时音频尚未下载，是否现在下载？\n\n下载完成后可离线学习，退出此页面不影响下载进度。';
      
      Alert.alert(
        '下载音频',
        message,
        [
          {
            text: '下载',
            onPress: () => startBackgroundDownload(lessonId, lessonTitle)
          },
          {
            text: '取消',
            style: 'cancel',
          }
        ]
      );
    }
  }, [lessons, course, router, startBackgroundDownload]);

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
                点击课时自动下载音频
              </ThemedText>
            </View>
          </View>
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
            const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && 
                                  lastLearningPosition.lessonId === lesson.id;
            const hasLearned = lesson.learned;
            const hasAudioCache = lesson.cached && lesson.cached > 0;
            const allCached = lesson.cached === (lesson.total || 0) && (lesson.total || 0) > 0;
            const isDownloading = lesson.isDownloading;
            
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
                  </ThemedText>
                  
                  {/* 下载状态/缓存状态 */}
                  {isDownloading ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.primary + '20' }]}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <ThemedText variant="tiny" color={theme.primary} style={{ marginLeft: 6 }}>
                        下载中 {lesson.downloadProgress ? `${Math.round(lesson.downloadProgress * 100)}%` : ''}
                      </ThemedText>
                    </View>
                  ) : allCached ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                      <FontAwesome6 name="check-circle" size={10} color={theme.success} />
                      <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 4 }}>
                        已缓存
                      </ThemedText>
                    </View>
                  ) : hasAudioCache ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.accent + '20' }]}>
                      <FontAwesome6 name="down-arrow" size={10} color={theme.accent} />
                      <ThemedText variant="tiny" color={theme.accent} style={{ marginLeft: 4 }}>
                        缓存 {lesson.cached}/{lesson.total}
                      </ThemedText>
                    </View>
                  ) : null}
                  
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
                  name={allCached ? "chevron-right" : "download"}
                  size={18}
                  color={isDownloading ? theme.textMuted : (allCached ? theme.textMuted : theme.accent)}
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
