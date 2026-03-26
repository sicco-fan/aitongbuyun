import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
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
import {
  markSentenceCompleted,
  getCompletedSentences,
  recordErrorWord,
  recordSentenceError,
  recordSentenceAttempt,
  getSuggestedPlaybackRate,
  getCachedAudio,
  cacheAudio,
} from '@/utils/learningStorage';

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
  const [targetWordIndex, setTargetWordIndex] = useState<number | null>(null); // 当前正在匹配的单词索引

  // 单词提示和翻译
  const [hintWordIndex, setHintWordIndex] = useState<number | null>(null); // 显示提示的单词
  const [translationWordIndex, setTranslationWordIndex] = useState<number | null>(null); // 显示翻译的单词
  const [wordTranslations, setWordTranslations] = useState<Record<string, string>>({}); // 单词翻译缓存
  
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
        // 读取本地进度
        const localCompleted = await getCompletedSentences(materialId);
        
        // 合并服务端和本地的完成状态
        const mergedSentences = data.sentences.map((s: Sentence) => ({
          ...s,
          is_completed: s.is_completed || localCompleted.includes(s.id),
        }));
        
        setMaterial(data.material);
        setSentences(mergedSentences);
        
        // 找到第一个未完成的句子
        const firstIncomplete = mergedSentences.findIndex((s: Sentence) => !s.is_completed);
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

  // 播放音频（支持离线模式）
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
      
      // 优先使用本地缓存
      let audioUrl = await getCachedAudio(currentSentence.id);
      
      if (!audioUrl) {
        // 没有缓存，从服务器获取并缓存
        audioUrl = await generateAudioUrl(currentSentence.audio_url);
        // 后台缓存音频，不阻塞播放
        cacheAudio(currentSentence.id, audioUrl).catch((_e) => { /* 忽略缓存错误 */ });
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true, 
          isLooping: false,
          volume: volume,
          rate: playbackRate,
          shouldCorrectPitch: true,
        },
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setIsPlaying(false);
              
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
  }, [currentSentence, generateAudioUrl, isPlaying, volume, playbackRate]);

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

  // 初始化当前句子（根据历史错误率调整播放速度）
  useEffect(() => {
    if (!currentSentence) return;
    
    stopPlayback();
    
    const tokens = extractWords(currentSentence.text);
    const newWordStatuses = tokens.map((token, index) => ({
      word: token.word,
      displayText: token.displayText,
      revealed: token.isPunctuation,
      revealedChars: token.isPunctuation ? [] : new Array(token.word.length).fill(false),
      errorCharIndex: -1,
      index,
      isPunctuation: token.isPunctuation,
    }));
    setWordStatuses(newWordStatuses);
    setCurrentInput('');
    setTargetWordIndex(null); // 重置目标单词
    isLoopingRef.current = true;
    setIsLooping(true);
    
    // 预加载所有单词的翻译
    const wordsToTranslate = newWordStatuses
      .filter(ws => !ws.isPunctuation && !wordTranslations[ws.word])
      .map(ws => ws.word);
    
    if (wordsToTranslate.length > 0) {
      Promise.all(
        wordsToTranslate.map(word => 
          fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: word, type: 'word' }),
          })
            .then(res => res.json())
            .then(data => ({ word, translation: data.translation || '' }))
            .catch(() => ({ word, translation: '' }))
        )
      ).then(results => {
        const newTranslations: Record<string, string> = {};
        results.forEach(({ word, translation }) => {
          if (translation) {
            newTranslations[word] = translation;
          }
        });
        if (Object.keys(newTranslations).length > 0) {
          setWordTranslations(prev => ({ ...prev, ...newTranslations }));
        }
      });
    }
    
    // 根据历史错误率调整播放速度
    (async () => {
      if (materialId && currentSentence.id) {
        const suggestedRate = await getSuggestedPlaybackRate(materialId, currentSentence.id);
        playbackRateRef.current = suggestedRate;
        setPlaybackRate(suggestedRate);
        
        // 记录本次尝试
        await recordSentenceAttempt(materialId, currentSentence.id);
      }
    })();
    
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
    const currentWordStatuses = wordStatusesRef.current;

    // 检测是否输入了空格或回车（用户确认单词）
    const lastChar = text[text.length - 1];
    const isConfirmChar = lastChar === ' ' || lastChar === '\n';
    
    // 提取实际单词内容（去掉末尾的空格/回车）
    const actualInput = isConfirmChar ? text.slice(0, -1) : text;
    
    // 规范化特殊字符：将弯引号等转换为直引号
    const normalizedInput = actualInput
      .replace(/[''′']/g, "'")  // 各种单引号 -> 直引号
      .replace(/[""″"]/g, '"')  // 各种双引号 -> 直引号
      .replace(/[—–−]/g, '-')   // 各种破折号 -> 连字符
      .toLowerCase();

    // 空输入时重置
    if (normalizedInput.length === 0) {
      setCurrentInput('');
      setTargetWordIndexWithRef(null);
      return;
    }

    // 获取未完成的单词
    const incompleteWords = currentWordStatuses.filter(w => !w.isPunctuation && !w.revealed);
    if (incompleteWords.length === 0) {
      setCurrentInput('');
      return;
    }

    // 如果用户按了空格/回车，强制匹配当前输入
    if (isConfirmChar) {
      const matchedWord = incompleteWords.find(w => w.word.toLowerCase() === normalizedInput);
      
      if (matchedWord) {
        // 匹配成功，显示单词
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
      }
      // 无论匹配成功与否，都清空输入框
      setCurrentInput('');
      setTargetWordIndexWithRef(null);
      return;
    }

    // 正常输入流程：检查是否完全匹配某个单词
    const matchedWord = incompleteWords.find(w => w.word.toLowerCase() === normalizedInput);

    // 检查是否有其他单词以当前输入开头（说明用户可能还在输入）
    const hasLongerMatch = incompleteWords.some(w => {
      const wordLower = w.word.toLowerCase();
      // 排除完全匹配的单词，找以当前输入开头但更长的单词
      return wordLower !== normalizedInput && wordLower.startsWith(normalizedInput);
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

    // 输入过程中只保留用户输入
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

  // 句子完成处理（保存进度到本地）
  const handleSentenceComplete = useCallback(async () => {
    isLoopingRef.current = false;
    setIsLooping(false);
    pauseAudio();
    
    // 保存进度到本地
    if (materialId && currentSentence?.id) {
      await markSentenceCompleted(materialId, currentSentence.id);
    }
    
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${currentSentence?.id}/complete`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('标记完成失败:', e);
    }
    
    // 更新本地状态
    setSentences(prev => prev.map(s => 
      s.id === currentSentence?.id ? { ...s, is_completed: true } : s
    ));
    
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

  // 处理单词点击
  const handleWordPress = useCallback((ws: WordStatus) => {
    if (ws.isPunctuation) return;
    
    if (ws.revealed) {
      // 已完成的单词：显示中文翻译
      setTranslationWordIndex(ws.index);
      
      // 检查缓存
      if (wordTranslations[ws.word]) {
        // 已有缓存，直接显示
        setTimeout(() => {
          setTranslationWordIndex(null);
        }, 1000);
      } else {
        // 获取翻译
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: ws.displayText, type: 'word' }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.translation) {
              setWordTranslations(prev => ({
                ...prev,
                [ws.word]: data.translation,
              }));
            }
          })
          .catch(e => console.error('获取单词翻译失败:', e));
        
        setTimeout(() => {
          setTranslationWordIndex(null);
        }, 1000);
      }
    } else {
      // 未完成的单词：显示提示（首字母 + 下划线）
      setHintWordIndex(ws.index);
      setTimeout(() => {
        setHintWordIndex(null);
      }, 1000);
    }
  }, [wordTranslations]);

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

      {/* Content with Keyboard Avoiding */}
      <KeyboardAvoidingView
        style={styles.contentWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Sentence Section - 可滚动 */}
        <ScrollView 
          style={styles.sentenceSection}
          contentContainerStyle={styles.sentenceScrollContent} 
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
                    <TouchableOpacity 
                      style={styles.wordBox}
                      onPress={() => handleWordPress(ws)}
                      activeOpacity={0.7}
                    >
                      {ws.displayText.split('').map((char, charIdx) => {
                        // 判断显示内容
                        let displayChar = char;
                        if (!ws.revealed) {
                          if (hintWordIndex === ws.index) {
                            // 提示模式：显示完整单词
                            displayChar = char;
                          } else if (ws.revealedChars[charIdx]) {
                            displayChar = char;
                          } else {
                            displayChar = '_';
                          }
                        }
                        
                        return (
                          <ThemedText
                            key={charIdx}
                            variant="h4"
                            color={
                              ws.revealed
                                ? theme.success
                                : hintWordIndex === ws.index
                                ? theme.primary // 提示模式下所有字母高亮
                                : ws.revealedChars[charIdx]
                                ? theme.textPrimary
                                : ws.errorCharIndex === charIdx
                                ? theme.error
                                : theme.textMuted
                            }
                            style={[
                              styles.char,
                              !ws.revealed && hintWordIndex !== ws.index && !ws.revealedChars[charIdx] && styles.hiddenChar,
                              ws.errorCharIndex === charIdx && styles.errorChar,
                            ]}
                          >
                            {displayChar}
                          </ThemedText>
                        );
                      })}
                      {/* 单词翻译 */}
                      {translationWordIndex === ws.index && ws.revealed && (
                        <ThemedText variant="caption" color={theme.textSecondary} style={styles.wordHint}>
                          {wordTranslations[ws.word] || '...'}
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Translation Display - 放在句子区域内 */}
          {showTranslation && currentTranslation && (
            <View style={styles.translationCard}>
              <ThemedText variant="body" color={theme.textSecondary} style={{ textAlign: 'center' }}>
                {currentTranslation}
              </ThemedText>
            </View>
          )}
        </ScrollView>

        {/* Input Section - 紧跟句子区域 */}
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
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
