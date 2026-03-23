import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
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
  
  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true); // 是否循环播放
  const [playCount, setPlayCount] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef(true);
  
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
      console.log('[播放] 句子没有音频');
      Alert.alert('提示', '该句子暂无音频');
      return;
    }
    
    try {
      // 如果已经在播放，继续播放
      if (soundRef.current && isPlaying) {
        return;
      }
      
      // 如果有暂停的音频，继续播放
      if (soundRef.current && !isPlaying) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }
      
      // 创建新的音频播放
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
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlayCount(prev => prev + 1);
              
              // 如果开启循环，重新播放
              if (isLooping && isMountedRef.current) {
                setTimeout(() => {
                  if (isLooping && isMountedRef.current && soundRef.current) {
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
      Alert.alert('播放失败', '无法播放音频，请重试');
    }
  }, [currentSentence, generateAudioUrl, isPlaying, isLooping]);

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
      } catch (e) {
        // 忽略
      }
      soundRef.current = null;
    }
    setIsPlaying(false);
    setPlayCount(0);
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
    setIsLooping(prev => !prev);
  }, []);

  // 初始化当前句子
  useEffect(() => {
    if (!currentSentence) return;
    
    // 停止之前的播放
    stopPlayback();
    
    // 初始化单词状态
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
    setIsLooping(true);
    setPlayCount(0);
    
    // 延迟自动播放，让用户先看到句子
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

  // 处理输入变化
  const handleInputChange = useCallback((text: string) => {
    setCurrentInput(text);
    
    if (!text) {
      setWordStatuses(prev => prev.map(w => ({ ...w, errorCharIndex: -1 })));
      return;
    }
    
    const inputLower = text.toLowerCase().trim();
    let inputIndex = 0;
    
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      
      for (let i = 0; i < newStatuses.length; i++) {
        const ws = newStatuses[i];
        if (ws.isPunctuation) continue;
        
        const wordLower = ws.word.toLowerCase();
        if (ws.revealed) continue;
        
        let allMatched = true;
        let firstErrorIndex = -1;
        
        for (let j = 0; j < wordLower.length; j++) {
          const inputCharIndex = inputIndex + j;
          if (inputCharIndex >= inputLower.length) {
            allMatched = false;
            break;
          }
          
          if (inputLower[inputCharIndex] !== wordLower[j]) {
            allMatched = false;
            firstErrorIndex = j;
            break;
          }
        }
        
        if (allMatched && inputIndex + wordLower.length <= inputLower.length) {
          const nextInputIndex = inputIndex + wordLower.length;
          const nextChar = inputLower[nextInputIndex];
          
          const nextWord = newStatuses[i + 1];
          if (!nextWord || nextWord.isPunctuation || nextChar === ' ' || nextChar === undefined) {
            newStatuses[i] = {
              ...ws,
              revealed: true,
              revealedChars: new Array(ws.word.length).fill(true),
              errorCharIndex: -1,
            };
            inputIndex = nextInputIndex + (nextChar === ' ' ? 1 : 0);
          } else {
            break;
          }
        } else {
          const matchedChars = [];
          for (let j = 0; j < wordLower.length; j++) {
            const inputCharIndex = inputIndex + j;
            if (inputCharIndex < inputLower.length && inputLower[inputCharIndex] === wordLower[j]) {
              matchedChars.push(true);
            } else {
              matchedChars.push(false);
              if (firstErrorIndex === -1 && j < inputLower.length - inputIndex) {
                firstErrorIndex = j;
              }
            }
          }
          
          newStatuses[i] = {
            ...ws,
            revealedChars: matchedChars,
            errorCharIndex: firstErrorIndex,
          };
          break;
        }
      }
      
      return newStatuses;
    });
  }, []);

  // 检查是否完成
  useEffect(() => {
    if (wordStatuses.length === 0) return;
    
    const allRevealed = wordStatuses.every(w => w.isPunctuation || w.revealed);
    
    if (allRevealed && wordStatuses.some(w => !w.isPunctuation)) {
      // 完成当前句子
      handleSentenceComplete();
    }
  }, [wordStatuses]);

  // 句子完成处理
  const handleSentenceComplete = useCallback(async () => {
    // 停止循环
    setIsLooping(false);
    pauseAudio();
    
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${currentSentence?.id}/complete`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('标记完成失败:', e);
    }
    
    // 显示成功提示并跳转
    setTimeout(() => {
      goToNextSentence();
    }, 800);
  }, [currentSentence, materialId, pauseAudio]);

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
    
    // 暂停播放，避免干扰录音
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
      Alert.alert('录音失败', '无法启动录音，请重试');
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
          // 将识别结果追加到输入框
          const newText = currentInput ? `${currentInput} ${data.text.toLowerCase()}` : data.text.toLowerCase();
          handleInputChange(newText);
        }
      }
    } catch (error) {
      console.error('语音识别失败:', error);
      Alert.alert('识别失败', '语音识别失败，请重试');
    }
  }, [currentInput, handleInputChange]);

  // 跳过句子
  const skipSentence = useCallback(() => {
    Alert.alert(
      '跳过句子',
      '确定要跳过这个句子吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: () => { stopPlayback(); goToNextSentence(); } },
      ]
    );
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
    };
  }, []);

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: Spacing.md }}>
            加载中...
          </ThemedText>
        </ThemedView>
      </Screen>
    );
  }

  if (!material || sentences.length === 0) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: BorderRadius.full,
            backgroundColor: theme.error + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Spacing.lg,
          }}>
            <FontAwesome6 name="file-circle-xmark" size={36} color={theme.error} />
          </View>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ marginBottom: Spacing.sm }}>
            素材未准备好
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={{ textAlign: 'center', marginBottom: Spacing.xl }}>
            请先在后台管理中完成时间轴编辑并切分音频
          </ThemedText>
          <TouchableOpacity 
            style={{ 
              paddingHorizontal: Spacing.xl, 
              paddingVertical: Spacing.md, 
              backgroundColor: theme.primary, 
              borderRadius: BorderRadius.lg 
            }}
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { stopPlayback(); router.back(); }} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={18} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <ThemedText variant="caption" color={theme.textMuted} numberOfLines={1}>{material.title}</ThemedText>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>
            句子 {currentIndex + 1} / {sentences.length}
          </ThemedText>
        </View>
      </View>
      
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Sentence Display */}
        <View style={styles.sentenceCard}>
          <View style={styles.sentenceHeader}>
            <View style={styles.sentenceIconContainer}>
              <FontAwesome6 name="quote-left" size={14} color={theme.primary} />
            </View>
            <ThemedText variant="caption" color={theme.textMuted}>
              听写句子
            </ThemedText>
          </View>
          
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
        </View>
        
        {/* Audio Controls */}
        <View style={styles.audioControls}>
          {/* Play/Pause Button */}
          <TouchableOpacity 
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={togglePlayPause}
          >
            <FontAwesome6 
              name={isPlaying ? "pause" : "play"} 
              size={24} 
              color={isPlaying ? theme.buttonPrimaryText : theme.primary} 
            />
          </TouchableOpacity>
          
          {/* Loop Toggle */}
          <TouchableOpacity 
            style={[styles.loopBtn, isLooping && styles.loopBtnActive]}
            onPress={toggleLoop}
          >
            <FontAwesome6 
              name="repeat" 
              size={18} 
              color={isLooping ? theme.primary : theme.textMuted} 
            />
            <ThemedText variant="tiny" color={isLooping ? theme.primary : theme.textMuted}>
              循环
            </ThemedText>
          </TouchableOpacity>
          
          {/* Play Count */}
          <View style={styles.playCount}>
            <FontAwesome6 name="rotate" size={12} color={theme.textMuted} />
            <ThemedText variant="caption" color={theme.textMuted}>
              {playCount}次
            </ThemedText>
          </View>
        </View>
        
        {/* Input Section */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            value={currentInput}
            onChangeText={handleInputChange}
            placeholder="输入听到的内容..."
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
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
        
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipBtn} onPress={skipSentence}>
          <FontAwesome6 name="forward-step" size={16} color={theme.textMuted} />
          <ThemedText variant="small" color={theme.textMuted}>跳过此句</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
