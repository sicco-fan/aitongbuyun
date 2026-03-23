import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
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
  audio_url: string | null;
  start_time: number;
  end_time: number;
  is_completed: boolean;
  translation?: string;
}

interface Material {
  id: number;
  title: string;
  audio_url: string;
  sentences: Sentence[];
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

export default function PracticeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ materialId: number; title: string }>();
  
  const materialId = params.materialId;
  
  const [material, setMaterial] = useState<Material | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // 单词状态
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [completedWordCount, setCompletedWordCount] = useState(0); // 已完成的单词数
  
  // 翻译显示
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState('');
  
  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [volume, setVolume] = useState(1.0); // 音量 0-1
  const [playbackRate, setPlaybackRate] = useState(1.0); // 语速 0.5-2.0
  const [showAudioSettings, setShowAudioSettings] = useState(false); // 显示音频设置面板
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef(true);
  const isLoopingRef = useRef(true); // 用于在回调中获取最新的循环状态
  const volumeRef = useRef(1.0); // 用于在回调中获取最新的音量
  const playbackRateRef = useRef(1.0); // 用于在回调中获取最新的语速
  
  // 错误闪烁动画
  const errorAnimRef = useRef<Animated.Value>(new Animated.Value(0));
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 语音输入
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  
  // 获取当前句子
  const currentSentence = sentences[currentIndex];
  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;
  
  // 初始化录音权限
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasRecordingPermission(status === 'granted');
    })();
  }, []);

  // 加载材料数据
  const fetchMaterial = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const data = await response.json();
      
      if (data.material && data.sentences) {
        setMaterial(data.material);
        setSentences(data.sentences);
        
        const firstIncomplete = data.sentences.findIndex((s: Sentence) => !s.is_completed);
        setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
      }
    } catch (error) {
      console.error('加载材料失败:', error);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      fetchMaterial();
      
      return () => {
        isMountedRef.current = false;
        stopPlayback();
      };
    }, [fetchMaterial])
  );

  // 提取单词和标点
  const extractWords = useCallback((text: string) => {
    const result: { word: string; displayText: string; isPunctuation: boolean }[] = [];
    const tokens = text.match(/\w+|[^\w\s]+/g) || [];
    
    tokens.forEach((token) => {
      const isPunctuation = !/\w/.test(token);
      result.push({
        word: isPunctuation ? '' : token.toLowerCase().replace(/\W/g, ''),
        displayText: token,
        isPunctuation,
      });
    });
    
    return result;
  }, []);

  // 生成音频URL
  const generateAudioUrl = useCallback(async (audioKey: string): Promise<string> => {
    if (audioKey.startsWith('http')) {
      return audioKey;
    }
    
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/audio-url?key=${encodeURIComponent(audioKey)}`);
      const data = await response.json();
      return data.url || audioKey;
    } catch (e) {
      console.error('获取音频URL失败:', e);
      return audioKey;
    }
  }, [materialId]);

  // 播放音频
  const playAudio = useCallback(async () => {
    if (!currentSentence?.audio_url) {
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
      
      const audioUrl = await generateAudioUrl(currentSentence.audio_url);
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true, 
          isLooping: false,
          volume: volume,
          rate: playbackRate,
          shouldCorrectPitch: true, // 语速改变时保持音调
        },
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setIsPlaying(false);
              
              // 使用 ref 获取最新的循环状态
              if (isLoopingRef.current && isMountedRef.current) {
                setTimeout(() => {
                  if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                    soundRef.current.replayAsync();
                    setIsPlaying(true);
                  }
                }, 500);
              }
            }
          } else if (status.error) {
            console.error('[播放错误]', status.error);
            setIsPlaying(false);
          }
        }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
      
    } catch (error) {
      console.error('[播放] 失败:', error);
    }
  }, [currentSentence, generateAudioUrl, isPlaying, isLooping, volume, playbackRate]);

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

  // 切换循环模式
  const toggleLoop = useCallback(() => {
    setIsLooping(prev => {
      isLoopingRef.current = !prev;
      return !prev;
    });
  }, []);

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
    isLoopingRef.current = true;
    setIsLooping(true);
    
    const timer = setTimeout(() => {
      if (currentSentence.audio_url) {
        playAudio();
      }
    }, 500);
    
    return () => {
      clearTimeout(timer);
      stopPlayback();
    };
  }, [currentSentence?.id]);

  // 自动计算完成的单词数
  useEffect(() => {
    const completed = wordStatuses.filter(w => !w.isPunctuation && w.revealed).length;
    setCompletedWordCount(completed);
  }, [wordStatuses]);

  // 显示错误闪烁效果
  const showErrorFlash = useCallback(() => {
    // 清除之前的定时器
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    
    // 动画：快速闪红
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
    
    // 不再自动清除错误状态，让用户看到错误位置直到改正
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((text: string) => {
    const inputLower = text.toLowerCase().trim();
    
    // 获取当前单词列表（非标点）
    const wordList = wordStatuses.filter(w => !w.isPunctuation);
    
    // 计算已完成的单词数
    const completedCount = wordList.filter(w => w.revealed).length;
    
    // 如果已经全部完成，不处理
    if (completedCount >= wordList.length) return;
    
    // 获取当前应该输入的单词
    const currentWordIndex = completedCount;
    const currentWord = wordList[currentWordIndex];
    
    if (!currentWord) return;
    
    const targetWord = currentWord.word.toLowerCase();
    
    // 检查输入是否匹配当前单词
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      let wordFound = false;
      let wordIdx = 0;
      
      for (let i = 0; i < newStatuses.length; i++) {
        const ws = newStatuses[i];
        if (ws.isPunctuation) continue;
        
        if (wordIdx === currentWordIndex && !wordFound) {
          wordFound = true;
          
          // 检查输入是否完全匹配这个单词
          if (inputLower === targetWord) {
            // 完全匹配！标记为完成
            newStatuses[i] = {
              ...ws,
              revealed: true,
              revealedChars: new Array(ws.word.length).fill(true),
              errorCharIndex: -1,
            };
            // 清空输入框
            setCurrentInput('');
          } else if (inputLower.length > 0) {
            // 部分输入，检查匹配情况
            const matchedChars: boolean[] = [];
            let hasError = false;
            let errorIndex = -1;
            
            for (let j = 0; j < targetWord.length; j++) {
              if (j < inputLower.length) {
                if (inputLower[j] === targetWord[j]) {
                  matchedChars.push(true);
                } else {
                  matchedChars.push(false);
                  hasError = true;
                  if (errorIndex === -1) errorIndex = j;
                }
              } else {
                matchedChars.push(false);
              }
            }
            
            // 检查是否输入了多余的字符
            if (inputLower.length > targetWord.length) {
              hasError = true;
              errorIndex = targetWord.length;
            }
            
            newStatuses[i] = {
              ...ws,
              revealedChars: matchedChars,
              errorCharIndex: errorIndex,
            };
            
            // 显示错误闪烁
            if (hasError) {
              showErrorFlash();
              // 输入框中删除错误字母，只保留正确的部分
              const correctPart = inputLower.slice(0, errorIndex);
              setCurrentInput(correctPart);
            } else {
              // 没有错误，保留输入框内容
              setCurrentInput(text.trim());
            }
          } else {
            // 输入为空，重置状态
            newStatuses[i] = {
              ...ws,
              revealedChars: new Array(ws.word.length).fill(false),
              errorCharIndex: -1,
            };
            setCurrentInput('');
          }
        }
        
        wordIdx++;
      }
      
      return newStatuses;
    });
  }, [wordStatuses, showErrorFlash]);

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
    
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${currentSentence?.id}/complete`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('标记完成失败:', e);
    }
    
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
      
      // 显示翻译1秒后跳转
      setTimeout(() => {
        setShowTranslation(false);
        setCurrentTranslation('');
        goToNextSentence();
      }, 1000);
    } catch (e) {
      console.error('获取翻译失败:', e);
      // 翻译失败也跳转
      setTimeout(() => {
        goToNextSentence();
      }, 600);
    }
  }, [currentSentence, materialId, pauseAudio]);

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

  // 跳过句子
  const skipSentence = useCallback(() => {
    stopPlayback();
    goToNextSentence();
  }, [stopPlayback, goToNextSentence]);

  // 清理
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
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

  if (!material || sentences.length === 0) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <FontAwesome6 name="file-circle-xmark" size={48} color={theme.error} />
          <ThemedText variant="body" color={theme.textPrimary} style={{ marginTop: Spacing.lg }}>
            素材未准备好
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
          <ThemedText variant="caption" color={theme.textMuted} numberOfLines={1}>{material.title}</ThemedText>
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
          <TextInput
            style={styles.input}
            value={currentInput}
            onChangeText={handleInputChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          
          {/* Voice Input Button */}
          <TouchableOpacity
            style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
            onPressIn={startRecording}
            onPressOut={stopRecordingAndRecognize}
          >
            <FontAwesome6 
              name={isRecording ? "stop" : "microphone"} 
              size={24} 
              color={isRecording ? theme.buttonPrimaryText : theme.primary} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Translation Display */}
        {showTranslation && currentTranslation && (
          <View style={styles.translationCard}>
            <ThemedText variant="body" color={theme.textSecondary} style={{ textAlign: 'center' }}>
              {currentTranslation}
            </ThemedText>
          </View>
        )}
        
        {/* Navigation Buttons */}
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
      </ScrollView>
    </Screen>
  );
}
