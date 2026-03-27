import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, View, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface ErrorWordItem {
  word: string;
  totalCount: number;
  sentences: Array<{
    sentence_file_id: number;
    sentence_index: number;
    sentence_text: string | null;
    error_count: number;
    last_error_at: string;
  }>;
}

interface ErrorWordData {
  data: ErrorWordItem[];
  totalUniqueWords: number;
  totalErrors: number;
}

export default function ErrorWordsScreen() {
  const { theme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const router = useSafeRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState<ErrorWordData | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showTipModal, setShowTipModal] = useState(false);

  const fetchErrorWords = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      /**
       * 服务端文件：server/src/routes/error-words.ts
       * 接口：GET /api/v1/error-words
       * Query 参数：user_id: string
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words?user_id=${user.id}`
      );
      const data = await response.json();
      
      if (data.success) {
        setErrorData(data);
      }
    } catch (error) {
      console.error('获取错题列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchErrorWords();
    }, [fetchErrorWords])
  );

  const handlePracticeWord = useCallback((item: ErrorWordItem) => {
    // 跳转到第一个包含该错题的句子
    const firstSentence = item.sentences[0];
    if (firstSentence) {
      router.push('/sentence-practice', {
        fileId: firstSentence.sentence_file_id,
        sentenceIndex: firstSentence.sentence_index,
        errorPriority: true,
        targetWord: item.word.toLowerCase(),
        targetCorrectCount: item.totalCount, // 需要正确输入的次数
      });
    }
  }, [router]);

  const handleClearWord = useCallback((word: string) => {
    Alert.alert(
      '清除错题',
      `确定要清除单词 "${word}" 的错题记录吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              /**
               * 服务端文件：server/src/routes/error-words.ts
               * 接口：DELETE /api/v1/error-words
               * Query 参数：user_id: string, word: string
               */
              await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words?user_id=${user?.id}&word=${encodeURIComponent(word)}`,
                { method: 'DELETE' }
              );
              fetchErrorWords();
            } catch (error) {
              console.error('清除错题失败:', error);
            }
          },
        },
      ]
    );
  }, [user?.id, fetchErrorWords]);

  const handleExpandWord = useCallback((word: string) => {
    setSelectedWord(prev => prev === word ? null : word);
  }, []);

  if (!isAuthenticated) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={styles.emptyContainer}>
          <FontAwesome6 name="lock" size={48} color={theme.textMuted} style={styles.emptyIcon} />
          <ThemedText variant="h4" color={theme.textPrimary} style={styles.emptyTitle}>
            请先登录
          </ThemedText>
          <ThemedText variant="body" color={theme.textMuted} style={styles.emptyDesc}>
            登录后可查看您的错题记录
          </ThemedText>
        </ThemedView>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText variant="h2" color={theme.textPrimary}>
              薄弱词
            </ThemedText>
            <View style={styles.titleWithSuperscript}>
              <ThemedText variant="h2" color={theme.textPrimary}>
                汇
              </ThemedText>
              <TouchableOpacity 
                style={styles.superscriptIcon}
                onPress={() => setShowTipModal(true)}
              >
                <FontAwesome6 name="circle-info" size={10} color={theme.border} />
              </TouchableOpacity>
            </View>
          </View>
          <ThemedText variant="body" color={theme.textSecondary} style={{ marginTop: 8 }}>
            点击单词查看详情，针对性练习提升
          </ThemedText>
        </ThemedView>

        {/* Stats */}
        {errorData && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <ThemedText variant="h2" color={theme.primary} style={styles.statValue}>
                {errorData.totalUniqueWords}
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                薄弱词汇
              </ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText variant="h2" color={theme.error} style={styles.statValue}>
                {errorData.totalErrors}
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                累计错误
              </ThemedText>
            </View>
          </View>
        )}

        {/* Word List */}
        {errorData && errorData.data.length > 0 ? (
          errorData.data.map((item) => (
            <TouchableOpacity
              key={item.word}
              style={styles.wordCard}
              onPress={() => handleExpandWord(item.word)}
              activeOpacity={0.7}
            >
              <View style={styles.wordHeader}>
                <ThemedText variant="h3" color={theme.textPrimary} style={styles.wordText}>
                  {item.word}
                </ThemedText>
                <View style={styles.errorBadge}>
                  <ThemedText variant="smallMedium" style={styles.errorBadgeText}>
                    错误 {item.totalCount} 次
                  </ThemedText>
                </View>
              </View>

              {/* Expanded Content */}
              {selectedWord === item.word && (
                <>
                  {item.sentences.slice(0, 3).map((sentence, idx) => (
                    <View key={idx} style={styles.sentenceContainer}>
                      <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
                        {sentence.sentence_text || '（无句子内容）'}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.textMuted} style={styles.sentenceHint}>
                        句库 #{sentence.sentence_file_id} · 第 {sentence.sentence_index + 1} 句
                      </ThemedText>
                    </View>
                  ))}
                  
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.clearBtn]}
                      onPress={() => handleClearWord(item.word)}
                    >
                      <FontAwesome6 name="trash" size={14} color={theme.textMuted} />
                      <ThemedText variant="small" style={styles.clearBtnText}>清除</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.practiceBtn]}
                      onPress={() => handlePracticeWord(item)}
                    >
                      <FontAwesome6 name="play" size={14} color={theme.primary} />
                      <ThemedText variant="smallMedium" style={styles.practiceBtnText}>去练习</ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <ThemedView level="root" style={styles.emptyContainer}>
            <FontAwesome6 name="check-circle" size={48} color={theme.success} style={styles.emptyIcon} />
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.emptyTitle}>
              太棒了！
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyDesc}>
              暂无薄弱词汇，继续保持
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>

      {/* Tips Modal */}
      <Modal
        visible={showTipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTipModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTipModal(false)}>
          <Pressable style={styles.tipModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.tipModalHeader}>
              <FontAwesome6 name="lightbulb" size={20} color={theme.primary} />
              <ThemedText variant="h4" color={theme.textPrimary} style={styles.tipModalTitle}>
                学习小贴士
              </ThemedText>
              <TouchableOpacity onPress={() => setShowTipModal(false)} style={styles.tipModalClose}>
                <FontAwesome6 name="xmark" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.tipModalBody}>
              <View style={styles.tipItem}>
                <FontAwesome6 name="star" size={14} color={theme.primary} style={styles.tipItemIcon} />
                <ThemedText variant="body" color={theme.textSecondary}>
                  错题练习模式可获得 <ThemedText variant="bodyMedium" color={theme.primary}>1.5 倍</ThemedText> 积分奖励
                </ThemedText>
              </View>
              <View style={styles.tipItem}>
                <FontAwesome6 name="arrow-trend-down" size={14} color={theme.primary} style={styles.tipItemIcon} />
                <ThemedText variant="body" color={theme.textSecondary}>
                  单词输入正确可减少错误次数
                </ThemedText>
              </View>
              <View style={styles.tipItem}>
                <FontAwesome6 name="check-circle" size={14} color={theme.success} style={styles.tipItemIcon} />
                <ThemedText variant="body" color={theme.textSecondary}>
                  错误次数减至 <ThemedText variant="bodyMedium" color={theme.success}>0</ThemedText> 后自动清除
                </ThemedText>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
