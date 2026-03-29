import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { LastLearningPosition } from '@/utils/learningStorage';
import { createSharedStyles } from './shared-styles';

interface SentenceFile {
  id: number;
  title: string;
  sentences_count: number;
  ready_sentences_count: number;
  status: string;
  original_duration: number;
  source_type?: string;
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

interface TwoColumnLayoutProps {
  courses: Course[];
  aiSentenceFiles: SentenceFile[];
  customSentenceFiles: SentenceFile[];
  lastLearningPosition: LastLearningPosition | null;
  errorStats: ErrorStats | null;
  aiTotalSentences: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function TwoColumnLayout({
  courses,
  aiSentenceFiles,
  customSentenceFiles,
  lastLearningPosition,
  errorStats,
  aiTotalSentences,
  onRefresh,
  refreshing,
}: TwoColumnLayoutProps) {
  const { theme, isDark } = useTheme();
  const router = useSafeRouter();
  const { isAuthenticated } = useAuth();
  const sharedStyles = createSharedStyles(theme);
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - Spacing.lg * 2 - 8) / 2; // 8是卡片间距

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCoursePress = (course: Course) => {
    router.push('/course-lessons', { courseId: course.id.toString() });
  };

  const handleSentenceFilePress = (file: SentenceFile) => {
    router.push('/sentence-practice', { fileId: file.id, title: file.title });
  };

  const hasAnyContent = courses.length > 0 || aiSentenceFiles.length > 0 || customSentenceFiles.length > 0;

  // 将课程分组成双列
  const allAIItems = [...courses, ...aiSentenceFiles];

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing['4xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <ThemedView level="root" style={{ marginBottom: Spacing.md }}>
          <ThemedText variant="h3" color={theme.textPrimary}>AI听写云</ThemedText>
        </ThemedView>

        {/* 快捷入口 - 双列 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.md }}>
          {/* 继续学习 */}
          {lastLearningPosition && (
            <TouchableOpacity
              style={[sharedStyles.card, { flex: 1, padding: Spacing.md, alignItems: 'center' }]}
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
              <View style={[sharedStyles.iconContainer, { backgroundColor: theme.success + '15' }]}>
                <FontAwesome6 name="play-circle" size={18} color={theme.success} />
              </View>
              <ThemedText variant="smallMedium" color={theme.textPrimary} style={{ marginTop: 8 }}>继续学习</ThemedText>
              <ThemedText variant="tiny" color={theme.success} style={{ marginTop: 2 }}>
                {Math.round(((lastLearningPosition.sentenceIndex + 1) / lastLearningPosition.totalSentences) * 100)}%
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* 错题本 */}
          {isAuthenticated && errorStats && errorStats.uniqueWords > 0 && (
            <TouchableOpacity
              style={[sharedStyles.card, { flex: 1, padding: Spacing.md, alignItems: 'center' }]}
              onPress={() => router.push('/error-words')}
              activeOpacity={0.7}
            >
              <View style={[sharedStyles.iconContainer, { backgroundColor: theme.error + '15' }]}>
                <FontAwesome6 name="exclamation-triangle" size={18} color={theme.error} />
              </View>
              <ThemedText variant="smallMedium" color={theme.textPrimary} style={{ marginTop: 8 }}>待攻克</ThemedText>
              <ThemedText variant="tiny" color={theme.error} style={{ marginTop: 2 }}>{errorStats.uniqueWords} 个</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* AI 句库 */}
        <View style={sharedStyles.sectionHeader}>
          <View style={sharedStyles.sectionTitleRow}>
            <FontAwesome6 name="graduation-cap" size={16} color={theme.primary} />
            <ThemedText variant="h4" color={theme.textPrimary}>AI 句库</ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>{aiTotalSentences} 句可学</ThemedText>
        </View>

        {/* 双列网格 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {allAIItems.map((item, index) => {
            const isCourse = 'book_number' in item;
            return (
              <TouchableOpacity
                key={isCourse ? `course-${item.id}` : `ai-file-${item.id}`}
                style={[sharedStyles.card, { width: cardWidth, padding: Spacing.md }]}
                onPress={() => isCourse ? handleCoursePress(item as Course) : handleSentenceFilePress(item as SentenceFile)}
                activeOpacity={0.7}
              >
                <View style={[sharedStyles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
                  <FontAwesome6 name="graduation-cap" size={16} color={theme.primary} />
                </View>
                <ThemedText variant="smallMedium" color={theme.textPrimary} style={{ marginTop: 8 }} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText variant="tiny" color={theme.textMuted} style={{ marginTop: 2 }}>
                  {isCourse 
                    ? `${(item as Course).total_lessons} 课`
                    : formatDuration((item as SentenceFile).original_duration)}
                </ThemedText>
                <ThemedText variant="tiny" color={theme.success}>
                  {isCourse 
                    ? `${(item as Course).total_sentences || (item as Course).total_lessons * 18} 句`
                    : `${(item as SentenceFile).ready_sentences_count} 句`}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 自制句库 */}
        {customSentenceFiles.length > 0 && (
          <>
            <View style={[sharedStyles.sectionHeader, { marginTop: Spacing.xl }]}>
              <View style={sharedStyles.sectionTitleRow}>
                <FontAwesome6 name="folder-open" size={16} color={theme.accent} />
                <ThemedText variant="h4" color={theme.textPrimary}>自制句库</ThemedText>
              </View>
              <ThemedText variant="caption" color={theme.textMuted}>
                {customSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
              </ThemedText>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {customSentenceFiles.map((file) => (
                <TouchableOpacity
                  key={`custom-file-${file.id}`}
                  style={[sharedStyles.card, { width: cardWidth, padding: Spacing.md }]}
                  onPress={() => handleSentenceFilePress(file)}
                  activeOpacity={0.7}
                >
                  <View style={[sharedStyles.iconContainer, { backgroundColor: theme.accent + '15' }]}>
                    <FontAwesome6 name="book-open" size={16} color={theme.accent} />
                  </View>
                  <ThemedText variant="smallMedium" color={theme.textPrimary} style={{ marginTop: 8 }} numberOfLines={1}>
                    {file.title}
                  </ThemedText>
                  <ThemedText variant="tiny" color={theme.textMuted}>{formatDuration(file.original_duration)}</ThemedText>
                  <ThemedText variant="tiny" color={theme.success}>{file.ready_sentences_count} 句</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* 空状态 */}
        {!hasAnyContent && courses.length === 0 && (
          <View style={[sharedStyles.emptyContainer, { marginTop: Spacing['2xl'] }]}>
            <View style={[sharedStyles.emptyIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <FontAwesome6 name="headphones" size={36} color={theme.primary} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ marginBottom: 4 }}>开启你的听力之旅</ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>点击课程开始学习</ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
