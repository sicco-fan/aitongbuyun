import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  RefreshControl,
  Image,
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

interface SingleColumnLayoutProps {
  courses: Course[];
  aiSentenceFiles: SentenceFile[];
  customSentenceFiles: SentenceFile[];
  lastLearningPosition: LastLearningPosition | null;
  errorStats: ErrorStats | null;
  aiTotalSentences: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function SingleColumnLayout({
  courses,
  aiSentenceFiles,
  customSentenceFiles,
  lastLearningPosition,
  errorStats,
  aiTotalSentences,
  onRefresh,
  refreshing,
}: SingleColumnLayoutProps) {
  const { theme, isDark } = useTheme();
  const router = useSafeRouter();
  const { isAuthenticated, user } = useAuth();
  const sharedStyles = createSharedStyles(theme);

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

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing['4xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <ThemedView level="root" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <ThemedText variant="h3" color={theme.textPrimary}>AI听写云</ThemedText>
          {isAuthenticated && user?.avatar_url && (
            <Image 
              source={{ uri: user.avatar_url }} 
              style={{ width: 28, height: 28, borderRadius: 14 }}
            />
          )}
        </ThemedView>

        {/* 继续学习 */}
        {lastLearningPosition && (
          <TouchableOpacity
            style={[sharedStyles.card, sharedStyles.cardPadding, { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' }]}
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
            <View style={[sharedStyles.iconContainer, { backgroundColor: theme.success + '20' }]}>
              <FontAwesome6 name="play-circle" size={18} color={theme.success} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>继续学习</ThemedText>
              <ThemedText variant="small" color={theme.textSecondary} numberOfLines={1}>
                {lastLearningPosition.sourceType === 'lesson' 
                  ? `${lastLearningPosition.courseTitle} · 第${lastLearningPosition.lessonNumber}课`
                  : lastLearningPosition.fileTitle}
              </ThemedText>
            </View>
            <View style={[sharedStyles.tag, { backgroundColor: theme.success + '15' }]}>
              <ThemedText variant="smallMedium" color={theme.success}>
                {Math.round(((lastLearningPosition.sentenceIndex + 1) / lastLearningPosition.totalSentences) * 100)}%
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}

        {/* 错题本 */}
        {isAuthenticated && errorStats && errorStats.uniqueWords > 0 && (
          <TouchableOpacity
            style={[sharedStyles.card, sharedStyles.cardPadding, { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => router.push('/error-words')}
            activeOpacity={0.7}
          >
            <View style={[sharedStyles.iconContainerSmall, { backgroundColor: theme.error + '20' }]}>
              <FontAwesome6 name="exclamation-triangle" size={14} color={theme.error} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>待攻克词汇</ThemedText>
              <ThemedText variant="small" color={theme.textSecondary}>{errorStats.uniqueWords} 个薄弱词汇</ThemedText>
            </View>
            <View style={[sharedStyles.tag, { backgroundColor: theme.error + '15' }]}>
              <ThemedText variant="smallMedium" color={theme.error}>{errorStats.totalErrors}</ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}

        {/* AI 句库 */}
        <View style={[sharedStyles.sectionHeader, { marginTop: Spacing.lg }]}>
          <View style={sharedStyles.sectionTitleRow}>
            <FontAwesome6 name="graduation-cap" size={16} color={theme.primary} />
            <ThemedText variant="h4" color={theme.textPrimary}>AI 句库</ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>{aiTotalSentences} 句可学</ThemedText>
        </View>

        {courses.map((course) => {
          const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && lastLearningPosition.courseId === course.id;
          return (
            <TouchableOpacity
              key={`course-${course.id}`}
              style={[sharedStyles.card, sharedStyles.cardPadding, { marginBottom: 8, flexDirection: 'row', alignItems: 'center' }, isLastLearned && { borderColor: theme.success + '50' }]}
              onPress={() => handleCoursePress(course)}
              activeOpacity={0.7}
            >
              <View style={[sharedStyles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
                <FontAwesome6 name="graduation-cap" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>{course.title}</ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <ThemedText variant="tiny" color={theme.textMuted}>{course.total_lessons} 课</ThemedText>
                  <ThemedText variant="tiny" color={theme.textMuted}>·</ThemedText>
                  <ThemedText variant="tiny" color={theme.textMuted}>{course.total_sentences || course.total_lessons * 18} 句</ThemedText>
                </View>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}

        {aiSentenceFiles.map((file) => (
          <TouchableOpacity
            key={`ai-file-${file.id}`}
            style={[sharedStyles.card, sharedStyles.cardPadding, { marginBottom: 8, flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => handleSentenceFilePress(file)}
            activeOpacity={0.7}
          >
            <View style={[sharedStyles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
              <FontAwesome6 name="graduation-cap" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>{file.title}</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <ThemedText variant="tiny" color={theme.textMuted}>{formatDuration(file.original_duration)}</ThemedText>
                <ThemedText variant="tiny" color={theme.textMuted}>·</ThemedText>
                <ThemedText variant="tiny" color={theme.success}>{file.ready_sentences_count} 句可学</ThemedText>
              </View>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        ))}

        {/* 自制句库 */}
        <View style={[sharedStyles.sectionHeader, { marginTop: Spacing.xl }]}>
          <View style={sharedStyles.sectionTitleRow}>
            <FontAwesome6 name="folder-open" size={16} color={theme.accent} />
            <ThemedText variant="h4" color={theme.textPrimary}>自制句库</ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            {customSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
          </ThemedText>
        </View>

        {customSentenceFiles.length > 0 ? customSentenceFiles.map((file) => (
          <TouchableOpacity
            key={`custom-file-${file.id}`}
            style={[sharedStyles.card, sharedStyles.cardPadding, { marginBottom: 8, flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => handleSentenceFilePress(file)}
            activeOpacity={0.7}
          >
            <View style={[sharedStyles.iconContainer, { backgroundColor: theme.accent + '15' }]}>
              <FontAwesome6 name="book-open" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>{file.title}</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <ThemedText variant="tiny" color={theme.textMuted}>{formatDuration(file.original_duration)}</ThemedText>
                <ThemedText variant="tiny" color={theme.textMuted}>·</ThemedText>
                <ThemedText variant="tiny" color={theme.success}>{file.ready_sentences_count} 句可学</ThemedText>
              </View>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        )) : (
          <View style={sharedStyles.emptyContainer}>
            <View style={[sharedStyles.emptyIconContainer, { backgroundColor: theme.accent + '10' }]}>
              <FontAwesome6 name="folder-open" size={32} color={theme.accent} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ marginBottom: 4 }}>暂无自制句库</ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>上传视频或音频文件，提取文本制作句库</ThemedText>
          </View>
        )}

        {/* 空状态引导 */}
        {!hasAnyContent && courses.length === 0 && (
          <View style={[sharedStyles.emptyContainer, { marginTop: Spacing['2xl'] }]}>
            <View style={[sharedStyles.emptyIconContainer, { backgroundColor: theme.primary + '10' }]}>
              <FontAwesome6 name="headphones" size={36} color={theme.primary} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ marginBottom: 4 }}>开启你的听力之旅</ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>点击上方课程开始学习</ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
