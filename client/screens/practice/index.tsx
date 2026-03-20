import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';

interface Sentence {
  id: number;
  material_id: number;
  sentence_index: number;
  text: string;
  start_time: number;
  end_time: number;
  attempts: number;
  is_completed: boolean;
}

interface Material {
  id: number;
  title: string;
  audio_url: string;
  duration: number;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

export default function PracticeScreen() {
  const { materialId, title } = useSafeSearchParams<{ materialId: number; title: string }>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const [material, setMaterial] = useState<Material | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  const currentSentence = sentences[currentIndex];
  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;

  // 加载材料数据
  useEffect(() => {
    const fetchMaterial = async () => {
      if (!materialId) return;

      try {
        /**
         * 服务端文件：server/src/routes/materials.ts
         * 接口：GET /api/v1/materials/:id
         */
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
        const data = await response.json();

        if (data.material && data.sentences) {
          setMaterial(data.material);
          // 找到第一个未完成的句子
          const firstIncomplete = data.sentences.findIndex((s: Sentence) => !s.is_completed);
          setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
          setSentences(data.sentences);
          
          // 计算已完成的尝试次数
          const total = data.sentences.reduce((sum: number, s: Sentence) => sum + (s.attempts || 0), 0);
          setTotalAttempts(total);
        }
      } catch (error) {
        console.error('加载材料失败:', error);
        Alert.alert('错误', '加载材料失败');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [materialId]);

  // 清理音频
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // 播放当前句子
  const playSentence = useCallback(async () => {
    if (!material?.audio_url || isPlaying) return;

    try {
      setIsPlaying(true);

      // 如果已有音频在播放，先停止
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // 创建音频
      const { sound } = await Audio.Sound.createAsync(
        { uri: material.audio_url },
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );

      soundRef.current = sound;
      
      // 如果有时间范围，尝试设置播放位置
      if (currentSentence?.start_time && currentSentence?.end_time) {
        await sound.setPositionAsync(currentSentence.start_time);
        // 注意：完整音频中定位播放需要额外的音频处理
      }

      setPlayCount((prev) => prev + 1);
    } catch (error) {
      console.error('播放失败:', error);
      setIsPlaying(false);
      Alert.alert('提示', '音频播放失败，请检查音频文件');
    }
  }, [material?.audio_url, isPlaying, currentSentence]);

  // 停止播放
  const stopPlaying = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
    }
  };

  // 检查答案
  const checkAnswer = async () => {
    if (!currentSentence || !userInput.trim()) {
      Alert.alert('提示', '请输入你听到的内容');
      return;
    }

    // 标准化比较（去除空格和标点差异）
    const normalizeText = (text: string) => 
      text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    const isCorrect = normalizeText(userInput) === normalizeText(currentSentence.text);
    
    // 更新尝试次数
    const newAttempts = (currentSentence.attempts || 0) + 1;
    
    /**
     * 服务端文件：server/src/routes/learning.ts
     * 接口：POST /api/v1/learning-records
     * Body 参数：sentence_id: number, attempts: number, is_completed: boolean
     */
    await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence_id: currentSentence.id,
        attempts: newAttempts,
        is_completed: isCorrect,
      }),
    });

    // 更新本地状态
    setSentences((prev) =>
      prev.map((s, i) =>
        i === currentIndex
          ? { ...s, attempts: newAttempts, is_completed: isCorrect }
          : s
      )
    );
    setTotalAttempts((prev) => prev + 1);

    if (isCorrect) {
      setResult('correct');
    } else {
      setResult('incorrect');
    }
  };

  // 继续下一句
  const nextSentence = () => {
    setResult(null);
    setUserInput('');
    setShowHint(false);
    setHintLevel(0);
    setPlayCount(0);

    if (currentIndex < sentences.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  // 重试当前句
  const retrySentence = () => {
    setResult(null);
    setUserInput('');
    playSentence();
  };

  // 显示提示
  const showHintHandler = () => {
    if (hintLevel < 3) {
      setHintLevel((prev) => prev + 1);
    }
    setShowHint(true);
  };

  // 获取提示文本
  const getHintText = () => {
    if (!currentSentence) return '';
    const text = currentSentence.text;
    
    switch (hintLevel) {
      case 1:
        // 显示第一个词
        return `首词提示：${text.split(' ')[0]}...`;
      case 2:
        // 显示长度
        return `单词数：${text.split(' ').length} 个`;
      case 3:
        // 显示完整答案
        return `完整答案：${text}`;
      default:
        return '';
    }
  };

  // 计算完成统计
  const completedCount = sentences.filter((s) => s.is_completed).length;
  const accuracy = totalAttempts > 0 ? Math.round((completedCount / totalAttempts) * 100) : 0;

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  // 完成界面
  if (completed) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ScrollView contentContainerStyle={[styles.scrollContent, styles.completedContainer]}>
          <FontAwesome6 
            name="circle-check" 
            size={80} 
            color={theme.success} 
            style={styles.completedIcon} 
          />
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.completedTitle}>
            练习完成！
          </ThemedText>
          <ThemedText variant="body" color={theme.textMuted} style={styles.completedSubtitle}>
            你已完成「{title || material?.title}」的所有句子
          </ThemedText>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText variant="h2" color={theme.primary} style={styles.statValue}>
                {sentences.length}
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                总句数
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText variant="h2" color={theme.success} style={styles.statValue}>
                {accuracy}%
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                正确率
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: Spacing.lg }]}
            onPress={() => router.back()}
          >
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              返回首页
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.progressHeader}>
            <View style={styles.progressBadge}>
              <ThemedText variant="captionMedium" color={theme.buttonPrimaryText} style={styles.progressBadgeText}>
                {currentIndex + 1}/{sentences.length}
              </ThemedText>
            </View>
            <ThemedText variant="body" color={theme.textMuted} style={styles.sentenceCounter}>
              {Math.round(progress)}% 完成
            </ThemedText>
          </View>
          <ThemedText variant="h3" color={theme.textPrimary}>
            {title || material?.title || '听力练习'}
          </ThemedText>
        </ThemedView>

        {/* Sentence Card */}
        <View style={styles.sentenceCard}>
          {/* Audio Control */}
          <View style={styles.audioControl}>
            <TouchableOpacity
              style={[styles.playButton, isPlaying && styles.playButtonDisabled]}
              onPress={isPlaying ? stopPlaying : playSentence}
              disabled={!material?.audio_url}
            >
              <FontAwesome6
                name={isPlaying ? 'stop' : 'play'}
                size={32}
                color={theme.buttonPrimaryText}
              />
            </TouchableOpacity>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.playCount}>
              已播放 {playCount} 次
            </ThemedText>
          </View>

          {/* Input */}
          <View style={styles.inputSection}>
            <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.inputLabel}>
              写下你听到的内容
            </ThemedText>
            <TextInput
              style={styles.input}
              value={userInput}
              onChangeText={setUserInput}
              placeholder="输入你听到的句子..."
              placeholderTextColor={theme.textMuted}
              multiline
              editable={!result}
            />
          </View>

          {/* Result */}
          {result && (
            <View style={styles.resultSection}>
              <View style={[styles.resultCard, result === 'correct' ? styles.resultSuccess : styles.resultError]}>
                <View style={styles.resultHeader}>
                  <FontAwesome6
                    name={result === 'correct' ? 'check-circle' : 'times-circle'}
                    size={20}
                    color={result === 'correct' ? theme.success : theme.error}
                    style={styles.resultIcon}
                  />
                  <ThemedText
                    variant="smallMedium"
                    color={result === 'correct' ? theme.success : theme.error}
                    style={styles.resultTitle}
                  >
                    {result === 'correct' ? '回答正确！' : '回答错误'}
                  </ThemedText>
                </View>
                {result === 'incorrect' && (
                  <ThemedText variant="body" color={theme.textPrimary} style={styles.resultText}>
                    正确答案：{currentSentence?.text}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Hint */}
          {showHint && hintLevel > 0 && (
            <View style={styles.hintText}>
              <ThemedText variant="small" color={theme.textPrimary}>
                {getHintText()}
              </ThemedText>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {!result ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.hintButton]}
                  onPress={showHintHandler}
                >
                  <ThemedText variant="smallMedium" color="#F59E0B">
                    {hintLevel === 0 ? '提示' : hintLevel < 3 ? '更多提示' : '显示答案'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={checkAnswer}
                >
                  <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                    检查答案
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {result === 'incorrect' && (
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={retrySentence}
                  >
                    <ThemedText variant="smallMedium" color={theme.textPrimary}>
                      重新听
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={nextSentence}
                >
                  <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                    {currentIndex < sentences.length - 1 ? '下一句' : '完成'}
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

import { Spacing } from '@/constants/theme';
