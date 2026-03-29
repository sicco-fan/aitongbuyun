import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getLastLearningPosition, LastLearningPosition } from '@/utils/learningStorage';

interface SentenceFile {
  id: number;
  title: string;
  sentences_count: number;
  ready_sentences_count: number;
  status: string;
  original_duration: number;
  source_type?: string; // 'upload' | 'link' | 'share' | 'ai_tts'
}

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
  total_lessons: number;
  total_sentences?: number;
  cover_image?: string;
}

interface ErrorStats {
  uniqueWords: number;
  totalErrors: number;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated } = useAuth();
  const [sentenceFiles, setSentenceFiles] = useState<SentenceFile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [lastLearningPosition, setLastLearningPosition] = useState<LastLearningPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // AI 句库文件（source_type === 'ai_tts'）
  const aiSentenceFiles = useMemo(() => {
    return sentenceFiles.filter(f => f.source_type === 'ai_tts');
  }, [sentenceFiles]);

  // 自制句库（source_type !== 'ai_tts'）
  const customSentenceFiles = useMemo(() => {
    return sentenceFiles.filter(f => f.source_type !== 'ai_tts');
  }, [sentenceFiles]);

  // AI 句库总句数（课程 + AI句库文件）
  const aiTotalSentences = useMemo(() => {
    const courseSentences = courses.reduce((sum, c) => sum + (c.total_sentences || c.total_lessons * 18), 0);
    const fileSentences = aiSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0);
    return courseSentences + fileSentences;
  }, [courses, aiSentenceFiles]);

  const fetchData = useCallback(async () => {
    try {
      // 获取最后学习位置
      const lastPosition = await getLastLearningPosition();
      setLastLearningPosition(lastPosition);
      
      // 获取精品课程（按 book_number 排序）
      const coursesRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses`);
      const coursesData = await coursesRes.json();
      if (coursesData.courses) {
        // 按 book_number 排序
        const sortedCourses = [...coursesData.courses].sort((a, b) => a.book_number - b.book_number);
        setCourses(sortedCourses);
      }
      
      // 获取句库文件
      const sentenceFilesRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const sentenceFilesData = await sentenceFilesRes.json();

      if (sentenceFilesData.files) {
        const filesWithReady = sentenceFilesData.files.filter((f: SentenceFile) => f.ready_sentences_count > 0);
        setSentenceFiles(filesWithReady);
      }
      
      // 获取错题统计
      if (isAuthenticated && user?.id) {
        try {
          const errorRes = await fetch(
            `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/stats?user_id=${user.id}`
          );
          const errorData = await errorRes.json();
          if (errorData.success) {
            setErrorStats(errorData.data);
          }
        } catch (e) {
          console.log('获取错题统计失败:', e);
        }
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSentenceFilePress = (file: SentenceFile) => {
    router.push('/sentence-practice', { fileId: file.id, title: file.title });
  };

  const handleCoursePress = (course: Course) => {
    router.push('/course-lessons', { courseId: course.id.toString() });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 获取课程图标
  const getBookIcon = (bookNumber: number): string => {
    const icons: Record<number, string> = {
      1: 'book-open',
      2: 'book',
      3: 'graduation-cap',
      4: 'award',
    };
    return icons[bookNumber] || 'book';
  };

  // 渲染课程卡片
  const renderCourseCard = (course: Course) => {
    const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && 
                          lastLearningPosition.courseId === course.id;
    
    return (
      <TouchableOpacity
        key={`course-${course.id}`}
        style={[styles.materialCard, isLastLearned && styles.lastLearnedCard]}
        onPress={() => handleCoursePress(course)}
        activeOpacity={0.7}
      >
        {/* 上次学习提示 */}
        {isLastLearned && (
          <View style={[styles.lastLearnedBadge, { backgroundColor: theme.success + '20' }]}>
            <FontAwesome6 name="clock-rotate-left" size={12} color={theme.success} />
            <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 4 }}>
              上次学到 第{lastLearningPosition.lessonNumber}课
            </ThemedText>
          </View>
        )}

        <View style={styles.materialHeader}>
          <View style={[styles.materialIconContainer, { backgroundColor: theme.primary + '20' }]}>
            <FontAwesome6 
              name={getBookIcon(course.book_number)} 
              size={20} 
              color={theme.primary} 
            />
          </View>
          <View style={styles.materialInfo}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.materialTitle}>
              {course.title}
            </ThemedText>
            <View style={styles.materialMeta}>
              <View style={styles.metaTag}>
                <FontAwesome6 name="graduation-cap" size={10} color={theme.textMuted} />
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {course.total_lessons} 课
                </ThemedText>
              </View>
              <View style={styles.metaTag}>
                <FontAwesome6 name="list" size={10} color={theme.textMuted} />
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {course.total_sentences || course.total_lessons * 18} 句
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.materialArrow}>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染句库卡片
  const renderSentenceFileCard = (file: SentenceFile, isAI: boolean = false) => (
    <TouchableOpacity
      key={`sentence-${file.id}`}
      style={styles.materialCard}
      onPress={() => handleSentenceFilePress(file)}
      activeOpacity={0.7}
    >
      <View style={styles.materialHeader}>
        <View style={[
          styles.materialIconContainer, 
          { backgroundColor: isAI ? theme.primary + '20' : theme.accent + '20' }
        ]}>
          <FontAwesome6 
            name={isAI ? "wand-magic-sparkles" : "book-open"} 
            size={20} 
            color={isAI ? theme.primary : theme.accent} 
          />
        </View>
        <View style={styles.materialInfo}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.materialTitle}>
            {file.title}
          </ThemedText>
          <View style={styles.materialMeta}>
            <View style={styles.metaTag}>
              <FontAwesome6 name="clock" size={10} color={theme.textMuted} />
              <ThemedText variant="tiny" color={theme.textMuted}>
                {formatDuration(file.original_duration)}
              </ThemedText>
            </View>
            <View style={styles.metaTag}>
              <FontAwesome6 name="circle-check" size={10} color={theme.success} />
              <ThemedText variant="tiny" color={theme.textMuted}>
                {file.ready_sentences_count} 句可学
              </ThemedText>
            </View>
          </View>
        </View>
        <View style={styles.materialArrow}>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <ThemedText variant="caption" color={theme.textMuted} style={styles.greeting}>
            AI听写云
          </ThemedText>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            开始学习
          </ThemedText>
        </ThemedView>

        {/* 继续学习快捷入口 */}
        {lastLearningPosition && (
          <TouchableOpacity
            style={[styles.continueCard, { backgroundColor: theme.success + '10', borderColor: theme.success + '30' }]}
            onPress={() => {
              if (lastLearningPosition.sourceType === 'lesson' && lastLearningPosition.lessonId) {
                router.push('/sentence-practice', {
                  sourceType: 'lesson',
                  lessonId: lastLearningPosition.lessonId.toString(),
                  courseId: lastLearningPosition.courseId?.toString(),
                  courseTitle: lastLearningPosition.courseTitle,
                  lessonNumber: lastLearningPosition.lessonNumber?.toString(),
                  voiceId: lastLearningPosition.voiceId,
                  title: lastLearningPosition.lessonTitle || lastLearningPosition.fileTitle || '',
                  sentenceIndex: lastLearningPosition.sentenceIndex,
                });
              } else if (lastLearningPosition.sourceType === 'sentence_file' && lastLearningPosition.fileId) {
                router.push('/sentence-practice', {
                  sourceType: 'file',
                  fileId: lastLearningPosition.fileId,
                  title: lastLearningPosition.fileTitle || '',
                  sentenceIndex: lastLearningPosition.sentenceIndex,
                });
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.continueIconContainer, { backgroundColor: theme.success + '20' }]}>
              <FontAwesome6 name="play-circle" size={24} color={theme.success} />
            </View>
            <View style={styles.continueInfo}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                继续学习
              </ThemedText>
              <ThemedText variant="small" color={theme.textSecondary} numberOfLines={1}>
                {lastLearningPosition.sourceType === 'lesson' 
                  ? `${lastLearningPosition.courseTitle} · 第${lastLearningPosition.lessonNumber}课`
                  : lastLearningPosition.fileTitle
                }
              </ThemedText>
              <ThemedText variant="tiny" color={theme.textMuted} numberOfLines={1}>
                {lastLearningPosition.sourceType === 'lesson' 
                  ? lastLearningPosition.lessonTitle
                  : `第 ${lastLearningPosition.sentenceIndex + 1} / ${lastLearningPosition.totalSentences} 句`
                }
              </ThemedText>
            </View>
            <View style={styles.continueProgress}>
              <ThemedText variant="smallMedium" color={theme.success}>
                {Math.round(((lastLearningPosition.sentenceIndex + 1) / lastLearningPosition.totalSentences) * 100)}%
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        {/* 错题本快捷入口 */}
        {isAuthenticated && errorStats && errorStats.uniqueWords > 0 && (
          <TouchableOpacity
            style={[styles.errorCard, { backgroundColor: theme.error + '10', borderColor: theme.error + '30' }]}
            onPress={() => router.push('/error-words')}
            activeOpacity={0.7}
          >
            <View style={[styles.errorIconContainer, { backgroundColor: theme.error + '20' }]}>
              <FontAwesome6 name="exclamation-triangle" size={20} color={theme.error} />
            </View>
            <View style={styles.errorInfo}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                待攻克词汇
              </ThemedText>
              <ThemedText variant="small" color={theme.textSecondary}>
                {errorStats.uniqueWords} 个薄弱词汇等你练习
              </ThemedText>
            </View>
            <View style={styles.errorBadge}>
              <ThemedText variant="smallMedium" color={theme.error}>
                {errorStats.totalErrors} 次错误
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        {/* AI 句库 Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <FontAwesome6 name="wand-magic-sparkles" size={18} color={theme.primary} />
            <ThemedText variant="h4" color={theme.textPrimary}>
              AI 句库
            </ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            {aiTotalSentences} 句可学
          </ThemedText>
        </View>

        {/* 精品课程列表 */}
        {courses.map((course) => renderCourseCard(course))}

        {/* AI 句库文件列表 */}
        {aiSentenceFiles.map((file) => renderSentenceFileCard(file, true))}

        {/* 自制句库 Section */}
        <View style={[styles.sectionHeader, styles.sectionHeaderMargin]}>
          <View style={styles.sectionTitleRow}>
            <FontAwesome6 name="folder-open" size={18} color={theme.accent} />
            <ThemedText variant="h4" color={theme.textPrimary}>
              自制句库
            </ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            {customSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
          </ThemedText>
        </View>

        {customSentenceFiles.length > 0 ? (
          customSentenceFiles.map((file) => renderSentenceFileCard(file, false))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="folder-open" size={32} color={theme.accent} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
              暂无自制句库
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              上传视频或音频文件，提取文本制作句库
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
