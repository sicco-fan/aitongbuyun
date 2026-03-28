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

interface SentenceFile {
  id: number;
  title: string;
  sentences_count: number;
  ready_sentences_count: number;
  status: string;
  original_duration: number;
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
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const sentenceFilesRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const sentenceFilesData = await sentenceFilesRes.json();

      if (sentenceFilesData.files) {
        // 只显示有可学习句子的文件
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

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

        {/* 精品课程入口 */}
        <TouchableOpacity
          style={[styles.courseCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}
          onPress={() => router.push('/courses')}
          activeOpacity={0.7}
        >
          <View style={[styles.courseIconContainer, { backgroundColor: theme.primary + '15' }]}>
            <FontAwesome6 name="graduation-cap" size={24} color={theme.primary} />
          </View>
          <View style={styles.courseInfo}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              精品课程
            </ThemedText>
            <ThemedText variant="small" color={theme.textSecondary}>
              新概念英语第三册 · 10课
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.primary} />
        </TouchableOpacity>

        {/* 句库学习 Section */}
        {sentenceFiles.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText variant="h4" color={theme.textPrimary}>
                句库学习
              </ThemedText>
              <ThemedText variant="caption" color={theme.textMuted}>
                {sentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0)} 句可学
              </ThemedText>
            </View>

            {sentenceFiles.map((file) => (
              <TouchableOpacity
                key={`sentence-${file.id}`}
                style={styles.materialCard}
                onPress={() => handleSentenceFilePress(file)}
                activeOpacity={0.7}
              >
                <View style={styles.materialHeader}>
                  <View style={[styles.materialIconContainer, { backgroundColor: theme.accent + '20' }]}>
                    <FontAwesome6 name="book-open" size={20} color={theme.accent} />
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
            ))}
          </>
        )}

        {/* 空状态 */}
        {sentenceFiles.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="book-open" size={32} color={theme.primary} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
              暂无句库
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              请先在「我的」→「句库制作」中创建句库
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
