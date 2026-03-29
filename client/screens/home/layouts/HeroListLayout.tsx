import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  RefreshControl,
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

interface HeroListLayoutProps {
  courses: Course[];
  aiSentenceFiles: SentenceFile[];
  customSentenceFiles: SentenceFile[];
  lastLearningPosition: LastLearningPosition | null;
  errorStats: ErrorStats | null;
  aiTotalSentences: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function HeroListLayout({
  courses,
  aiSentenceFiles,
  customSentenceFiles,
  lastLearningPosition,
  errorStats,
  aiTotalSentences,
  onRefresh,
  refreshing,
}: HeroListLayoutProps) {
  const { theme, isDark } = useTheme();
  const router = useSafeRouter();
  const { isAuthenticated } = useAuth();
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
  const progressPercent = lastLearningPosition 
    ? Math.round(((lastLearningPosition.sentenceIndex + 1) / lastLearningPosition.totalSentences) * 100)
    : 0;

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

        {/* Hero 卡片 - 继续学习或欢迎 */}
        {lastLearningPosition ? (
          <TouchableOpacity
            style={[sharedStyles.heroCard, { backgroundColor: theme.primary + '10', borderWidth: 1.5, borderColor: theme.primary + '30' }]}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
              <View style={[sharedStyles.iconContainer, { backgroundColor: theme.primary + '20', width: 48, height: 48, borderRadius: 24 }]}>
                <FontAwesome6 name="play-circle" size={22} color={theme.primary} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <ThemedText variant="h4" color={theme.textPrimary}>继续学习</ThemedText>
                <ThemedText variant="small" color={theme.textSecondary} numberOfLines={1}>
                  {lastLearningPosition.sourceType === 'lesson' 
                    ? `${lastLearningPosition.courseTitle} · 第${lastLearningPosition.lessonNumber}课`
                    : lastLearningPosition.fileTitle}
                </ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <ThemedText variant="h3" color={theme.primary}>{progressPercent}%</ThemedText>
              </View>
            </View>
            <View style={[sharedStyles.progressBar, { backgroundColor: theme.primary + '20' }]}>
              <View style={[sharedStyles.progressFill, { backgroundColor: theme.primary, width: `${progressPercent}%` }]} />
            </View>
            <ThemedText variant="tiny" color={theme.textMuted} style={{ marginTop: 6 }}>
              {lastLearningPosition.sentenceIndex + 1} / {lastLearningPosition.totalSentences} 句
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={[sharedStyles.heroCard, { backgroundColor: theme.primary + '08', borderWidth: 1, borderColor: theme.border }]}>
            <View style={{ alignItems: 'center', paddingVertical: Spacing.md }}>
              <View style={[sharedStyles.emptyIconContainer, { backgroundColor: theme.primary + '15', width: 60, height: 60, borderRadius: 30 }]}>
                <FontAwesome6 name="headphones" size={28} color={theme.primary} />
              </View>
              <ThemedText variant="h4" color={theme.textPrimary} style={{ marginTop: 12 }}>开启你的听力之旅</ThemedText>
              <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 4 }}>选择下方课程开始学习</ThemedText>
            </View>
          </View>
        )}

        {/* 错题本快捷入口 */}
        {isAuthenticated && errorStats && errorStats.uniqueWords > 0 && (
          <TouchableOpacity
            style={[sharedStyles.card, sharedStyles.cardPadding, { marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center' }]}
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
        <View style={sharedStyles.sectionHeader}>
          <View style={sharedStyles.sectionTitleRow}>
            <FontAwesome6 name="graduation-cap" size={16} color={theme.primary} />
            <ThemedText variant="h4" color={theme.textPrimary}>AI 句库</ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>{aiTotalSentences} 句可学</ThemedText>
        </View>

        {/* 紧凑列表 */}
        {[...courses, ...aiSentenceFiles].map((item) => {
          const isCourse = 'book_number' in item;
          return (
            <TouchableOpacity
              key={isCourse ? `course-${item.id}` : `ai-file-${item.id}`}
              style={[sharedStyles.card, { padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center' }]}
              onPress={() => isCourse ? handleCoursePress(item as Course) : handleSentenceFilePress(item as SentenceFile)}
              activeOpacity={0.7}
            >
              <View style={[sharedStyles.iconContainerSmall, { backgroundColor: theme.primary + '15', width: 36, height: 36, borderRadius: 8 }]}>
                <FontAwesome6 name="graduation-cap" size={14} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <ThemedText variant="smallMedium" color={theme.textPrimary} numberOfLines={1}>{item.title}</ThemedText>
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {isCourse 
                    ? `${(item as Course).total_lessons} 课 · ${(item as Course).total_sentences || (item as Course).total_lessons * 18} 句`
                    : `${formatDuration((item as SentenceFile).original_duration)} · ${(item as SentenceFile).ready_sentences_count} 句`}
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}

        {/* 自制句库 */}
        {customSentenceFiles.length > 0 && (
          <>
            <View style={[sharedStyles.sectionHeader, { marginTop: Spacing.lg }]}>
              <View style={sharedStyles.sectionTitleRow}>
                <FontAwesome6 name="folder-open" size={16} color={theme.accent} />
                <ThemedText variant="h4" color={theme.textPrimary}>自制句库</ThemedText>
              </View>
              <ThemedText variant="caption" color={theme.textMuted}>
                {customSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
              </ThemedText>
            </View>

            {customSentenceFiles.map((file) => (
              <TouchableOpacity
                key={`custom-file-${file.id}`}
                style={[sharedStyles.card, { padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => handleSentenceFilePress(file)}
                activeOpacity={0.7}
              >
                <View style={[sharedStyles.iconContainerSmall, { backgroundColor: theme.accent + '15', width: 36, height: 36, borderRadius: 8 }]}>
                  <FontAwesome6 name="book-open" size={14} color={theme.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <ThemedText variant="smallMedium" color={theme.textPrimary} numberOfLines={1}>{file.title}</ThemedText>
                  <ThemedText variant="tiny" color={theme.textMuted}>
                    {formatDuration(file.original_duration)} · {file.ready_sentences_count} 句
                  </ThemedText>
                </View>
                <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* 空状态 */}
        {!hasAnyContent && courses.length === 0 && (
          <View style={[sharedStyles.emptyContainer, { marginTop: Spacing.xl }]}>
            <ThemedText variant="small" color={theme.textMuted}>点击课程开始你的学习</ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
