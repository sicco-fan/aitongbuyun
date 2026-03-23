import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  Keyboard,
} from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';
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
  word: string; // 纯单词（无标点）
  displayText: string; // 显示文本（包含标点，如 "hello," 或 "world!"）
  revealed: boolean; // 整个单词是否已完全显示
  revealedChars: boolean[]; // 每个字母是否已显示
  errorCharIndex: number; // 错误字母的索引（-1表示无错误）
  index: number;
  isPunctuation: boolean; // 是否是标点符号
}

// 后端服务地址 - 直接连接后端服务器，不经过 Metro 代理
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

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
  const [hintWordIndex, setHintWordIndex] = useState<number | null>(null); // 当前显示提示的单词索引
  
  // 翻译显示
  const [recentCompletedWordIndex, setRecentCompletedWordIndex] = useState<number | null>(null); // 最近完成的单词索引
  const [recentWordTranslation, setRecentWordTranslation] = useState<string | null>(null); // 最近完成单词的翻译
  const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null); // 句子完成后的翻译
  
  // 刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 音频控制状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [volume, setVolume] = useState(1.0);
  
  // 语音输入状态
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const [recordingCount, setRecordingCount] = useState(0); // 录音次数计数
  const [deviceId, setDeviceId] = useState<string>(''); // 设备ID
  
  // 识别模式：sentence > word > letter（优先级从高到低）
  const [recognitionMode, setRecognitionMode] = useState<'sentence' | 'word' | 'letter'>('sentence');
  const recognitionModeRef = useRef<'sentence' | 'word' | 'letter'>('sentence');
  
  // 识别间隔（毫秒）：句子3秒，单词2秒，字母0.5秒
  const RECOGNITION_INTERVALS = {
    sentence: 3000,
    word: 2000,
    letter: 500,
  };
  
  // 识别历史记录（用于显示给用户）
  const [recognitionHistory, setRecognitionHistory] = useState<Array<{
    text: string;
    type: 'letter' | 'word' | 'raw';
    matched: boolean;
    aiCorrected?: boolean; // 是否经过AI纠正
    timestamp: number;
  }>>([]);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isLoopingRef = useRef(true);
  const sentenceTimesRef = useRef({ start: 0, end: 0 });
  const isRecordingRef = useRef(false); // 使用 ref 跟踪录音状态，避免闭包问题
  const inputRef = useRef<TextInput>(null); // 输入框引用
  const currentSentenceIdRef = useRef<number | null>(null); // 跟踪当前句子ID，防止异步翻译混乱
  const completedRef = useRef(false); // 跟踪完成状态，用于音频回调中立即停止
  const currentIndexRef = useRef(0); // 跟踪当前句子索引，用于刷新时保持位置

  const currentSentence = sentences[currentIndex];
  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;
  
  // 计算完成进度（字母数）
  const totalChars = wordStatuses.filter(w => !w.isPunctuation).reduce((sum, w) => sum + w.word.length, 0);
  const completedChars = wordStatuses.filter(w => !w.isPunctuation).reduce((sum, w) => {
    return sum + w.revealedChars.filter(Boolean).length;
  }, 0);
  const sentenceProgress = totalChars > 0 ? Math.round((completedChars / totalChars) * 100) : 0;

  // 初始化录音权限
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasRecordingPermission(status === 'granted');
    })();
  }, []);

  // 初始化设备ID
  useEffect(() => {
    const initDeviceId = async () => {
      try {
        let id = await AsyncStorage.getItem('deviceId');
        if (!id) {
          id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await AsyncStorage.setItem('deviceId', id);
        }
        setDeviceId(id);
      } catch (error) {
        console.error('初始化设备ID失败:', error);
      }
    };
    initDeviceId();
  }, []);

  // 刷新材料数据（可手动调用或页面获得焦点时自动调用）
  const refreshMaterial = useCallback(async (showLoading: boolean = false) => {
    if (!materialId) return;
    
    if (showLoading) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const data = await response.json();

      if (data.material && data.sentences) {
        setMaterial(data.material);
        // 使用 ref 获取当前句子 ID，避免依赖问题
        const currentSentenceId = currentSentenceIdRef.current;
        const updatedCurrentIndex = data.sentences.findIndex((s: Sentence) => s.id === currentSentenceId);
        
        if (updatedCurrentIndex >= 0 && !data.sentences[updatedCurrentIndex]?.is_completed) {
          // 当前句子未完成，保持位置
          setCurrentIndex(updatedCurrentIndex);
        } else {
          // 当前句子已完成或不存在，跳转到第一个未完成的
          const firstIncomplete = data.sentences.findIndex((s: Sentence) => !s.is_completed);
          setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
        }
        
        setSentences(data.sentences);
        const total = data.sentences.reduce((sum: number, s: Sentence) => sum + (s.attempts || 0), 0);
        setTotalAttempts(total);
        console.log('[刷新] 材料数据已更新，共', data.sentences.length, '个句子');
      }
    } catch (error) {
      console.error('加载材料失败:', error);
      if (showLoading) {
        Alert.alert('错误', '加载材料失败');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  // 只依赖 materialId，使用 ref 获取当前状态
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  // 加载材料数据（每次页面获得焦点时重新加载，确保获取最新时间戳）
  useFocusEffect(
    useCallback(() => {
      refreshMaterial(false);
    }, [refreshMaterial])
  );

  // 同步 currentIndex 到 ref
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // 当切换句子时，初始化单词状态并开始播放
  useEffect(() => {
    if (currentSentence && material?.audio_url) {
      const tokens = extractWords(currentSentence.text);
      
      setWordStatuses(tokens.map((token, index) => ({
        word: token.word,
        displayText: token.displayText,
        revealed: token.isPunctuation, // 标点符号默认显示
        revealedChars: token.isPunctuation ? [] : new Array(token.word.length).fill(false),
        errorCharIndex: -1, // 初始无错误
        index,
        isPunctuation: token.isPunctuation,
      })));
      setCurrentInput('');
      setFeedback(null);
      setHintWordIndex(null);
      setPlayCount(0);
      setRecentCompletedWordIndex(null); // 清除最近完成单词
      setRecentWordTranslation(null); // 清除最近单词翻译
      setSentenceTranslation(null); // 清除句子翻译
      currentSentenceIdRef.current = currentSentence.id; // 更新当前句子ID
      
      // 保存当前句子的时间范围
      sentenceTimesRef.current = {
        start: currentSentence.start_time || 0,
        end: currentSentence.end_time || 0,
      };
      
      // 自动开始循环播放
      isLoopingRef.current = true;
      startSentenceLoopPlayback();
      
      // 自动聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
    
    return () => {
      stopPlayback();
    };
  }, [currentSentence, material?.audio_url]);

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

  // 提取单词和标点（保留标点符号显示）
  const extractWords = (text: string): { word: string; displayText: string; isPunctuation: boolean }[] => {
    const result: { word: string; displayText: string; isPunctuation: boolean }[] = [];
    // 使用正则分割，保留标点
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

  // 标准化字符（用于比较）
  const normalizeChar = (char: string): string => {
    return char.toLowerCase();
  };

  // 开始句子片段循环播放
  const startSentenceLoopPlayback = useCallback(async () => {
    if (!material?.audio_url) return;

    try {
      // 先确保音频模式正确（从扬声器播放，而非听筒）
      // 这在 iOS 上特别重要，因为录音后会切换到听筒
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch (e) {
        console.log('设置音频模式失败:', e);
      }

      // 停止之前的播放
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { start, end } = sentenceTimesRef.current;
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: material.audio_url },
        { 
          shouldPlay: true, 
          isLooping: false, // 我们自己控制循环
          volume: volume,
          positionMillis: start,
        },
        (status) => {
          // 如果已完成，立即停止
          if (completedRef.current) {
            if (soundRef.current) {
              soundRef.current.stopAsync().catch((e) => console.log('停止播放失败:', e));
            }
            return;
          }
          
          if (status.isLoaded && soundRef.current && isLoopingRef.current) {
            // 当播放到句子结束位置时，跳回开始位置继续播放
            if (status.positionMillis >= end) {
              soundRef.current.setPositionAsync(start);
              setPlayCount(prev => prev + 1);
            }
            
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      
      // 设置初始播放位置
      await sound.setPositionAsync(start);
      
    } catch (error) {
      console.error('播放失败:', error);
    }
  }, [material?.audio_url, volume]);

  // 停止播放
  const stopPlayback = useCallback(async () => {
    // 先设置标志，防止回调继续循环
    isLoopingRef.current = false;
    completedRef.current = true;
    
    if (soundRef.current) {
      try {
        // 先暂停，然后卸载
        await soundRef.current.pauseAsync();
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {
        // 忽略错误
      }
    }
    setIsPlaying(false);
  }, []);

  // 当完成时，停止音频播放
  useEffect(() => {
    if (completed) {
      stopPlayback();
    }
  }, [completed, stopPlayback]);

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

  // 设置音量（expo-av 限制音量在 0-1 之间）
  const handleVolumeChange = useCallback(async (newVolume: number) => {
    // 将显示值限制在 0-1.0 之间（实际音量）
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
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
        await startSentenceLoopPlayback();
      }
    }
  }, [isPlaying, pausePlayback, resumePlayback, startSentenceLoopPlayback]);

  // 直接匹配完整单词（用于语音识别结果）
  const matchCompleteWord = useCallback((word: string) => {
    if (!word) return false;
    
    const wordLower = word.toLowerCase().replace(/[^a-z]/g, '');
    if (wordLower.length === 0) return false;
    
    console.log('[matchCompleteWord] 尝试匹配单词:', wordLower);
    
    let matched = false;
    
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      
      // 找到第一个匹配且未完成的单词
      for (let i = 0; i < newStatuses.length; i++) {
        const ws = newStatuses[i];
        if (ws.isPunctuation || ws.revealed) continue;
        
        const targetWordLower = ws.word.toLowerCase().replace(/[^a-z]/g, '');
        
        // 完全匹配
        if (targetWordLower === wordLower) {
          console.log('[matchCompleteWord] 完全匹配! 单词:', ws.word);
          // 标记整个单词为完成
          newStatuses[i] = {
            ...ws,
            revealed: true,
            revealedChars: new Array(ws.word.length).fill(true),
            errorCharIndex: -1,
          };
          matched = true;
          break;
        }
      }
      
      return newStatuses;
    });
    
    return matched;
  }, []);

  // 实时检查输入并更新字母显示
  const checkInputRealtime = useCallback((input: string) => {
    if (!input) {
      console.log('[checkInputRealtime] 输入为空，跳过');
      return { matched: false, correctLength: input.length, hasError: false };
    }
    
    const inputLower = input.toLowerCase();
    console.log('[checkInputRealtime] 输入:', inputLower);
    
    let matchedAny = false;
    let hasError = false;
    let correctLength = input.length;
    
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      
      // 遍历所有未完成的单词
      for (let wordIdx = 0; wordIdx < newStatuses.length; wordIdx++) {
        const ws = newStatuses[wordIdx];
        if (ws.isPunctuation || ws.revealed) continue;
        
        const wordLower = ws.word.toLowerCase();
        console.log('[checkInputRealtime] 尝试匹配单词:', wordLower, '输入:', inputLower);
        
        // 计算匹配长度
        let matchLen = 0;
        for (let i = 0; i < inputLower.length && i < wordLower.length; i++) {
          if (inputLower[i] === wordLower[i]) {
            matchLen++;
          } else {
            break;
          }
        }
        
        console.log('[checkInputRealtime] 匹配长度:', matchLen);
        
        // 完全匹配当前输入
        if (matchLen === inputLower.length && matchLen <= wordLower.length) {
          matchedAny = true;
          console.log('[checkInputRealtime] 匹配成功! 单词:', wordLower, '匹配长度:', matchLen);
          
          // 更新已显示的字母
          const newRevealedChars = [...ws.revealedChars];
          for (let i = 0; i < matchLen; i++) {
            newRevealedChars[i] = true;
          }
          newStatuses[wordIdx] = { ...ws, revealedChars: newRevealedChars, errorCharIndex: -1 };
          
          // 如果整个单词都输入了，标记为完成
          if (matchLen >= wordLower.length) {
            newStatuses[wordIdx] = { ...newStatuses[wordIdx], revealed: true };
          }
          break;
        }
        
        // 部分匹配但有错误（第一个字母匹配才处理）
        if (inputLower.length > 0 && inputLower[0] === wordLower[0]) {
          hasError = true;
          correctLength = matchLen;
          console.log('[checkInputRealtime] 部分匹配但有错误');
          
          // 更新正确部分的字母
          const newRevealedChars = [...ws.revealedChars];
          for (let i = 0; i < matchLen; i++) {
            newRevealedChars[i] = true;
          }
          
          // 标记错误字母位置
          const errorIdx = matchLen; // 错误位置就是匹配结束的位置
          newStatuses[wordIdx] = { 
            ...ws, 
            revealedChars: newRevealedChars, 
            errorCharIndex: errorIdx
          };
          break;
        }
        
        // 不匹配，继续检查下一个单词
        console.log('[checkInputRealtime] 不匹配，继续检查下一个单词');
      }
      
      return newStatuses;
    });
    
    return { matched: matchedAny, correctLength, hasError };
  }, []);

  // 监听单词状态变化，自动跳转到下一句
  useEffect(() => {
    // 检查是否所有非标点单词都已答出
    const nonPunctuationWords = wordStatuses.filter(w => !w.isPunctuation);
    const allWordsRevealed = nonPunctuationWords.length > 0 && 
      nonPunctuationWords.every(w => w.revealed);
    
    // 只有当：1. 所有非标点单词都完成 2. 有非标点单词存在 3. 当前句子存在 4. 未完成 5. 还没有翻译
    if (allWordsRevealed && currentSentence && !completed && !sentenceTranslation) {
      // 保存当前句子ID，用于验证异步响应
      const sentenceId = currentSentence.id;
      
      // 句子完成后才获取翻译
      fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentSentence.text, type: 'sentence' }),
      })
        .then(res => res.json())
        .then(data => {
          // 只有当前句子ID匹配时才设置翻译，防止切换句子后旧翻译显示
          if (data.translation && currentSentenceIdRef.current === sentenceId) {
            setSentenceTranslation(data.translation);
          }
        })
        .catch(err => console.error('翻译失败:', err));
      
      // 延迟一下再跳转，让用户看到完成状态和翻译
      const timer = setTimeout(() => {
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
        if (currentIndex < sentences.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // 先设置 ref，确保音频回调能立即检测到
          completedRef.current = true;
          isLoopingRef.current = false;
          setCompleted(true);
        }
      }, 2000); // 延长到2秒，让用户有时间看翻译
      
      return () => clearTimeout(timer);
    }
  }, [wordStatuses, currentSentence, currentIndex, sentences.length, totalAttempts, stopPlayback, completed]);

  // 处理输入变化 - 实时匹配
  const handleInputChange = (text: string) => {
    // 检测到空格时自动清空并继续
    if (text.includes(' ')) {
      setCurrentInput('');
      return;
    }
    
    // 实时检查输入
    if (text.length > 0) {
      const result = checkInputRealtime(text);
      
      // 如果有错误，立即清除输入框中的错误字母
      if (result.hasError && result.correctLength < text.length) {
        // 立即只保留正确的部分
        const correctPart = text.substring(0, result.correctLength);
        setCurrentInput(correctPart);
        
        // 错误标记会短暂显示红色，然后自动清除
        setTimeout(() => {
          setWordStatuses(prev => 
            prev.map(ws => 
              ws.errorCharIndex >= 0 ? { ...ws, errorCharIndex: -1 } : ws
            )
          );
        }, 300); // 300ms后清除红色标记
      } else {
        setCurrentInput(text);
      }
    } else {
      setCurrentInput(text);
    }
  };

  // 监听单词完成，自动清空输入框并获取翻译
  useEffect(() => {
    if (!currentInput) return;
    
    // 检查当前输入是否匹配了某个完整单词
    const inputLower = currentInput.toLowerCase();
    const matchedWord = wordStatuses.find(w => 
      !w.isPunctuation && 
      w.revealed && 
      w.word.toLowerCase() === inputLower
    );
    
    if (matchedWord) {
      // 找到了完整匹配的单词，清空输入
      const completedWord = currentInput;
      const wordIndex = matchedWord.index;
      setCurrentInput('');
      setFeedbackWord(completedWord);
      setFeedback('correct');
      setTimeout(() => setFeedback(null), 300);
      
      // 设置最近完成的单词索引，并获取翻译
      setRecentCompletedWordIndex(wordIndex);
      fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: matchedWord.displayText, type: 'word' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.translation && currentSentenceIdRef.current === currentSentence?.id) {
            setRecentWordTranslation(data.translation);
          }
        })
        .catch(err => console.error('翻译失败:', err));
    }
  }, [wordStatuses, currentInput, currentSentence]);

  // 处理键盘提交
  const handleSubmit = () => {
    if (currentInput.trim()) {
      checkInputRealtime(currentInput.trim());
      setCurrentInput('');
    }
  };

  // 持续录音模式 - 开始录音
  const startContinuousRecording = async () => {
    if (!hasRecordingPermission) {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          alert('需要麦克风权限');
        } else {
          Alert.alert('需要权限', '请授予麦克风权限');
        }
        return;
      }
      setHasRecordingPermission(true);
    }

    try {
      // 语音输入时暂停播放
      await pausePlayback();
      
      // 设置音频模式：录音模式
      // 关键：allowsRecordingIOS 必须为 true，playsInSilentModeIOS 为 true
      // interruptionModeIOS 设置为 DoNotMix 确保不会被其他音频打断
      // staysActiveInBackground 为 false 确保应用在后台时不录音
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingCount(0);
      setRecognitionHistory([]); // 清空识别历史
      setRecognitionMode('sentence'); // 重置为句子模式（最高优先级）
      recognitionModeRef.current = 'sentence';
      
      // 开始连续录音循环
      await startRecordingLoop();
      
    } catch (error) {
      console.error('开始录音失败:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  // 录音循环 - 持续录音并实时识别（动态间隔）
  const startRecordingLoop = async () => {
    if (!isRecordingRef.current) return;

    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      
      // 根据当前识别模式确定录音时长
      const currentMode = recognitionModeRef.current;
      const interval = RECOGNITION_INTERVALS[currentMode];
      console.log(`[录音循环] 当前模式: ${currentMode}, 录音时长: ${interval}ms`);
      
      setTimeout(async () => {
        if (!isRecordingRef.current) return;
        
        if (recordingRef.current) {
          try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            
            if (uri) {
              setRecordingCount(prev => prev + 1);
              // 立即识别，不需要等待
              await recognizeAudio(uri);
            }
          } catch (e) {
            console.error('停止录音片段失败:', e);
          }
        }
        
        // 继续下一轮录音
        if (isRecordingRef.current) {
          await startRecordingLoop();
        }
      }, 600);
      
    } catch (error) {
      console.error('录音失败:', error);
      if (isRecordingRef.current) {
        setTimeout(() => startRecordingLoop(), 100);
      }
    }
  };

  // 识别单个音频片段
  const recognizeAudio = async (uri: string) => {
    try {
      const formData = new FormData();
      const audioFile = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
      formData.append('file', audioFile as any);
      formData.append('deviceId', deviceId);
      formData.append('materialId', String(material?.id || 0)); // 添加材料ID用于AI学习
      
      // 获取未完成的单词列表用于模糊匹配
      const uncompletedWords = wordStatuses
        .filter(w => !w.isPunctuation && !w.revealed)
        .map(w => w.word)
        .join(',');
      
      if (uncompletedWords) {
        formData.append('targetWords', uncompletedWords);
      }
      
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech-recognize`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      console.log('[语音识别] 返回结果:', JSON.stringify(data));
      
      // 始终显示识别结果（不管成功或失败）
      if (data.error) {
        // 识别失败（如静音），不显示错误信息，避免干扰用户
        // 只有在真正识别到内容时才显示
        return;
      }
      
      if (data.text) {
        // 获取后端判断的识别类型
        const detectedType: 'sentence' | 'word' | 'letter' = data.detectedType || 'letter';
        
        // 有识别结果，显示在历史区域
        const itemType: 'letter' | 'word' | 'raw' = 
          data.letters && data.letters.length > 0 ? 'letter' :
          data.matchedWords && data.matchedWords.length > 0 ? 'word' : 'raw';
        
        const isMatched = !!(data.letters?.length || data.matchedWords?.length);
        const aiCorrected = data.aiCorrected || false; // AI纠正标识
        
        console.log(`[语音识别] 显示结果: "${data.text}" 类型: ${itemType} 检测类型: ${detectedType} 匹配: ${isMatched} AI纠正: ${aiCorrected}`);
        
        // 根据识别结果动态调整识别模式（优先级：sentence > word > letter）
        // 只有在成功匹配时才降级模式
        if (isMatched) {
          // 匹配成功，根据检测类型调整模式
          if (detectedType === 'sentence') {
            // 句子模式：保持句子模式（最高优先级）
            console.log('[语音识别] 保持句子模式');
          } else if (detectedType === 'word') {
            // 单词模式：降级为单词模式
            if (recognitionModeRef.current !== 'letter') {
              console.log('[语音识别] 降级为单词模式');
              setRecognitionMode('word');
              recognitionModeRef.current = 'word';
            }
          } else {
            // 字母模式：降级为字母模式
            console.log('[语音识别] 降级为字母模式');
            setRecognitionMode('letter');
            recognitionModeRef.current = 'letter';
          }
        }
        
        setRecognitionHistory(prev => [...prev, {
          text: data.text as string,
          type: itemType,
          matched: isMatched,
          aiCorrected,
          timestamp: Date.now(),
        }].slice(-15)); // 只保留最近15条
        
        // 如果匹配成功，自动填入
        if (data.letters && data.letters.length > 0) {
          // 字母模式：逐个填入字母（使用逐字母匹配）
          for (const letter of data.letters) {
            checkInputRealtime(letter as string);
          }
        } else if (data.matchedWords && data.matchedWords.length > 0) {
          // 单词模式：直接匹配完整单词
          console.log('[语音识别] 匹配到的单词:', data.matchedWords);
          for (const word of data.matchedWords) {
            const success = matchCompleteWord(word as string);
            console.log(`[语音识别] 匹配单词 "${word}": ${success ? '成功' : '失败'}`);
          }
        }
      }
    } catch (error) {
      console.error('识别失败:', error);
    }
  };

  // 停止持续录音
  const stopContinuousRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
    // 停止当前录音
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (e) {
        // 忽略
      }
    }
    
    // 恢复音频模式为播放模式
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (e) {
      console.error('恢复音频模式失败:', e);
    }
    
    // 恢复播放
    resumePlayback();
  };

  // 提示指定单词（在原位置显示3秒）
  const showHintForWord = (index: number) => {
    const wordStatus = wordStatuses[index];
    if (!wordStatus || wordStatus.isPunctuation) return;
    
    if (wordStatus.revealed) {
      // 已经答对了，不需要提示
      return;
    }
    
    // 在原位置显示单词提示，3秒后消失
    setHintWordIndex(index);
    setTimeout(() => {
      setHintWordIndex(null);
    }, 3000);
  };

  // 上一句
  const goToPrevSentence = () => {
    if (currentIndex > 0) {
      stopPlayback();
      setCurrentIndex(prev => prev - 1);
    }
  };

  // 下一句
  const goToNextSentence = () => {
    stopPlayback();
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      completedRef.current = true;
      isLoopingRef.current = false;
      setCompleted(true);
    }
  };

  // 渲染单词显示（带字母进度和翻译）
  const renderWordDisplay = (ws: WordStatus, idx: number) => {
    if (ws.isPunctuation) {
      return (
        <Text 
          key={idx}
          style={{ color: theme.textSecondary, marginHorizontal: 2, fontSize: 16 }}
        >
          {ws.displayText}
        </Text>
      );
    }
    
    // 判断是否是最近完成的单词（需要显示翻译）
    const isRecentCompleted = recentCompletedWordIndex === idx && recentWordTranslation;
    
    // 如果单词已完成，显示完整单词
    if (ws.revealed) {
      return (
        <View key={idx} style={styles.wordWithTranslation}>
          <TouchableOpacity 
            style={[styles.wordSlot, styles.wordCorrect]}
            activeOpacity={0.7}
          >
            <Text style={{ color: theme.success, fontWeight: '600', fontSize: 16 }}>
              {ws.displayText}
            </Text>
          </TouchableOpacity>
          {/* 只显示最近完成单词的翻译 */}
          {isRecentCompleted && (
            <Text style={styles.wordTranslationText} numberOfLines={1}>
              {recentWordTranslation}
            </Text>
          )}
        </View>
      );
    }
    
    if (hintWordIndex === idx) {
      return (
        <TouchableOpacity 
          key={idx} 
          style={[styles.wordSlot, styles.wordHint]}
          onPress={() => showHintForWord(idx)}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#F59E0B', fontWeight: '600', fontSize: 16 }}>
            {ws.displayText}
          </Text>
        </TouchableOpacity>
      );
    }
    
    // 显示字母进度
    const chars = ws.word.split('');
    
    return (
      <TouchableOpacity 
        key={idx} 
        style={[styles.wordSlot, styles.wordHidden, ws.errorCharIndex >= 0 && styles.wordError]}
        onPress={() => showHintForWord(idx)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {chars.map((char, charIdx) => {
            // 错误字母显示红色
            if (charIdx === ws.errorCharIndex) {
              return (
                <Text 
                  key={charIdx}
                  style={{
                    color: theme.error,
                    fontWeight: '700',
                    fontSize: 16,
                    minWidth: 10,
                    textAlign: 'center',
                  }}
                >
                  {char}
                </Text>
              );
            }
            
            // 正确字母显示绿色，未输入显示下划线
            return (
              <Text 
                key={charIdx}
                style={{
                  color: ws.revealedChars[charIdx] ? theme.success : theme.textMuted,
                  fontWeight: ws.revealedChars[charIdx] ? '600' : '400',
                  fontSize: 16,
                  minWidth: 10,
                  textAlign: 'center',
                }}
              >
                {ws.revealedChars[charIdx] ? char : '_'}
              </Text>
            );
          })}
        </View>
      </TouchableOpacity>
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
            style={[styles.completedButton, styles.primaryButton]}
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
        {/* Header with Back Button */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <FontAwesome6 name="chevron-left" size={16} color={theme.textPrimary} />
              <ThemedText variant="smallMedium" color={theme.textPrimary} style={{ marginLeft: 4 }}>
                返回
              </ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.progressHeader}>
            <View style={styles.progressBadge}>
              <ThemedText variant="captionMedium" color={theme.buttonPrimaryText}>
                {currentIndex + 1}/{sentences.length}
              </ThemedText>
            </View>
            <ThemedText variant="body" color={theme.textMuted}>
              {Math.round(progress)}%
            </ThemedText>
            
            {/* 句子导航按钮 */}
            <View style={styles.headerNav}>
              <TouchableOpacity
                style={[styles.headerNavBtn, currentIndex === 0 && styles.buttonDisabled]}
                onPress={goToPrevSentence}
                disabled={currentIndex === 0}
              >
                <FontAwesome6 name="chevron-left" size={14} color={currentIndex === 0 ? theme.textMuted : theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerNavBtn}
                onPress={goToNextSentence}
              >
                <FontAwesome6 name="chevron-right" size={14} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {/* 刷新按钮 */}
            <TouchableOpacity
              style={[styles.headerNavBtn, { marginLeft: 8 }]}
              onPress={() => refreshMaterial(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <FontAwesome6 name="rotate" size={14} color={theme.textPrimary} />
              )}
            </TouchableOpacity>
          </View>
          <ThemedText variant="h4" color={theme.textPrimary}>
            {title || material?.title}
          </ThemedText>
        </ThemedView>

        {/* Audio Section */}
        <View style={styles.audioSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayback}
            >
              <FontAwesome6
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={theme.buttonPrimaryText}
              />
            </TouchableOpacity>
            
            {/* 音量控制 */}
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <ThemedText variant="caption" color={theme.textMuted}>音量</ThemedText>
                <ThemedText variant="caption" color={theme.textPrimary}>{Math.round(volume * 100)}%</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={{ padding: 6, backgroundColor: theme.backgroundTertiary, borderRadius: 6 }}
                  onPress={() => handleVolumeChange(Math.max(0, volume - 0.1))}
                >
                  <FontAwesome6 name="minus" size={12} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 6, backgroundColor: theme.backgroundTertiary, borderRadius: 6 }}
                  onPress={() => handleVolumeChange(Math.min(1, volume + 0.1))}
                >
                  <FontAwesome6 name="plus" size={12} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 6, backgroundColor: volume >= 0.9 ? theme.primary : theme.backgroundTertiary, borderRadius: 6 }}
                  onPress={() => handleVolumeChange(1.0)}
                >
                  <FontAwesome6 name="volume-high" size={12} color={volume >= 0.9 ? theme.buttonPrimaryText : theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Sentence Display */}
        <View style={styles.sentenceSection}>
          <View style={styles.sentenceHeader}>
            <ThemedText variant="caption" color={theme.textMuted}>
              句子进度：{completedChars}/{totalChars} 字母 ({sentenceProgress}%)
            </ThemedText>
          </View>
          <View style={styles.wordsContainer}>
            {wordStatuses.map((ws, idx) => renderWordDisplay(ws, idx))}
          </View>
          
          {/* 句子完成后的翻译显示 */}
          {sentenceTranslation && (
            <View style={styles.sentenceTranslationBox}>
              <ThemedText variant="small" color={theme.textSecondary}>
                {sentenceTranslation}
              </ThemedText>
            </View>
          )}
          
          <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 8, textAlign: 'center' }}>
            点击未答出的单词可以查看提示
          </ThemedText>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.inputLabel}>
            直接输入字母，实时匹配
          </ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={currentInput}
              onChangeText={handleInputChange}
              onSubmitEditing={handleSubmit}
              placeholder="输入你听到的单词..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
              onPress={isRecording ? stopContinuousRecording : startContinuousRecording}
            >
              <FontAwesome6
                name={isRecording ? 'stop' : 'microphone'}
                size={24}
                color={theme.buttonPrimaryText}
              />
            </TouchableOpacity>
          </View>
          
          {/* 实时识别结果显示区域 - 始终显示在输入框下方 */}
          <View style={{
            marginTop: 12,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            backgroundColor: theme.backgroundTertiary,
            borderRadius: BorderRadius.lg,
            minHeight: 70,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText variant="caption" color={theme.textMuted}>
                  实时识别结果 {isRecording && `· 识别中 ${recordingCount} 次`}
                </ThemedText>
                {isRecording && (
                  <View style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: recognitionMode === 'sentence' ? theme.primary :
                                    recognitionMode === 'word' ? theme.accent : theme.success,
                  }}>
                    <Text style={{ fontSize: 10, color: theme.buttonPrimaryText, fontWeight: '600' }}>
                      {recognitionMode === 'sentence' ? '句子' :
                       recognitionMode === 'word' ? '单词' : '字母'}
                    </Text>
                  </View>
                )}
              </View>
              {recognitionHistory.length > 0 && (
                <TouchableOpacity onPress={() => setRecognitionHistory([])}>
                  <ThemedText variant="caption" color={theme.textMuted}>清除</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            
            {recognitionHistory.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {recognitionHistory.map((item, index) => (
                    <View
                      key={index}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: BorderRadius.md,
                        backgroundColor: item.matched 
                          ? (item.type === 'letter' ? theme.success : theme.primary)
                          : theme.backgroundDefault,
                        borderWidth: 1,
                        borderColor: item.matched 
                          ? (item.type === 'letter' ? theme.success : theme.primary)
                          : theme.border,
                      }}
                    >
                      <Text style={{
                        color: item.matched ? theme.buttonPrimaryText : theme.textSecondary,
                        fontSize: 14,
                        fontWeight: '600',
                      }}>
                        {item.text}
                        {item.aiCorrected && ' ✓'} {/* AI纠正标记 */}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ThemedText variant="caption" color={theme.textMuted} style={{ textAlign: 'center', paddingVertical: 8 }}>
                点击麦克风开始语音识别，结果将显示在这里
              </ThemedText>
            )}
          </View>
        </View>

        {/* Feedback - 只显示正确提示 */}
        <View style={styles.feedbackSection}>
          {feedback === 'correct' && (
            <View style={styles.feedbackCorrect}>
              <FontAwesome6 name="check" size={16} color={theme.success} />
              <ThemedText variant="smallMedium" style={styles.feedbackCorrectText}>
                「{feedbackWord}」正确！
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
