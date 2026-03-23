import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing } from '@/constants/theme';
import {
  getErrorWords,
  clearErrorWord,
  clearAllErrorWords,
} from '@/utils/learningStorage';

interface ErrorWord {
  word: string;
  count: number;
  lastErrorAt: number;
  sentenceText?: string;
}

export default function ErrorWordsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const [errorWords, setErrorWords] = useState<ErrorWord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchErrorWords = useCallback(async () => {
    setLoading(true);
    try {
      const words = await getErrorWords();
      setErrorWords(words);
    } catch (error) {
      console.error('获取错题失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchErrorWords();
    }, [fetchErrorWords])
  );

  const handleDeleteWord = async (word: string) => {
    Alert.alert(
      '确认删除',
      `确定要清除 "${word}" 的错题记录吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await clearErrorWord(word);
            fetchErrorWords();
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (errorWords.length === 0) return;
    
    Alert.alert(
      '确认清空',
      '确定要清空所有错题记录吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            await clearAllErrorWords();
            fetchErrorWords();
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            错题本
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={styles.subtitle}>
            记录你容易拼错的单词，针对性复习
          </ThemedText>
        </ThemedView>

        {/* Word Count */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="h4" color={theme.textPrimary}>
            错题列表
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted}>
            共 {errorWords.length} 个
          </ThemedText>
        </View>

        {errorWords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="circle-check" size={32} color={theme.success} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
              暂无错题记录
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              继续保持，加油！
            </ThemedText>
          </View>
        ) : (
          <>
            {errorWords.map((item, index) => (
              <View key={item.word} style={styles.wordCard}>
                <View style={styles.wordInfo}>
                  <ThemedText variant="h4" color={theme.textPrimary} style={styles.wordText}>
                    {item.word}
                  </ThemedText>
                  {item.sentenceText && (
                    <ThemedText variant="small" color={theme.textMuted} style={styles.sentenceText} numberOfLines={1}>
                      &ldquo;{item.sentenceText}&rdquo;
                    </ThemedText>
                  )}
                  <View style={styles.wordMeta}>
                    <View style={styles.errorBadge}>
                      <FontAwesome6 name="xmark" size={10} color={theme.error} />
                      <ThemedText variant="tiny" style={styles.errorCount}>
                        错误 {item.count} 次
                      </ThemedText>
                    </View>
                    <ThemedText variant="tiny" color={theme.textMuted}>
                      {formatTime(item.lastErrorAt)}
                    </ThemedText>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteWord(item.word)}
                >
                  <FontAwesome6 name="trash" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Clear All Button */}
            <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
              <FontAwesome6 name="trash-can" size={18} color={theme.error} />
              <ThemedText variant="bodyMedium" style={styles.clearAllText}>
                清空所有错题
              </ThemedText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
