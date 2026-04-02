import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Text,
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

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface SentenceFile {
  id: number;
  title: string;
  sentences_count: number;
  ready_sentences_count: number;
  status: string;
  original_duration: number;
  source_type?: string;
  created_by?: string;
  description?: string;
  is_shared?: boolean;
  share_info?: { id: number; download_count: number } | null;
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
  const { isAuthenticated, user } = useAuth();
  const sharedStyles = createSharedStyles(theme);

  // 操作菜单状态
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SentenceFile | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareDescription, setShareDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // 检查是否是用户自己创建的资源
  const isUserOwned = (file: SentenceFile) => {
    return isAuthenticated && user?.id && file.created_by === user.id;
  };

  // 打开操作菜单
  const handleMorePress = (file: SentenceFile) => {
    setSelectedFile(file);
    setActionModalVisible(true);
  };

  // 删除句库
  const handleDelete = useCallback(async () => {
    if (!selectedFile || !user?.id) return;

    setActionModalVisible(false);

    Alert.alert(
      '确认删除',
      `确定要删除「${selectedFile.title}」吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/my-files/${selectedFile.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: user.id }),
                }
              );

              const result = await response.json();

              if (result.success) {
                onRefresh();
              } else {
                Alert.alert('错误', result.error || '删除失败');
              }
            } catch (error) {
              console.error('删除失败:', error);
              Alert.alert('错误', '网络错误，请稍后重试');
            }
          },
        },
      ]
    );
  }, [selectedFile, user?.id, onRefresh]);

  // 分享句库
  const handleShare = useCallback(() => {
    if (!selectedFile) return;
    setActionModalVisible(false);
    setShareDescription(selectedFile.description || '');
    setShareModalVisible(true);
  }, [selectedFile]);

  // 确认分享
  const handleConfirmShare = async () => {
    if (!selectedFile || !user?.id) return;

    setSubmitting(true);

    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence_file_id: selectedFile.id,
            shared_by: user.id,
            description: shareDescription.trim(),
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setShareModalVisible(false);
        Alert.alert('成功', '句库已分享到市场');
        onRefresh();
      } else {
        Alert.alert('错误', result.error || '分享失败');
      }
    } catch (error) {
      console.error('分享失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 取消分享
  const handleCancelShare = useCallback(async () => {
    if (!selectedFile?.share_info || !user?.id) return;

    setActionModalVisible(false);

    Alert.alert(
      '取消分享',
      '确定要取消分享吗？其他用户将无法在市场中看到此句库。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/${selectedFile.share_info?.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: user.id }),
                }
              );

              const result = await response.json();

              if (result.success) {
                Alert.alert('成功', '已取消分享');
                onRefresh();
              } else {
                Alert.alert('错误', result.error || '操作失败');
              }
            } catch (error) {
              console.error('取消分享失败:', error);
              Alert.alert('错误', '网络错误，请稍后重试');
            }
          },
        },
      ]
    );
  }, [selectedFile, user?.id, onRefresh]);

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
        <ThemedView level="root" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <ThemedText variant="h3" color={theme.textPrimary}>AI听写云</ThemedText>
          {isAuthenticated && user?.avatar_url && (
            <Image
              source={{ uri: user.avatar_url }}
              style={{ width: 28, height: 28, borderRadius: 14 }}
            />
          )}
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
          <TouchableOpacity
            onPress={() => router.push('/courses')}
            style={{ flexDirection: 'row', alignItems: 'baseline' }}
            activeOpacity={0.7}
          >
            <ThemedText variant="h4" color={theme.textPrimary}>学习资源</ThemedText>
            <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} style={{ marginLeft: 4, opacity: 0.4 }} />
          </TouchableOpacity>
          <ThemedText variant="caption" color={theme.textMuted}>
            {aiTotalSentences + customSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
          </ThemedText>
        </View>

        {/* 资源列表 */}
        {allResources.map((item) => {
          const isCourse = 'book_number' in item;
          const isAI = isCourse || (item as SentenceFile).source_type === 'ai_tts';
          const isPreset = (item as SentenceFile).source_type === 'preset';
          const file = isCourse ? null : (item as SentenceFile);
          const canManage = file && isUserOwned(file) && !isPreset;
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
                  {file?.is_shared && (
                    <View style={[sharedStyles.tag, { backgroundColor: theme.success + '15', marginLeft: 4 }]}>
                      <FontAwesome6 name="share-nodes" size={8} color={theme.success} />
                      <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 2 }}>
                        {file.share_info?.download_count || 0}
                      </ThemedText>
                    </View>
                  )}
                  {isLastLearned && (
                    <View style={[sharedStyles.tag, { backgroundColor: theme.success + '15', marginLeft: 4 }]}>
                      <ThemedText variant="tiny" color={theme.success}>上次</ThemedText>
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
              {/* 更多按钮 - 仅对用户自己创建的资源显示 */}
              {canManage && (
                <TouchableOpacity
                  style={{ padding: 8, marginRight: -4 }}
                  onPress={() => handleMorePress(file)}
                >
                  <FontAwesome6 name="ellipsis-vertical" size={14} color={theme.textMuted} />
                </TouchableOpacity>
              )}
              {!canManage && (
                <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
              )}
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

      {/* 操作菜单弹窗 */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setActionModalVisible(false)}
          activeOpacity={1}
        >
          <View style={{
            backgroundColor: theme.backgroundDefault,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 34,
          }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ textAlign: 'center', fontWeight: '600' }}>
                {selectedFile?.title}
              </ThemedText>
            </View>

            {/* 分享/取消分享 */}
            {selectedFile?.is_shared ? (
              <TouchableOpacity
                style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                onPress={handleCancelShare}
              >
                <FontAwesome6 name="xmark" size={20} color={theme.textSecondary} />
                <ThemedText variant="body" color={theme.textPrimary}>取消分享</ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                onPress={handleShare}
              >
                <FontAwesome6 name="share" size={20} color={theme.accent} />
                <ThemedText variant="body" color={theme.textPrimary}>分享到市场</ThemedText>
              </TouchableOpacity>
            )}

            {/* 删除 */}
            <TouchableOpacity
              style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              onPress={handleDelete}
            >
              <FontAwesome6 name="trash" size={20} color={theme.error} />
              <ThemedText variant="body" color={theme.error}>删除</ThemedText>
            </TouchableOpacity>

            {/* 取消 */}
            <TouchableOpacity
              style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}
              onPress={() => setActionModalVisible(false)}
            >
              <ThemedText variant="bodyMedium" color={theme.textSecondary}>取消</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 分享弹窗 */}
      <Modal visible={shareModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{
            backgroundColor: theme.backgroundDefault,
            borderRadius: 16,
            width: '100%',
            maxWidth: 360,
            padding: 20,
          }}>
            <ThemedText variant="h4" color={theme.textPrimary} style={{ marginBottom: 8 }}>
              分享到市场
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={{ marginBottom: 16 }}>
              分享后，其他用户可以在市场中看到并下载此句库
            </ThemedText>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 8,
                padding: 12,
                minHeight: 80,
                textAlignVertical: 'top',
                color: theme.textPrimary,
                marginBottom: 16,
              }}
              value={shareDescription}
              onChangeText={setShareDescription}
              placeholder="添加描述，让更多人了解这个句库..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: theme.border, alignItems: 'center' }}
                onPress={() => setShareModalVisible(false)}
              >
                <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: theme.primary, alignItems: 'center' }}
                onPress={handleConfirmShare}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <Text style={{ color: theme.buttonPrimaryText, fontWeight: '600' }}>确认分享</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
