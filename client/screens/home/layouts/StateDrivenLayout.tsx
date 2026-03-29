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

interface StateDrivenLayoutProps {
  courses: Course[];
  aiSentenceFiles: SentenceFile[];
  customSentenceFiles: SentenceFile[];
  lastLearningPosition: LastLearningPosition | null;
  errorStats: ErrorStats | null;
  aiTotalSentences: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function StateDrivenLayout({
  courses,
  aiSentenceFiles,
  customSentenceFiles,
  lastLearningPosition,
  errorStats,
  aiTotalSentences,
  onRefresh,
  refreshing,
}: StateDrivenLayoutProps) {
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
  const allResources = [...courses, ...aiSentenceFiles, ...customSentenceFiles];
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

        {/* 学习状态卡片 - 根据用户状态动态显示 */}
        {lastLearningPosition ? (
          <TouchableOpacity
            style={[sharedStyles.heroCard, { backgroundColor: theme.success + '08', borderWidth: 1.5, borderColor: theme.success + '25' }]}
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[sharedStyles.iconContainer, { backgroundColor: theme.success + '20', width: 48, height: 48, borderRadius: 24 }]}>
                <FontAwesome6 name="play-circle" size={22} color={theme.success} />
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
                <ThemedText variant="h3" color={theme.success}>{progressPercent}%</ThemedText>
              </View>
            </View>
            <View style={[sharedStyles.progressBar, { backgroundColor: theme.success + '15', marginTop: Spacing.md }]}>
              <View style={[sharedStyles.progressFill, { backgroundColor: theme.success, width: `${progressPercent}%` }]} />
            </View>
          </TouchableOpacity>
        ) : (
          // 欢迎引导卡片
          <View style={[sharedStyles.heroCard, { backgroundColor: theme.primary + '08', borderWidth: 1, borderColor: theme.border }]}>
            <View style={{ alignItems: 'center' }}>
              <View style={[sharedStyles.emptyIconContainer, { backgroundColor: theme.primary + '12', width: 64, height: 64, borderRadius: 32 }]}>
                <FontAwesome6 name="headphones" size={28} color={theme.primary} />
              </View>
              <ThemedText variant="h4" color={theme.textPrimary} style={{ marginTop: 12 }}>开启听力学习之旅</ThemedText>
              <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 4 }}>选择下方资源开始学习</ThemedText>
            </View>
          </View>
        )}

        {/* 功能入口区 - 根据数据显示 */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.md, marginBottom: Spacing.md }}>
          {isAuthenticated && errorStats && errorStats.uniqueWords > 0 && (
            <TouchableOpacity
              style={[sharedStyles.card, { flex: 1, padding: Spacing.md, flexDirection: 'row', alignItems: 'center' }]}
              onPress={() => router.push('/error-words')}
              activeOpacity={0.7}
            >
              <View style={[sharedStyles.iconContainerSmall, { backgroundColor: theme.error + '20' }]}>
                <FontAwesome6 name="exclamation-triangle" size={14} color={theme.error} />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <ThemedText variant="smallMedium" color={theme.textPrimary}>错题本</ThemedText>
                <ThemedText variant="tiny" color={theme.error}>{errorStats.uniqueWords} 个待攻克</ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* 统一的学习资源区 */}
        <View style={sharedStyles.sectionHeader}>
          <ThemedText variant="h4" color={theme.textPrimary}>学习资源</ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            {aiTotalSentences + customSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
          </ThemedText>
        </View>

        {/* 资源列表 */}
        {allResources.map((item) => {
          const isCourse = 'book_number' in item;
          const isAI = isCourse || (item as SentenceFile).source_type === 'ai_tts';
          const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && 
                               lastLearningPosition?.courseId === (item as Course).id;
          
          return (
            <TouchableOpacity
              key={isCourse ? `course-${item.id}` : `file-${item.id}`}
              style={[
                sharedStyles.card, 
                { padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
                isLastLearned && { borderColor: theme.success + '40', borderWidth: 1.5 }
              ]}
              onPress={() => isCourse ? handleCoursePress(item as Course) : handleSentenceFilePress(item as SentenceFile)}
              activeOpacity={0.7}
            >
              <View style={[
                sharedStyles.iconContainer, 
                { backgroundColor: isAI ? theme.primary + '15' : theme.accent + '15', width: 40, height: 40, borderRadius: 10 }
              ]}>
                <FontAwesome6 
                  name={isAI ? "graduation-cap" : "book-open"} 
                  size={16} 
                  color={isAI ? theme.primary : theme.accent} 
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
                    {item.title}
                  </ThemedText>
                  {isLastLearned && (
                    <View style={[sharedStyles.tag, { backgroundColor: theme.success + '15', marginLeft: 8 }]}>
                      <ThemedText variant="tiny" color={theme.success}>上次学到</ThemedText>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {isCourse ? (
                    <>
                      <ThemedText variant="tiny" color={theme.textMuted}>{(item as Course).total_lessons} 课</ThemedText>
                      <ThemedText variant="tiny" color={theme.textMuted}>·</ThemedText>
                      <ThemedText variant="tiny" color={theme.success}>
                        {(item as Course).total_sentences || (item as Course).total_lessons * 18} 句
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {formatDuration((item as SentenceFile).original_duration)}
                      </ThemedText>
                      <ThemedText variant="tiny" color={theme.textMuted}>·</ThemedText>
                      <ThemedText variant="tiny" color={theme.success}>
                        {(item as SentenceFile).ready_sentences_count} 句可学
                      </ThemedText>
                    </>
                  )}
                </View>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}

        {/* 空状态提示 */}
        {!hasAnyContent && (
          <View style={[sharedStyles.emptyContainer, { marginTop: Spacing.xl }]}>
            <ThemedText variant="small" color={theme.textMuted}>点击资源开始你的学习</ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
