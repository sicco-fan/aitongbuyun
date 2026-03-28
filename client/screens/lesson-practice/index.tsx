import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';

interface Sentence {
  id: number;
  sentence_index: number;
  english_text: string;
  chinese_text: string;
  audio_url?: string;
  audio_duration?: number;
}

interface Lesson {
  id: number;
  lesson_number: number;
  title: string;
  description: string;
  sentences_count: number;
}

interface Voice {
  id: string;
  name: string;
  gender: string;
  style: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function LessonPracticeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ lessonId: string; title: string }>();
  const lessonId = params.lessonId;
  const title = params.title || '课时练习';
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('zh_female_xiaohe_uranus_bigtts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!lessonId) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${selectedVoice}`
      );
      const data = await response.json();
      
      if (data.lesson) {
        setLesson(data.lesson);
      }
      if (data.sentences) {
        setSentences(data.sentences);
      }
      if (data.available_voices) {
        setVoices(data.available_voices);
      }
    } catch (error) {
      console.error('获取课时内容失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lessonId, selectedVoice]);

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

  const handleStartPractice = useCallback(() => {
    // 跳转到听写练习页面
    router.push('/sentence-practice', {
      sourceType: 'lesson',
      sourceId: lessonId,
      voiceId: selectedVoice,
      title: title,
    });
  }, [router, lessonId, selectedVoice, title]);

  const hasAudio = sentences.some(s => s.audio_url);

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载课时内容中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
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
            返回课时列表
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText variant="small" color={theme.textSecondary} style={styles.subtitle}>
            {lesson?.description || '共 ' + sentences.length + ' 个句子'}
          </ThemedText>
        </View>

        {/* 音色选择 */}
        <View style={styles.voiceSection}>
          <ThemedText variant="h4" color={theme.textPrimary} style={styles.sectionTitle}>
            选择音色
          </ThemedText>
          <View style={styles.voiceSelector}>
            {voices.map((voice) => (
              <TouchableOpacity
                key={voice.id}
                style={[
                  styles.voiceChip,
                  selectedVoice === voice.id && styles.voiceChipSelected,
                ]}
                onPress={() => setSelectedVoice(voice.id)}
              >
                <ThemedText
                  variant="small"
                  color={selectedVoice === voice.id ? theme.primary : theme.textSecondary}
                  style={selectedVoice === voice.id ? styles.voiceChipTextSelected : styles.voiceChipText}
                >
                  {voice.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 统计信息 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText variant="h3" color={theme.primary} style={styles.statValue}>
              {sentences.length}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              句子数
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText variant="h3" color={theme.primary} style={styles.statValue}>
              {sentences.filter(s => s.audio_url).length}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              已生成音频
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText variant="h3" color={hasAudio ? theme.success : theme.textMuted} style={styles.statValue}>
              {hasAudio ? '✓' : '○'}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              可学习
            </ThemedText>
          </View>
        </View>

        {/* 句子预览 */}
        {sentences.slice(0, 5).map((sentence) => (
          <View key={sentence.id} style={styles.sentenceCard}>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.sentenceIndex}>
              句子 {sentence.sentence_index}
            </ThemedText>
            <ThemedText variant="body" color={theme.textPrimary} style={styles.englishText}>
              {sentence.english_text}
            </ThemedText>
            <ThemedText variant="small" color={theme.textSecondary} style={styles.chineseText}>
              {sentence.chinese_text}
            </ThemedText>
          </View>
        ))}

        {sentences.length > 5 && (
          <ThemedText variant="small" color={theme.textMuted} style={{ textAlign: 'center', marginBottom: 16 }}>
            还有 {sentences.length - 5} 个句子...
          </ThemedText>
        )}

        {/* 开始练习按钮 */}
        <TouchableOpacity
          style={[styles.startButton, !hasAudio && { backgroundColor: theme.textMuted }]}
          onPress={handleStartPractice}
          disabled={!hasAudio}
        >
          <ThemedText variant="body" color={theme.buttonPrimaryText} style={styles.startButtonText}>
            {hasAudio ? '开始听写练习' : '请先生成音频'}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
