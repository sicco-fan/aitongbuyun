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

// 检测是否为 Web 端（Platform.OS 类型不包含 'web'，需要类型断言）
const isWeb = (Platform as any).OS === 'web';
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
  webDownloadComplete?: boolean; // 网页端下载完成标记
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
    
    // 检查是否已有其他下载任务（限制同时只能下载一个）
    if (downloadingLessons.size > 0) {
      Alert.alert('提示', '请等待当前下载任务完成后再试');
      return;
    }
    
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
          body: JSON.stringify({ 
            voiceId: 'zh_female_vv_uranus_bigtts' // 使用双语音色
          }),
          lineEndingCharacter: '\n', // 显式指定换行符，避免自动检测失败
        }
      );
      
      let totalSentences = 0;
      let currentProgress = 0;
      let cloudAudioKeys: string[] = []; // 收集云端文件key，下载完成后删除
      
      sse.addEventListener('message', async (event) => {
        try {
          if (!event.data || event.data === '[DONE]') {
            sse.close();
            downloadingLessons.delete(lessonId);
            
            // 删除云端临时文件
            if (cloudAudioKeys.length > 0) {
              try {
                console.log(`[云端清理] 开始删除 ${cloudAudioKeys.length} 个临时文件...`);
                await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/cloud-audio/cleanup`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ keys: cloudAudioKeys }),
                });
                console.log(`[云端清理] 删除完成`);
              } catch (cleanupErr) {
                console.error('[云端清理] 删除失败，将由定时任务清理:', cleanupErr);
              }
            }
            
            // 更新UI：下载完成
            setLessons(prev => prev.map(l => {
              if (l.id === lessonId) {
                return { 
                  ...l, 
                  isDownloading: false, 
                  cached: l.total, 
                  // 网页端保留 downloadProgress: 1 用于显示「已下载」状态
                  downloadProgress: isWeb ? 1 : undefined,
                  // 网页端标记已下载
                  webDownloadComplete: isWeb ? true : undefined,
                };
              }
              return l;
            }));
            
            console.log(`[后台下载] 课时 ${lessonId} 下载完成`);
            return;
          }
          
          const data = JSON.parse(event.data);
          
          // 安全检查：确保下载状态存在
          const downloadState = downloadingLessons.get(lessonId);
          if (!downloadState) {
            console.log('[后台下载] 下载状态已清除，忽略消息');
            sse.close();
            return;
          }
          
          if (data.type === 'start') {
            totalSentences = data.total;
            downloadState.total = totalSentences;
          } else if (data.type === 'progress') {
            currentProgress = data.current;
            downloadState.progress = currentProgress;
            
            setLessons(prev => prev.map(l => 
              l.id === lessonId 
                ? { ...l, downloadProgress: currentProgress / totalSentences, cached: currentProgress }
                : l
            ));
          } else if (data.type === 'audio_url') {
            // 云端中转方案：从云端URL下载到本地
            const cloudAudioUrl = data.cloud_audio_url;
            const cloudAudioKey = data.cloud_audio_key;
            
            if (cloudAudioUrl && cloudAudioKey) {
              try {
                console.log(`[云端下载] 开始下载: ${cloudAudioKey}`);
                
                if (isWeb) {
                  // 网页端：触发浏览器下载
                  const link = document.createElement('a');
                  link.href = cloudAudioUrl;
                  link.download = `课程${courseId}_课时${lessonId}_句子${data.sentence_index || data.sentenceIndex}.mp3`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  console.log(`[网页下载] 触发下载: ${link.download}`);
                } else {
                  // 移动端：下载并保存到本地存储
                  const audioRes = await fetch(cloudAudioUrl);
                  if (!audioRes.ok) {
                    throw new Error(`下载失败: ${audioRes.status}`);
                  }
                  
                  const audioBuffer = await audioRes.arrayBuffer();
                  const audioBase64 = btoa(
                    new Uint8Array(audioBuffer).reduce(
                      (data, byte) => data + String.fromCharCode(byte),
                      ''
                    )
                  );
                  
                  // 保存到本地
                  const audioKey = generateCourseAudioKey(courseId!, lessonId, data.sentence_index || data.sentenceIndex);
                  await saveAudioToLocal(audioKey, audioBase64);
                  console.log(`[移动端下载] 保存成功: ${audioKey}`);
                }
                
                // 收集云端key，稍后批量删除
                cloudAudioKeys.push(cloudAudioKey);
                
              } catch (downloadErr) {
                console.error(`[云端下载] 失败: ${cloudAudioKey}`, downloadErr);
              }
            }
          } else if (data.type === 'audio') {
            // 兼容后端返回的字段名 (audio_base64 或 audioBase64)
            const audioBase64 = data.audio_base64 || data.audioBase64;
            if (audioBase64) {
              const audioKey = generateCourseAudioKey(courseId, lessonId, data.sentence_index || data.sentenceIndex);
              await saveAudioToLocal(audioKey, audioBase64);
            }
          } else if (data.type === 'error') {
            const errorMsg = data.message || data.error || '未知错误';
            console.error(`[后台下载] 错误: ${errorMsg}`);
            sse.close();
            downloadingLessons.delete(lessonId);
            setLessons(prev => prev.map(l => 
              l.id === lessonId ? { ...l, isDownloading: false, downloadProgress: undefined } : l
            ));
            Alert.alert('下载失败', errorMsg);
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
        Alert.alert('下载失败', '网络连接错误，请重试');
      });
      
    } catch (error: any) {
      console.error('[后台下载] 失败:', error);
      downloadingLessons.delete(lessonId);
      setLessons(prev => prev.map(l => 
        l.id === lessonId ? { ...l, isDownloading: false, downloadProgress: undefined } : l
      ));
      Alert.alert('下载失败', error?.message || '未知错误');
    }
  }, [courseId]);

  /**
   * 点击课时：直接进入学习（使用在线TTS或本地缓存）
   */
  const handleLessonClick = useCallback(async (lessonId: number, lessonNumber: number, lessonTitle: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    
    // 直接进入学习页面（Web和移动端都支持在线TTS）
    router.push('/lesson-practice', { 
      lessonId: lessonId.toString(), 
      title: lessonTitle,
      courseId: course?.id?.toString(),
      courseTitle: course?.title,
      lessonNumber: lessonNumber.toString(),
    });
  }, [lessons, course, router]);

  /**
   * 点击下载按钮：开始下载课时音频
   */
  const handleDownloadClick = useCallback((lessonId: number, lessonTitle: string) => {
    // 检查是否已有其他下载任务
    if (downloadingLessons.size > 0) {
      Alert.alert('提示', '请等待当前下载任务完成后再试');
      return;
    }
    
    // 检查是否已在下载中
    if (downloadingLessons.has(lessonId)) {
      Alert.alert('提示', '该课时正在下载中，请稍候');
      return;
    }
    
    startBackgroundDownload(lessonId, lessonTitle);
  }, [startBackgroundDownload]);

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
            const downloadProgress = lesson.downloadProgress || 0;
            
            // 网页端：下载完成后显示「已下载」
            const webDownloaded = isWeb && lesson.webDownloadComplete;
            
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
                    <View style={styles.downloadProgressContainer}>
                      <View style={styles.downloadProgressBar}>
                        <View 
                          style={[
                            styles.downloadProgressFill, 
                            { width: `${downloadProgress * 100}%` }
                          ]} 
                        />
                      </View>
                      <ThemedText variant="tiny" color={theme.textMuted} style={styles.downloadProgressText}>
                        {isWeb ? '下载中' : '缓存中'} {Math.round(downloadProgress * 100)}%
                      </ThemedText>
                    </View>
                  ) : allCached || webDownloaded ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                      <FontAwesome6 name="check-circle" size={10} color={theme.success} />
                      <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 4 }}>
                        {isWeb ? '已下载' : '已缓存'}
                      </ThemedText>
                    </View>
                  ) : hasAudioCache ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.accent + '20' }]}>
                      <FontAwesome6 name="arrow-down" size={10} color={theme.accent} />
                      <ThemedText variant="tiny" color={theme.accent} style={{ marginLeft: 4 }}>
                        缓存 {lesson.cached}/{lesson.total}
                      </ThemedText>
                    </View>
                  ) : (
                    <ThemedText variant="tiny" color={theme.textMuted} style={{ marginTop: 4 }}>
                      点击进入学习
                    </ThemedText>
                  )}
                  
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
                
                {/* 右侧按钮区域 */}
                {isDownloading ? (
                  <ActivityIndicator size="small" color={theme.primary} style={styles.arrowIcon} />
                ) : allCached || webDownloaded ? (
                  <FontAwesome6
                    name="chevron-right"
                    size={18}
                    color={theme.textMuted}
                    style={styles.arrowIcon}
                  />
                ) : (
                  <TouchableOpacity 
                    style={styles.downloadButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownloadClick(lesson.id, lesson.title);
                    }}
                  >
                    <FontAwesome6
                      name="download"
                      size={16}
                      color={theme.buttonPrimaryText}
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
