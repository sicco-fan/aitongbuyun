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
import { Spacing } from '@/constants/theme';
import { createFormDataFile } from '@/utils';

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

interface WordStatus {
  word: string;
  revealed: boolean;
  index: number;
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
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);

  // 单词状态管理
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [feedbackWord, setFeedbackWord] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  
  // 音频控制状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [volume, setVolume] = useState(1.0); // 音量 0-1，可以超过1
  const [isLooping, setIsLooping] = useState(true); // 循环播放
  
  // 语音输入状态
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const currentSentence = sentences[currentIndex];
  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;
  
  // 计算完成进度
  const correctCount = wordStatuses.filter(w => w.revealed).length;
  const totalWords = wordStatuses.length;
  const sentenceProgress = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

  // 初始化录音权限
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasRecordingPermission(status === 'granted');
    })();
  }, []);

  // 加载材料数据
  useEffect(() => {
    const fetchMaterial = async () => {
      if (!materialId) return;

      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
        const data = await response.json();

        if (data.material && data.sentences) {
          setMaterial(data.material);
          const firstIncomplete = data.sentences.findIndex((s: Sentence) => !s.is_completed);
          setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
          setSentences(data.sentences);
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

  // 当切换句子时，初始化单词状态并开始播放
  useEffect(() => {
    if (currentSentence) {
      const words = extractWords(currentSentence.text);
      setWordStatuses(words.map((word, index) => ({
        word,
        revealed: false,
        index,
      })));
      setCurrentInput('');
      setFeedback(null);
      setHintLevel(0);
      setPlayCount(0);
      
      // 自动开始循环播放
      startLoopPlayback();
    }
    
    return () => {
      stopPlayback();
    };
  }, [currentSentence]);

  // 清理音频
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  // 提取单词（去除标点，统一小写）
  const extractWords = (text: string): string[] => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  };

  // 标准化单词（用于比较）
  const normalizeWord = (word: string): string => {
    return word.toLowerCase().replace(/\W/g, '').trim();
  };

  // 开始循环播放
  const startLoopPlayback = useCallback(async () => {
    if (!material?.audio_url) return;

    try {
      // 停止之前的播放
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: material.audio_url },
        { 
          shouldPlay: true, 
          isLooping: true,
          volume: volume,
        },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayCount(prev => prev + 1);
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLooping(true);
    } catch (error) {
      console.error('播放失败:', error);
    }
  }, [material?.audio_url, volume]);

  // 停止播放
  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {
        // 忽略错误
      }
      setIsPlaying(false);
      setIsLooping(false);
    }
  }, []);

  // 暂停播放
  const pausePlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  }, []);

  // 恢复播放
  const resumePlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }, []);

  // 设置音量
  const handleVolumeChange = useCallback(async (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(2, newVolume)); // 允许放大到2倍
    setVolume(clampedVolume);
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(clampedVolume);
    }
  }, []);

  // 切换播放/暂停
  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      await pausePlayback();
    } else {
      if (soundRef.current) {
        await resumePlayback();
      } else {
        await startLoopPlayback();
      }
    }
  }, [isPlaying, pausePlayback, resumePlayback, startLoopPlayback]);

  // 验证单词
  const checkWord = useCallback((inputWord: string) => {
    const normalizedInput = normalizeWord(inputWord);
    if (!normalizedInput) return;

    // 检查是否匹配任何未揭示的单词
    let matched = false;
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      for (let i = 0; i < newStatuses.length; i++) {
        if (!newStatuses[i].revealed && normalizeWord(newStatuses[i].word) === normalizedInput) {
          newStatuses[i] = { ...newStatuses[i], revealed: true };
          matched = true;
          break;
        }
      }
      return newStatuses;
    });

    setTotalAttempts(prev => prev + 1);
    setFeedbackWord(inputWord);

    if (matched) {
      setFeedback('correct');
      // 检查是否完成
      setTimeout(() => {
        checkSentenceComplete();
      }, 300);
    } else {
      setFeedback('incorrect');
    }

    // 清空输入框，继续输入
    setCurrentInput('');
    
    // 清除反馈
    setTimeout(() => {
      setFeedback(null);
    }, 1500);
  }, []);

  // 检查句子是否完成
  const checkSentenceComplete = useCallback(() => {
    const allRevealed = wordStatuses.every(w => w.revealed);
    if (allRevealed && currentSentence) {
      // 停止播放
      stopPlayback();
      
      // 更新服务器状态
      fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence_id: currentSentence.id,
          attempts: totalAttempts + 1,
          is_completed: true,
        }),
      });

      // 更新本地状态
      setSentences(prev => 
        prev.map((s, i) => 
          i === currentIndex ? { ...s, is_completed: true } : s
        )
      );

      // 自动进入下一句
      setTimeout(() => {
        if (currentIndex < sentences.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setCompleted(true);
        }
      }, 1000);
    }
  }, [wordStatuses, currentSentence, currentIndex, sentences.length, totalAttempts, stopPlayback]);

  // 处理输入提交
  const handleSubmit = () => {
    if (currentInput.trim()) {
      checkWord(currentInput.trim());
    }
  };

  // 开始语音录音
  const startRecording = async () => {
    if (!hasRecordingPermission) {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要权限', '请授予麦克风权限');
        return;
      }
      setHasRecordingPermission(true);
    }

    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }

    try {
      // 语音输入时暂停播放
      await pausePlayback();
      
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true 
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('录音失败:', error);
      // 录音失败，恢复播放
      resumePlayback();
    }
  };

  // 停止录音并识别
  const stopRecordingAndRecognize = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (uri) {
        // 上传录音并识别
        const formData = new FormData();
        const audioFile = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
        formData.append('file', audioFile as any);

        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech-recognize`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.text) {
          // 识别成功，提取单词并验证
          const words = data.text.split(/\s+/).filter((w: string) => w.length > 0);
          for (const word of words) {
            checkWord(word);
          }
        }
      }
    } catch (error) {
      console.error('语音识别失败:', error);
      Alert.alert('提示', '语音识别失败，请重试');
    } finally {
      // 语音输入结束后恢复播放
      resumePlayback();
    }
  };

  // 显示提示
  const showHint = () => {
    const newLevel = Math.min(hintLevel + 1, 3);
    setHintLevel(newLevel);

    if (newLevel === 1) {
      const hiddenWord = wordStatuses.find(w => !w.revealed);
      if (hiddenWord) {
        Alert.alert('提示', `第一个未猜出的单词以 "${hiddenWord.word[0]}" 开头`);
      }
    } else if (newLevel === 2) {
      Alert.alert('提示', `还剩 ${wordStatuses.filter(w => !w.revealed).length} 个单词未猜出`);
    } else if (newLevel === 3) {
      Alert.alert('答案', currentSentence?.text || '');
    }
  };

  // 跳过当前句子
  const skipSentence = () => {
    Alert.alert(
      '跳过句子',
      '确定要跳过这个句子吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          onPress: () => {
            stopPlayback();
            if (currentIndex < sentences.length - 1) {
              setCurrentIndex(prev => prev + 1);
            } else {
              setCompleted(true);
            }
          }
        }
      ]
    );
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
                {sentences.filter(s => s.is_completed).length}
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                已完成
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.progressHeader}>
            <View style={styles.progressBadge}>
              <ThemedText variant="captionMedium" color={theme.buttonPrimaryText}>
                {currentIndex + 1}/{sentences.length}
              </ThemedText>
            </View>
            <ThemedText variant="body" color={theme.textMuted}>
              {Math.round(progress)}% 完成
            </ThemedText>
          </View>
          <ThemedText variant="h4" color={theme.textPrimary}>
            {title || material?.title}
          </ThemedText>
        </ThemedView>

        {/* Audio Section */}
        <View style={styles.audioSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
            <TouchableOpacity
              style={[styles.playButton, { width: 56, height: 56 }]}
              onPress={togglePlayback}
            >
              <FontAwesome6
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color={theme.buttonPrimaryText}
              />
            </TouchableOpacity>
            
            {/* 音量控制 */}
            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                <ThemedText variant="caption" color={theme.textMuted}>音量</ThemedText>
                <ThemedText variant="caption" color={theme.textPrimary}>{Math.round(volume * 100)}%</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity
                  style={{ padding: Spacing.sm, backgroundColor: theme.backgroundTertiary, borderRadius: 8 }}
                  onPress={() => handleVolumeChange(volume - 0.2)}
                >
                  <FontAwesome6 name="minus" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: Spacing.sm, backgroundColor: theme.backgroundTertiary, borderRadius: 8 }}
                  onPress={() => handleVolumeChange(volume + 0.2)}
                >
                  <FontAwesome6 name="plus" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: Spacing.sm, backgroundColor: volume > 1 ? theme.primary : theme.backgroundTertiary, borderRadius: 8 }}
                  onPress={() => handleVolumeChange(volume > 1 ? 1 : 1.5)}
                >
                  <FontAwesome6 name="volume-high" size={14} color={volume > 1 ? theme.buttonPrimaryText : theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            {isPlaying ? '循环播放中' : '已暂停'} · 已播放 {playCount} 次
          </ThemedText>
        </View>

        {/* Sentence Display */}
        <View style={styles.sentenceSection}>
          <ThemedText variant="caption" color={theme.textMuted} style={styles.sentenceLabel}>
            句子进度：{correctCount}/{totalWords} ({sentenceProgress}%)
          </ThemedText>
          <View style={styles.wordsContainer}>
            {wordStatuses.map((ws, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.wordSlot, 
                  ws.revealed ? styles.wordCorrect : styles.wordHidden
                ]}
              >
                {ws.revealed ? (
                  <ThemedText 
                    variant="smallMedium" 
                    color={theme.success}
                    style={styles.wordTextCorrect}
                  >
                    {ws.word}
                  </ThemedText>
                ) : (
                  <ThemedText 
                    variant="small" 
                    color={theme.textMuted}
                    style={styles.wordTextHidden}
                  >
                    ___
                  </ThemedText>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.inputLabel}>
            输入单词（空格或回车提交，自动继续）
          </ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={currentInput}
              onChangeText={setCurrentInput}
              onSubmitEditing={handleSubmit}
              placeholder="输入你听到的单词..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
              onPress={isRecording ? stopRecordingAndRecognize : startRecording}
            >
              <FontAwesome6
                name={isRecording ? 'stop' : 'microphone'}
                size={24}
                color={theme.buttonPrimaryText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback */}
        <View style={styles.feedbackSection}>
          {feedback === 'correct' && (
            <View style={styles.feedbackCorrect}>
              <FontAwesome6 name="check" size={16} color={theme.success} />
              <ThemedText variant="smallMedium" style={styles.feedbackCorrectText}>
                「{feedbackWord}」正确！
              </ThemedText>
            </View>
          )}
          {feedback === 'incorrect' && (
            <View style={styles.feedbackIncorrect}>
              <FontAwesome6 name="xmark" size={16} color={theme.error} />
              <ThemedText variant="smallMedium" style={styles.feedbackIncorrectText}>
                「{feedbackWord}」不正确，再试一次
              </ThemedText>
            </View>
          )}
        </View>

        {/* Hint Section */}
        <View style={styles.hintSection}>
          <TouchableOpacity style={styles.hintButton} onPress={showHint}>
            <FontAwesome6 name="lightbulb" size={18} color="#F59E0B" />
            <ThemedText variant="smallMedium" style={styles.hintButtonText}>
              提示 ({hintLevel}/3)
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={skipSentence}
          >
            <ThemedText variant="smallMedium" color={theme.textPrimary}>
              跳过
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
