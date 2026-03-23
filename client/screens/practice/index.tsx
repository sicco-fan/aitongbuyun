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
  const [completed, setCompleted] = useState(false);
  
  // 单词状态
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
  // 音频播放
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isLoopingRef = useRef(true);
  
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
        
        // 找到第一个未完成的句子
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
      fetchMaterial();
    }, [fetchMaterial])
  );

  // 提取单词和标点
  const extractWords = (text: string): { word: string; displayText: string; isPunctuation: boolean }[] => {
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
  };

  // 初始化当前句子的单词状态
  useEffect(() => {
    if (currentSentence) {
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
      setPlayCount(0);
      
      // 自动开始播放
      isLoopingRef.current = true;
      playSentenceAudio();
    }
    
    return () => {
      stopPlayback();
    };
  }, [currentSentence?.id]);

  // 播放当前句子的音频
  const playSentenceAudio = useCallback(async () => {
    if (!currentSentence?.audio_url) {
      console.log('[播放] 句子没有音频');
      return;
    }
    
    try {
      // 停止之前的播放
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });
      
      // 生成签名URL
      const audioUrl = await generateAudioUrl(currentSentence.audio_url);
      console.log('[播放] 音频URL:', audioUrl?.substring(0, 80));
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              console.log('[播放] 句子播放完成');
              setIsPlaying(false);
              
              // 如果还在循环状态，重新播放
              if (isLoopingRef.current && soundRef.current) {
                setPlayCount(prev => prev + 1);
                soundRef.current.replayAsync();
              }
            }
          } else if (status.error) {
            console.error('[播放错误]', status.error);
          }
        }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
      console.log('[播放] 开始播放句子:', currentSentence.text?.substring(0, 30));
      
    } catch (error) {
      console.error('[播放] 失败:', error);
    }
  }, [currentSentence]);

  // 生成音频URL
  const generateAudioUrl = async (audioKey: string): Promise<string> => {
    // 如果已经是完整URL，直接返回
    if (audioKey.startsWith('http')) {
      return audioKey;
    }
    
    // 否则调用后端获取签名URL
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/audio-url?key=${encodeURIComponent(audioKey)}`);
      const data = await response.json();
      return data.url || audioKey;
    } catch (e) {
      console.error('获取音频URL失败:', e);
      return audioKey;
    }
  };

  // 停止播放
  const stopPlayback = useCallback(async () => {
    isLoopingRef.current = false;
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        // 忽略错误
      }
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((text: string) => {
    setCurrentInput(text);
    
    if (!text) {
      // 重置所有错误状态
      setWordStatuses(prev => prev.map(w => ({ ...w, errorCharIndex: -1 })));
      return;
    }
    
    const inputLower = text.toLowerCase();
    let inputIndex = 0;
    
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      
      for (let i = 0; i < newStatuses.length; i++) {
        const ws = newStatuses[i];
        if (ws.isPunctuation) continue;
        
        const wordLower = ws.word.toLowerCase();
        
        // 已经完全匹配的单词
        if (ws.revealed) continue;
        
        // 检查当前单词是否匹配
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
          // 单词匹配成功
          const nextInputIndex = inputIndex + wordLower.length;
          const nextChar = inputLower[nextInputIndex];
          
          // 检查下一个字符是否是标点或空格
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
          // 显示已匹配的部分
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
    
    // 检查是否全部完成
    checkCompletion();
  }, []);

  // 检查是否完成当前句子
  const checkCompletion = useCallback(() => {
    const allRevealed = wordStatuses.every(w => w.isPunctuation || w.revealed);
    
    if (allRevealed && wordStatuses.some(w => !w.isPunctuation)) {
      handleSentenceComplete();
    }
  }, [wordStatuses]);

  // 句子完成处理
  const handleSentenceComplete = useCallback(async () => {
    console.log('[完成] 句子完成:', currentSentence?.text?.substring(0, 30));
    
    // 停止循环播放
    isLoopingRef.current = false;
    
    // 标记句子完成
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${currentSentence?.id}/complete`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('标记完成失败:', e);
    }
    
    // 播放成功音效
    // 等待一下再切换
    setTimeout(() => {
      goToNextSentence();
    }, 1000);
  }, [currentSentence, materialId]);

  // 跳转到下一句
  const goToNextSentence = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      stopPlayback();
      setCurrentIndex(prev => prev + 1);
    } else {
      // 全部完成
      setCompleted(true);
      stopPlayback();
      Alert.alert('恭喜！', '你已经完成了所有句子的学习！');
    }
  }, [currentIndex, sentences.length, stopPlayback]);

  // 开始语音输入
  const startRecording = useCallback(async () => {
    if (!hasRecordingPermission) {
      Alert.alert('权限不足', '需要麦克风权限才能使用语音输入');
      return;
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
    }
  }, [hasRecordingPermission]);

  // 停止语音输入并识别
  const stopRecordingAndRecognize = useCallback(async () => {
    if (!recordingRef.current) return;
    
    setIsRecording(false);
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (uri) {
        // 发送到后端进行ASR识别
        const fileData = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
        const formData = new FormData();
        // React Native FormData 支持直接传入 { uri, type, name } 对象
        formData.append('audio', fileData as any);
        
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech/recognize`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        
        if (data.text) {
          // 直接用识别结果更新输入
          handleInputChange(data.text.toLowerCase());
        }
      }
    } catch (error) {
      console.error('语音识别失败:', error);
    }
  }, [handleInputChange]);

  // 手动跳过当前句子
  const skipSentence = useCallback(() => {
    Alert.alert(
      '跳过句子',
      '确定要跳过这个句子吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: goToNextSentence },
      ]
    );
  }, [goToNextSentence]);

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
          <FontAwesome6 name="file-circle-xmark" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textPrimary} style={{ marginTop: Spacing.lg }}>
            素材未准备好
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: Spacing.sm, textAlign: 'center' }}>
            请先在后台管理中完成时间轴编辑并切分音频
          </ThemedText>
          <TouchableOpacity 
            style={{ marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: theme.primary, borderRadius: BorderRadius.md }}
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <ThemedText variant="caption" color={theme.textMuted}>{material.title}</ThemedText>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>
            句子 {currentIndex + 1} / {sentences.length}
          </ThemedText>
        </View>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Sentence Display */}
        <View style={styles.sentenceSection}>
          <View style={styles.wordContainer}>
            {wordStatuses.map((ws, idx) => (
              <View key={idx} style={styles.wordWrapper}>
                {ws.isPunctuation ? (
                  <ThemedText variant="h3" color={theme.textPrimary}>
                    {ws.displayText}
                  </ThemedText>
                ) : (
                  <View style={styles.wordBox}>
                    {ws.displayText.split('').map((char, charIdx) => (
                      <ThemedText
                        key={charIdx}
                        variant="h3"
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
          />
          
          {/* Voice Input Button */}
          <TouchableOpacity
            style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
            onPressIn={startRecording}
            onPressOut={stopRecordingAndRecognize}
          >
            <FontAwesome6 
              name={isRecording ? "microphone" : "microphone"} 
              size={24} 
              color={isRecording ? theme.error : theme.primary} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Controls */}
        <View style={styles.controlsSection}>
          {/* Play Count */}
          <ThemedText variant="caption" color={theme.textMuted}>
            已播放 {playCount} 次
          </ThemedText>
          
          {/* Skip Button */}
          <TouchableOpacity style={styles.skipBtn} onPress={skipSentence}>
            <FontAwesome6 name="forward" size={16} color={theme.textMuted} />
            <ThemedText variant="caption" color={theme.textMuted}>跳过</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
