import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createFormDataFile } from '@/utils';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Sentence {
  id: number;
  text: string;
  sentence_index: number;
  start_time: number; // 秒
  end_time: number;   // 秒
}

interface SentenceFile {
  id: number;
  title: string;
  original_audio_signed_url: string;
  original_duration: number;
}

interface WordStatus {
  word: string;
  displayText: string;
  revealed: boolean;
  revealedChars: boolean[];
  errorCharIndex: number;
  index: number;
  isPunctuation: boolean;
}

export default function SentencePracticeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ fileId: number; title: string }>();

  const fileId = params.fileId;

  const [file, setFile] = useState<SentenceFile | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 单词状态
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [targetWordIndex, setTargetWordIndex] = useState<number | null>(null); // 当前正在匹配的单词索引

  // 翻译显示
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState('');

  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef(true);
  const isLoopingRef = useRef(true);
  const volumeRef = useRef(1.0);
  const playbackRateRef = useRef(1.0);

  // 错误闪烁动画
  const errorAnimRef = useRef<Animated.Value>(new Animated.Value(0));

  // 语音输入
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const currentSentence = sentences[currentIndex];
  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;

  // 初始化录音权限
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasRecordingPermission(status === 'granted');
    })();
  }, []);

  // 加载可学习的句子
  const fetchSentences = useCallback(async () => {
    if (!fileId) return;

    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files/:id/learnable
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${fileId}/learnable`);
      const data = await response.json();

      if (data.sentences) {
        setFile(data.file);
        setSentences(data.sentences);
        console.log(`[句库学习] 加载了 ${data.sentences.length} 个可学习句子`);
      }
    } catch (error) {
      console.error('加载句子失败:', error);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      fetchSentences();

      return () => {
        isMountedRef.current = false;
        stopPlayback();
      };
    }, [fetchSentences])
  );

  // 提取单词和标点
  const extractWords = useCallback((text: string) => {
    const result: { word: string; displayText: string; isPunctuation: boolean }[] = [];
    
    // 使用正则分割：保留单词（包括内部的 - ' &）和纯标点符号
    // 纯标点符号：,.!?;: 等（不包括 - ' &）
    const tokens = text.match(/[a-zA-Z0-9'\-&]+|[,.\!?;:()"]/g) || [];

    tokens.forEach((token) => {
      // 判断是否为纯标点符号（不包含字母数字、-'&）
      const isPurePunctuation = !/[a-zA-Z0-9]/.test(token);
      
      result.push({
        // 单词：转为小写，保留 -'&
        word: isPurePunctuation ? '' : token.toLowerCase(),
        displayText: token,
        isPunctuation: isPurePunctuation,
      });
    });

    return result;
  }, []);

  // 播放音频片段
  const playAudio = useCallback(async () => {
    if (!currentSentence || !file?.original_audio_signed_url) {
      console.log('[playAudio] 缺少音频或句子');
      return;
    }

    try {
      if (soundRef.current && isPlaying) {
        return;
      }

      if (soundRef.current && !isPlaying) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });

      // 时间转换为毫秒
      const startMs = currentSentence.start_time * 1000;
      const endMs = currentSentence.end_time * 1000;

      console.log(`[playAudio] 播放片段: ${startMs}ms - ${endMs}ms`);

      const { sound } = await Audio.Sound.createAsync(
        { uri: file.original_audio_signed_url },
        {
          shouldPlay: true,
          isLooping: false,
          volume: volumeRef.current,
          rate: playbackRateRef.current,
          shouldCorrectPitch: true,
        },
        (status) => {
          if (status.isLoaded) {
            // 检查是否到达结束时间
            if (status.positionMillis >= endMs) {
              sound.pauseAsync();
              setIsPlaying(false);

              // 循环播放
              if (isLoopingRef.current && isMountedRef.current) {
                setTimeout(() => {
                  if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                    soundRef.current.setPositionAsync(startMs);
                    soundRef.current.playAsync();
                    setIsPlaying(true);
                  }
                }, 500);
              }
            }

            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          } else if (status.error) {
            console.error('[播放错误]', status.error);
            setIsPlaying(false);
          }
        }
      );

      soundRef.current = sound;
      // 设置起始位置
      await sound.setPositionAsync(startMs);
      setIsPlaying(true);

      // 监听播放位置
      const checkInterval = setInterval(async () => {
        if (!soundRef.current) {
          clearInterval(checkInterval);
          return;
        }
        const s = await soundRef.current.getStatusAsync();
        if (s.isLoaded && s.positionMillis >= endMs) {
          await sound.pauseAsync();
          setIsPlaying(false);
          clearInterval(checkInterval);

          // 循环播放
          if (isLoopingRef.current && isMountedRef.current) {
            setTimeout(() => {
              if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                soundRef.current.setPositionAsync(startMs);
                soundRef.current.playAsync();
                setIsPlaying(true);
              }
            }, 500);
          }
        }
      }, 50);

    } catch (error) {
      console.error('[播放] 失败:', error);
    }
  }, [currentSentence, file, isPlaying]);

  // 更新音量
  const updateVolume = useCallback(async (newVolume: number) => {
    volumeRef.current = newVolume;
    setVolume(newVolume);
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(newVolume);
    }
  }, []);

  // 更新语速
  const updatePlaybackRate = useCallback(async (newRate: number) => {
    playbackRateRef.current = newRate;
    setPlaybackRate(newRate);
    if (soundRef.current) {
      await soundRef.current.setRateAsync(newRate, true);
    }
  }, []);

  // 暂停播放
  const pauseAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } catch (e) {
        console.error('暂停失败:', e);
      }
    }
  }, []);

  // 停止播放
  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // 切换播放/暂停
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, playAudio, pauseAudio]);

  // 初始化当前句子
  useEffect(() => {
    if (!currentSentence) return;

    stopPlayback();

    const tokens = extractWords(currentSentence.text);
    setWordStatuses(tokens.map((token, index) => ({
      word: token.word,
      displayText: token.displayText,
      revealed: token.isPunctuation,
      revealedChars: token.isPunctuation ? [] : new Array(token.word.length).fill(false),
      errorCharIndex: -1,
      index,
      isPunctuation: token.isPunctuation,
    })));
    setCurrentInput('');
    setTargetWordIndex(null); // 重置目标单词
    isLoopingRef.current = true;
    setIsLooping(true);

    const timer = setTimeout(() => {
      playAudio();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopPlayback();
    };
  }, [currentSentence?.id]);

  // 显示错误闪烁效果
  const showErrorFlash = useCallback(() => {
    Animated.sequence([
      Animated.timing(errorAnimRef.current, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorAnimRef.current, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 处理输入变化 - 使用 ref 存储最新的 wordStatuses，避免闭包问题
  const wordStatusesRef = useRef(wordStatuses);
  const targetWordIndexRef = useRef(targetWordIndex);
  
  // 初始化 ref（仅在首次渲染时）
  useEffect(() => {
    wordStatusesRef.current = wordStatuses;
  }, [wordStatuses]);
  
  useEffect(() => {
    targetWordIndexRef.current = targetWordIndex;
  }, [targetWordIndex]);

  // 辅助函数：同步更新状态和 ref
  const updateWordStatusesWithRef = useCallback((updater: (prev: WordStatus[]) => WordStatus[]) => {
    setWordStatuses(prev => {
      const next = updater(prev);
      wordStatusesRef.current = next; // 立即同步 ref
      return next;
    });
  }, []);

  const setTargetWordIndexWithRef = useCallback((value: number | null) => {
    setTargetWordIndex(value);
    targetWordIndexRef.current = value; // 立即同步 ref
  }, []);

  const handleInputChange = useCallback((text: string) => {
    const inputLower = text.toLowerCase();
    const currentWordStatuses = wordStatusesRef.current;

    // 空输入时重置
    if (inputLower.length === 0) {
      setCurrentInput('');
      setTargetWordIndexWithRef(null);
      return;
    }

    // 获取未完成的单词
    const incompleteWords = currentWordStatuses.filter(w => !w.isPunctuation && !w.revealed);
    if (incompleteWords.length === 0) {
      setCurrentInput(text);
      return;
    }

    // 检查是否完全匹配某个单词
    const matchedWord = incompleteWords.find(w => w.word.toLowerCase() === inputLower);

    // 检查是否有其他单词以当前输入开头（说明用户可能还在输入）
    const hasLongerMatch = incompleteWords.some(w => {
      const wordLower = w.word.toLowerCase();
      // 排除完全匹配的单词，找以当前输入开头但更长的单词
      return wordLower !== inputLower && wordLower.startsWith(inputLower);
    });

    if (matchedWord && !hasLongerMatch) {
      // 完全匹配且没有更长的单词以当前输入开头，确认匹配
      updateWordStatusesWithRef(prev => prev.map(ws => {
        if (ws.index === matchedWord.index) {
          return {
            ...ws,
            revealed: true,
            revealedChars: new Array(ws.word.length).fill(true),
            errorCharIndex: -1,
          };
        }
        return ws;
      }));
      // 清空输入框
      setCurrentInput('');
      setTargetWordIndexWithRef(null);
      return;
    }

    // 输入过程中只保留用户输入，不显示任何提示
    setCurrentInput(text);
  }, [updateWordStatusesWithRef, setTargetWordIndexWithRef]);

  // 检查是否完成
  useEffect(() => {
    if (wordStatuses.length === 0) return;

    const allRevealed = wordStatuses.every(w => w.isPunctuation || w.revealed);

    if (allRevealed && wordStatuses.some(w => !w.isPunctuation)) {
      handleSentenceComplete();
    }
  }, [wordStatuses]);

  // 句子完成处理
  const handleSentenceComplete = useCallback(async () => {
    isLoopingRef.current = false;
    setIsLooping(false);
    pauseAudio();

    // 获取翻译并显示
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentSentence?.text, type: 'sentence' }),
      });
      const data = await response.json();
      setCurrentTranslation(data.translation || '');
      setShowTranslation(true);

      setTimeout(() => {
        setShowTranslation(false);
        setCurrentTranslation('');
        goToNextSentence();
      }, 1000);
    } catch (e) {
      console.error('获取翻译失败:', e);
      setTimeout(() => {
        goToNextSentence();
      }, 600);
    }
  }, [currentSentence, pauseAudio]);

  // 跳转到上一句
  const goToPrevSentence = useCallback(() => {
    if (currentIndex > 0) {
      stopPlayback();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, stopPlayback]);

  // 跳转到下一句
  const goToNextSentence = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      stopPlayback();
      setCurrentIndex(prev => prev + 1);
    } else {
      stopPlayback();
      Alert.alert('恭喜！', '你已经完成了所有句子的学习！', [
        { text: '返回', onPress: () => router.back() }
      ]);
    }
  }, [currentIndex, sentences.length, stopPlayback, router]);

  // 开始语音输入
  const startRecording = useCallback(async () => {
    if (!hasRecordingPermission) {
      Alert.alert('权限不足', '需要麦克风权限才能使用语音输入');
      return;
    }

    if (isPlaying) {
      await pauseAudio();
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('开始录音失败:', error);
      Alert.alert('录音失败', '无法启动录音');
    }
  }, [hasRecordingPermission, isPlaying, pauseAudio]);

  // 停止语音输入并识别
  const stopRecordingAndRecognize = useCallback(async () => {
    if (!recordingRef.current) return;

    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        const fileData = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
        const formData = new FormData();
        formData.append('audio', fileData as any);

        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech/recognize`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.text) {
          // 追加识别结果
          const newText = currentInput ? `${currentInput} ${data.text.toLowerCase()}` : data.text.toLowerCase();
          handleInputChange(newText);
        }
      }
    } catch (error) {
      console.error('语音识别失败:', error);
    }
  }, [currentInput, handleInputChange]);

  // 清理
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

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  if (!file || sentences.length === 0) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <FontAwesome6 name="file-circle-xmark" size={48} color={theme.error} />
          <ThemedText variant="body" color={theme.textPrimary} style={{ marginTop: Spacing.lg }}>
            暂无可学习的句子
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.sm }}>
            请先在句库制作中编辑时间轴
          </ThemedText>
          <TouchableOpacity
            style={{ marginTop: Spacing.xl, padding: Spacing.lg, backgroundColor: theme.primary, borderRadius: BorderRadius.lg }}
            onPress={() => router.back()}
          >
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>返回</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      {/* Header */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.header}
        onPress={() => showAudioSettings && setShowAudioSettings(false)}
      >
        <TouchableOpacity onPress={() => { stopPlayback(); router.back(); }} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={18} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <ThemedText variant="caption" color={theme.textMuted} numberOfLines={1}>{file.title}</ThemedText>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>
            {currentIndex + 1} / {sentences.length}
          </ThemedText>
        </View>
        {/* 右侧小控制按钮 */}
        <View style={styles.headerControls}>
          <TouchableOpacity
            style={[styles.smallControlBtn, showAudioSettings && styles.smallControlBtnActive]}
            onPress={() => setShowAudioSettings(prev => !prev)}
          >
            <FontAwesome6 name="sliders" size={14} color={showAudioSettings ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallControlBtn, isPlaying && styles.smallControlBtnActive]}
            onPress={togglePlayPause}
          >
            <FontAwesome6 name={isPlaying ? "pause" : "play"} size={14} color={isPlaying ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Audio Settings Panel */}
      {showAudioSettings && (
        <View style={styles.audioSettingsPanel}>
          {/* Volume Control */}
          <View style={styles.settingRow}>
            <FontAwesome6 name="volume-low" size={14} color={theme.textMuted} style={styles.settingIcon} />
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${volume * 100}%` }]} />
                <View style={[styles.sliderThumb, { left: `${volume * 100}%` }]} />
              </View>
              <View style={styles.sliderTouchArea}>
                {[...Array(11)].map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.sliderTouchPoint}
                    onPress={() => {
                      updateVolume(i / 10);
                    }}
                  />
                ))}
              </View>
            </View>
            <FontAwesome6 name="volume-high" size={14} color={theme.textMuted} />
          </View>

          {/* Speed Control */}
          <View style={styles.settingRow}>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.settingLabel}>0.5x</ThemedText>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${((playbackRate - 0.5) / 1.5) * 100}%` }]} />
                <View style={[styles.sliderThumb, { left: `${((playbackRate - 0.5) / 1.5) * 100}%` }]} />
              </View>
              <View style={styles.sliderTouchArea}>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    style={styles.sliderTouchPoint}
                    onPress={() => {
                      updatePlaybackRate(rate);
                    }}
                  />
                ))}
              </View>
            </View>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.settingLabel}>2.0x</ThemedText>
            <View style={styles.currentSpeedBadge}>
              <ThemedText variant="caption" color={theme.buttonPrimaryText}>{playbackRate}x</ThemedText>
            </View>
          </View>
        </View>
      )}

      {/* Progress Bar */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.progressContainer}
        onPress={() => showAudioSettings && setShowAudioSettings(false)}
      >
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onTouchStart={() => showAudioSettings && setShowAudioSettings(false)}
      >
        {/* Sentence Display */}
        <Animated.View style={[styles.sentenceCard, { opacity: Animated.subtract(1, errorAnimRef.current) }]}>
          <View style={styles.wordContainer}>
            {wordStatuses.map((ws, idx) => (
              <View key={idx} style={styles.wordWrapper}>
                {ws.isPunctuation ? (
                  <ThemedText variant="h4" color={theme.textPrimary}>
                    {ws.displayText}
                  </ThemedText>
                ) : (
                  <View style={styles.wordBox}>
                    {ws.displayText.split('').map((char, charIdx) => (
                      <ThemedText
                        key={charIdx}
                        variant="h4"
                        color={
                          ws.revealed
                            ? theme.success
                            : ws.revealedChars[charIdx]
                            ? theme.textPrimary
                            : ws.errorCharIndex === charIdx
                            ? theme.error
                            : theme.textMuted
                        }
                        style={[
                          styles.char,
                          !ws.revealed && !ws.revealedChars[charIdx] && styles.hiddenChar,
                          ws.errorCharIndex === charIdx && styles.errorChar,
                        ]}
                      >
                        {ws.revealed || ws.revealedChars[charIdx] ? char : '_'}
                      </ThemedText>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={currentInput}
              onChangeText={handleInputChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {/* 输入反馈覆盖层 */}
            {currentInput.length > 0 && (
              <View style={styles.inputOverlay} pointerEvents="none">
                {(() => {
                  // 使用 targetWordIndex 确定目标单词
                  let targetWord = '';
                  
                  if (targetWordIndex !== null) {
                    // 使用已锁定的目标单词
                    const targetWs = wordStatuses.find(w => w.index === targetWordIndex);
                    if (targetWs) {
                      targetWord = targetWs.word.toLowerCase();
                    }
                  }
                  
                  // 如果没有锁定，使用第一个未完成单词
                  if (!targetWord) {
                    const incompleteWords = wordStatuses.filter(w => !w.isPunctuation && !w.revealed);
                    targetWord = incompleteWords[0]?.word.toLowerCase() || '';
                  }
                  
                  return currentInput.split('').map((char, idx) => {
                    const isCorrect = idx < targetWord.length && char.toLowerCase() === targetWord[idx];
                    
                    return (
                      <ThemedText
                        key={idx}
                        style={[
                          styles.inputChar,
                          isCorrect ? styles.inputCharCorrect : styles.inputCharWrong,
                        ]}
                      >
                        {char}
                      </ThemedText>
                    );
                  });
                })()}
              </View>
            )}
            <TouchableOpacity
              style={styles.inputVoiceBtn}
              onPressIn={startRecording}
              onPressOut={stopRecordingAndRecognize}
            >
              <FontAwesome6
                name={isRecording ? "stop" : "microphone"}
                size={18}
                color={isRecording ? theme.error : theme.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Translation Display */}
        {showTranslation && currentTranslation && (
          <View style={styles.translationCard}>
            <ThemedText variant="body" color={theme.textSecondary} style={{ textAlign: 'center' }}>
              {currentTranslation}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Navigation Buttons (Fixed at bottom) */}
      <View style={styles.navButtons}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={goToPrevSentence}
          disabled={currentIndex === 0}
        >
          <FontAwesome6 name="chevron-left" size={18} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
          onPress={goToNextSentence}
          disabled={currentIndex === sentences.length - 1}
        >
          <FontAwesome6 name="chevron-right" size={18} color={currentIndex === sentences.length - 1 ? theme.textMuted : theme.primary} />
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
