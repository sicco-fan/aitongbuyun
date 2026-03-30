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
  checkLessonAudioStatusByVoice,
  getMissingVoicesForLesson,
  isLocalStorageSupported,
  hasAudioLocal,
} from '@/utils/audioStorage';
import RNSSE from 'react-native-sse';

interface VoiceStatus {
  voiceId: string;
  voiceName: string;
  cached: number;
  total: number;
}

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
  // 新增：每个音色的状态
  voiceStatus?: VoiceStatus[];
  completedVoices?: number; // 完全下载完成的音色数量
  totalVoices?: number;     // 总音色数量
  isComplete?: boolean;     // 是否全部音色都已下载完成
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
  voiceIds: string[]; // 正在下载的音色列表
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
        
        // 检查每个课时的本地音频缓存状态（按音色检查）
        const lessonsWithCache = await Promise.all(
          lessonsWithStatus.map(async (l: Lesson) => {
            const sentencesCount = l.sentences_count || 0;
            if (sentencesCount > 0 && isLocalStorageSupported()) {
              // 检查每个音色的缓存状态
              const voiceStatus = await checkLessonAudioStatusByVoice(courseId, l.id, sentencesCount);
              return {
                ...l,
                // 兼容旧逻辑：cached 表示有任意音色的句子数
                cached: voiceStatus.voiceStatus[0]?.cached || 0,
                total: sentencesCount,
                isDownloading: downloadingLessons.has(l.id),
                // 新增：音色详细状态
                voiceStatus: voiceStatus.voiceStatus,
                completedVoices: voiceStatus.completedVoices,
                totalVoices: voiceStatus.totalVoices,
                isComplete: voiceStatus.isComplete,
              };
            }
            return { ...l, cached: 0, total: 0, completedVoices: 0, totalVoices: 4, isComplete: false };
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
   * 开始后台下载课时音频（支持补齐缺失音色）
   * @param lessonId 课时ID
   * @param lessonTitle 课时标题
   * @param forceAll 是否强制下载全部四个音色（默认只下载缺失的）
   */
  const startBackgroundDownload = useCallback(async (
    lessonId: number, 
    lessonTitle: string,
    forceAll: boolean = false
  ) => {
    if (!courseId || !isLocalStorageSupported()) return;
    
    // 检查是否已在下载中
    if (downloadingLessons.has(lessonId)) {
      Alert.alert('提示', '该课时正在下载中，请稍候');
      return;
    }
    
    // 获取课时信息
    const lesson = lessons.find(l => l.id === lessonId);
    const sentenceCount = lesson?.sentences_count || 0;
    
    // 确定需要下载的音色
    let voiceIds: string[];
    if (forceAll || !lesson?.voiceStatus) {
      // 强制下载全部四个音色
      voiceIds = [
        'zh_female_vv_uranus_bigtts',    // 薇薇（双语女声）
        'zh_female_xiaohe_uranus_bigtts', // 晓荷（中文女声）
        'zh_male_m191_uranus_bigtts',     // 云舟（中文男声）
        'zh_male_taocheng_uranus_bigtts', // 晓天（中文男声）
      ];
    } else {
      // 只下载缺失的音色
      voiceIds = await getMissingVoicesForLesson(courseId, lessonId, sentenceCount);
      if (voiceIds.length === 0) {
        Alert.alert('提示', '该课时的所有音色已下载完成');
        return;
      }
      console.log(`[后台下载] 课时 ${lessonId} 缺失 ${voiceIds.length} 个音色: ${voiceIds.join(', ')}`);
    }
    
    const controller = new AbortController();
    downloadingLessons.set(lessonId, { controller, progress: 0, total: 0, voiceIds });
    
    // 更新UI状态
    setLessons(prev => prev.map(l => 
      l.id === lessonId ? { ...l, isDownloading: true, downloadProgress: 0 } : l
    ));
    
    console.log(`[后台下载] 开始下载课时 ${lessonId} 的音频，音色: ${voiceIds.join(', ')}...`);
    
    try {
      const sse = new RNSSE(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}/generate-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceIds }),
          lineEndingCharacter: '\n', // 显式指定换行符，避免自动检测失败
        }
      );
      
      let totalSentences = 0;
      let currentProgress = 0;
      let cloudAudioKeys: string[] = []; // 收集云端文件key，下载完成后删除
      let downloadedCount = 0; // 已下载到手机的句子数
      
      sse.addEventListener('message', async (event) => {
        try {
          if (!event.data || event.data === '[DONE]') {
            sse.close();
            downloadingLessons.delete(lessonId);
            
            // 重新检查音色状态
            const lesson = lessons.find(l => l.id === lessonId);
            const sentenceCount = lesson?.sentences_count || 0;
            if (courseId && sentenceCount > 0) {
              const voiceStatus = await checkLessonAudioStatusByVoice(courseId, lessonId, sentenceCount);
              setLessons(prev => prev.map(l => {
                if (l.id === lessonId) {
                  return { 
                    ...l, 
                    isDownloading: false, 
                    cached: voiceStatus.voiceStatus[0]?.cached || 0,
                    downloadProgress: undefined,
                    webDownloadComplete: undefined,
                    voiceStatus: voiceStatus.voiceStatus,
                    completedVoices: voiceStatus.completedVoices,
                    totalVoices: voiceStatus.totalVoices,
                    isComplete: voiceStatus.isComplete,
                  };
                }
                return l;
              }));
            } else {
              // 无法检查，使用旧逻辑
              setLessons(prev => prev.map(l => {
                if (l.id === lessonId) {
                  return { 
                    ...l, 
                    isDownloading: false, 
                    cached: l.total,
                    downloadProgress: undefined,
                    webDownloadComplete: undefined,
                  };
                }
                return l;
              }));
            }
            
            // 删除云端临时文件
            if (cloudAudioKeys.length > 0) {
              try {
                console.log(`[云端清理] 开始删除 ${cloudAudioKeys.length} 个临时文件...`);
                const cleanupRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/cloud-audio/cleanup`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ keys: cloudAudioKeys }),
                });
                const cleanupData = await cleanupRes.json();
                console.log(`[云端清理] 删除完成:`, cleanupData);
              } catch (cleanupErr) {
                console.error('[云端清理] 删除失败，将由定时任务清理:', cleanupErr);
              }
            }
            
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
                  
                  // 保存到本地（使用后端返回的 voice_id）
                  const audioKey = generateCourseAudioKey(courseId!, lessonId, data.sentence_index || data.sentenceIndex, data.voice_id);
                  await saveAudioToLocal(audioKey, audioBase64);
                  console.log(`[移动端下载] 保存成功: ${audioKey}`);
                }
                
                // 收集云端key，稍后批量删除
                cloudAudioKeys.push(cloudAudioKey);
                downloadedCount++;
                
              } catch (downloadErr) {
                console.error(`[云端下载] 失败: ${cloudAudioKey}`, downloadErr);
              }
            }
          } else if (data.type === 'audio') {
            // 兼容后端返回的字段名 (audio_base64 或 audioBase64)
            const audioBase64 = data.audio_base64 || data.audioBase64;
            if (audioBase64 && data.voice_id) {
              // 使用后端返回的 voice_id
              const audioKey = generateCourseAudioKey(courseId, lessonId, data.sentence_index || data.sentenceIndex, data.voice_id);
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
            const isDownloading = lesson.isDownloading;
            const downloadProgress = lesson.downloadProgress || 0;
            
            // 使用新的音色状态
            const completedVoices = lesson.completedVoices || 0;
            const totalVoices = lesson.totalVoices || 4;
            const isComplete = lesson.isComplete || false;
            const hasPartialCache = completedVoices > 0 && !isComplete;
            
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
                  
                  {/* 下载状态/缓存状态 - 显示音色完成情况 */}
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
                        下载中 {Math.round(downloadProgress * 100)}%
                      </ThemedText>
                    </View>
                  ) : isComplete ? (
                    // 四个音色全部下载完成
                    <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                      <FontAwesome6 name="check-circle" size={10} color={theme.success} />
                      <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 4 }}>
                        全部可用 ({totalVoices}音色)
                      </ThemedText>
                    </View>
                  ) : hasPartialCache ? (
                    // 部分音色已下载
                    <View style={[styles.statusBadge, { backgroundColor: theme.accent + '20' }]}>
                      <FontAwesome6 name="arrow-down" size={10} color={theme.accent} />
                      <ThemedText variant="tiny" color={theme.accent} style={{ marginLeft: 4 }}>
                        {completedVoices}/{totalVoices} 音色可用
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
                ) : isComplete ? (
                  // 全部音色已下载完成
                  <FontAwesome6
                    name="chevron-right"
                    size={18}
                    color={theme.textMuted}
                    style={styles.arrowIcon}
                  />
                ) : hasPartialCache ? (
                  // 部分音色已下载，显示补齐按钮
                  <TouchableOpacity 
                    style={[styles.downloadButton, { backgroundColor: theme.accent }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownloadClick(lesson.id, lesson.title);
                    }}
                  >
                    <FontAwesome6
                      name="plus"
                      size={16}
                      color={theme.buttonPrimaryText}
                    />
                  </TouchableOpacity>
                ) : (
                  // 没有任何缓存，显示下载按钮
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
