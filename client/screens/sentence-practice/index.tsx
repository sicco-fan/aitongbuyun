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
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createFormDataFile } from '@/utils';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

/**
 * 判断字符是否为单引号类字符
 * 包含所有可能的单引号变体
 */
const isSingleQuoteLike = (char: string): boolean => {
  const code = char.charCodeAt(0);
  // 常见单引号类字符的 Unicode 码点
  return (
    code === 0x0027 || // ' Apostrophe
    code === 0x0060 || // ` Grave accent
    code === 0x00B4 || // ´ Acute accent
    code === 0x02B9 || // ʹ Modifier letter prime
    code === 0x02BA || // ʺ Modifier letter double prime
    code === 0x02BB || // ʻ Modifier letter turned comma
    code === 0x02BC || // ʼ Modifier letter apostrophe
    code === 0x02BD || // ʽ Modifier letter reversed comma
    code === 0x2018 || // ' Left single quotation mark
    code === 0x2019 || // ' Right single quotation mark
    code === 0x201A || // ‚ Single low-9 quotation mark
    code === 0x201B || // ‛ Single high-reversed-9 quotation mark
    code === 0x2032 || // ′ Prime
    code === 0x2035 || // ‵ Reversed prime
    code === 0xFF07    // ＇ Fullwidth apostrophe
  );
};

/**
 * 判断字符是否为双引号类字符
 */
const isDoubleQuoteLike = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    code === 0x0022 || // " Quotation mark
    code === 0x201C || // " Left double quotation mark
    code === 0x201D || // " Right double quotation mark
    code === 0x201E || // „ Double low-9 quotation mark
    code === 0x201F || // ‟ Double high-reversed-9 quotation mark
    code === 0x2033 || // ″ Double prime
    code === 0x2036    // ‶ Reversed double prime
  );
};

/**
 * 判断字符是否为破折号类字符
 */
const isDashLike = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    code === 0x002D || // - Hyphen-minus
    code === 0x2010 || // – Hyphen
    code === 0x2011 || // ‑ Non-breaking hyphen
    code === 0x2012 || // ‒ Figure dash
    code === 0x2013 || // – En dash
    code === 0x2014 || // — Em dash
    code === 0x2212    // − Minus sign
  );
};

/**
 * 比较两个单词是否匹配（忽略引号格式差异）
 */
const wordsMatch = (word1: string, word2: string): boolean => {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  if (w1.length !== w2.length) return false;
  
  for (let i = 0; i < w1.length; i++) {
    const c1 = w1[i];
    const c2 = w2[i];
    
    // 完全相同
    if (c1 === c2) continue;
    
    // 都是单引号类字符
    if (isSingleQuoteLike(c1) && isSingleQuoteLike(c2)) continue;
    
    // 都是双引号类字符
    if (isDoubleQuoteLike(c1) && isDoubleQuoteLike(c2)) continue;
    
    // 都是破折号类字符
    if (isDashLike(c1) && isDashLike(c2)) continue;
    
    // 不匹配
    return false;
  }
  
  return true;
};

/**
 * 检查单词是否以指定前缀开头（忽略引号格式差异）
 */
const wordsStartWith = (prefix: string, word: string): boolean => {
  const p = prefix.toLowerCase();
  const w = word.toLowerCase();
  
  if (p.length > w.length) return false;
  
  for (let i = 0; i < p.length; i++) {
    const c1 = p[i];
    const c2 = w[i];
    
    // 完全相同
    if (c1 === c2) continue;
    
    // 都是单引号类字符
    if (isSingleQuoteLike(c1) && isSingleQuoteLike(c2)) continue;
    
    // 都是双引号类字符
    if (isDoubleQuoteLike(c1) && isDoubleQuoteLike(c2)) continue;
    
    // 都是破折号类字符
    if (isDashLike(c1) && isDashLike(c2)) continue;
    
    // 不匹配
    return false;
  }
  
  return true;
};

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
  const params = useSafeSearchParams<{ fileId: number; title: string; sentenceIndex?: number; errorPriority?: boolean; targetWord?: string; targetCorrectCount?: number }>();
  const { user, isAuthenticated } = useAuth();

  const fileId = params.fileId;

  const [file, setFile] = useState<SentenceFile | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resumingFromProgress, setResumingFromProgress] = useState(false); // 是否从进度恢复
  const [errorPriority, setErrorPriority] = useState(params.errorPriority || false); // 错题优先模式
  const [errorSentences, setErrorSentences] = useState<Array<{ sentence_index: number; totalErrors: number }>>([]); // 错题句子列表
  const hasShownProgressAlert = useRef(false); // 是否已经显示过进度弹窗（防止重复弹出）
  
  // 薄弱词汇练习：目标单词追踪
  const targetWord = params.targetWord ? (params.targetWord as string).toLowerCase() : null;
  const targetCorrectCount = params.targetCorrectCount ? Number(params.targetCorrectCount) : 0;
  const targetWordCorrectRef = useRef(0); // 目标单词已正确次数
  const shouldReturnAfterSentenceRef = useRef(false); // 是否在句子完成后返回

  // 单词状态
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [targetWordIndex, setTargetWordIndex] = useState<number | null>(null); // 当前正在匹配的单词索引
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null); // 延迟确认定时器

  // 单词提示和翻译
  const [hintWordIndex, setHintWordIndex] = useState<number | null>(null); // 显示提示的单词
  const [translationWordIndex, setTranslationWordIndex] = useState<number | null>(null); // 显示翻译的单词
  const [wordTranslations, setWordTranslations] = useState<Record<string, string>>({}); // 单词翻译缓存

  // 翻译显示
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState('');

  // 句子积分累积（仅后台记录，不显示弹窗）
  const currentSentencePointsRef = useRef(0);

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

  // 键盘类型：'system' 手机键盘 | 'custom' 自建键盘
  const [keyboardType, setKeyboardType] = useState<'system' | 'custom'>('system');
  const [showNumberPanel, setShowNumberPanel] = useState(false); // 显示数字面板

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
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setHasRecordingPermission(status === 'granted');
      } catch (error) {
        console.log('[权限] 请求麦克风权限失败:', error);
        setHasRecordingPermission(false);
      }
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
        let loadedSentences = data.sentences;
        console.log(`[句库学习] 加载了 ${data.sentences.length} 个可学习句子`);
        
        // 如果是错题优先模式，获取错题句子列表并重新排序
        if (errorPriority && isAuthenticated && user?.id) {
          try {
            /**
             * 服务端文件：server/src/routes/error-words.ts
             * 接口：GET /api/v1/error-words/sentences
             * Query 参数：user_id: string, sentence_file_id: number
             */
            const errorResponse = await fetch(
              `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/sentences?user_id=${user.id}&sentence_file_id=${fileId}`
            );
            const errorData = await errorResponse.json();
            
            if (errorData.success && errorData.data && errorData.data.length > 0) {
              setErrorSentences(errorData.data);
              
              const errorIndexSet = new Set(errorData.data.map((e: { sentence_index: number }) => e.sentence_index));
              
              // 将有错题的句子移到前面
              const errorSentencesList = loadedSentences.filter((s: Sentence) => errorIndexSet.has(s.sentence_index));
              const normalSentencesList = loadedSentences.filter((s: Sentence) => !errorIndexSet.has(s.sentence_index));
              
              loadedSentences = [...errorSentencesList, ...normalSentencesList];
              console.log(`[错题优先] 已将 ${errorSentencesList.length} 个错题句子移到前面`);
            }
          } catch (errorError) {
            console.log('[错题优先] 获取错题句子失败:', errorError);
          }
        }
        
        setSentences(loadedSentences);
        
        // 如果有传入指定的句子索引，直接跳转
        if (params.sentenceIndex !== undefined && params.sentenceIndex < loadedSentences.length) {
          setCurrentIndex(params.sentenceIndex);
        } else {
          // 获取学习进度（只在首次进入时弹出提示）
          if (isAuthenticated && user?.id && !errorPriority && !hasShownProgressAlert.current) {
            hasShownProgressAlert.current = true; // 标记已显示过弹窗
            try {
              /**
               * 服务端文件：server/src/routes/learning.ts
               * 接口：GET /api/v1/learning-records/progress/:fileId
               * Query 参数：user_id: string
               */
              const progressResponse = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/progress/${fileId}?user_id=${user.id}`
              );
              const progressData = await progressResponse.json();
              
              if (progressData.success && progressData.progress) {
                const savedIndex = progressData.progress.lastSentenceIndex;
                // 如果有进度且不是第一句，询问是否继续
                if (savedIndex > 0 && savedIndex < loadedSentences.length) {
                  setResumingFromProgress(true);
                  Alert.alert(
                    '继续学习',
                    `上次学习到第 ${savedIndex + 1} 句，是否继续？`,
                    [
                      { 
                        text: '从头开始', 
                        onPress: () => {
                          setCurrentIndex(0);
                          setResumingFromProgress(false);
                        }
                      },
                      { 
                        text: '继续学习', 
                        onPress: () => {
                          setCurrentIndex(savedIndex);
                          setResumingFromProgress(false);
                        }
                      }
                    ]
                  );
                }
              }
            } catch (progressError) {
              console.log('[学习进度] 获取进度失败:', progressError);
            }
          }
        }
      }
    } catch (error) {
      console.error('加载句子失败:', error);
    } finally {
      setLoading(false);
    }
  }, [fileId, isAuthenticated, user?.id, errorPriority, params.sentenceIndex]);

  // 保存学习进度
  const saveProgress = useCallback(async (sentenceIndex: number) => {
    if (!isAuthenticated || !user?.id || !fileId) return;
    
    try {
      /**
       * 服务端文件：server/src/routes/learning.ts
       * 接口：POST /api/v1/learning-records/progress/:fileId
       * Body 参数：user_id: string, sentence_index: number
       */
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/progress/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sentence_index: sentenceIndex,
        }),
      });
      console.log(`[学习进度] 已保存进度: 第 ${sentenceIndex + 1} 句`);
    } catch (error) {
      console.error('[学习进度] 保存失败:', error);
    }
  }, [fileId, isAuthenticated, user?.id]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      fetchSentences();

      return () => {
        isMountedRef.current = false;
        stopPlayback();
        // 退出时保存当前进度
        if (currentIndex > 0) {
          saveProgress(currentIndex);
        }
      };
    }, [fetchSentences, currentIndex, saveProgress])
  );

  // 提取单词和标点
  const extractWords = useCallback((text: string) => {
    const result: { word: string; displayText: string; isPunctuation: boolean }[] = [];
    
    // 先将文本中的各种引号和破折号统一为标准格式
    // 使用更宽松的匹配：任何看起来像引号的字符都替换
    const normalizedText = text
      .replace(/[^\w\s.,!?;:(){}\-]/g, (char) => {
        // 如果是字母、数字、空格、标点，保留
        // 如果是引号类字符（各种单引号、双引号变体），替换
        if (/['"″′‵ʹʻʼʽ＇`´]/.test(char)) return "'";
        if (/["″‶]/.test(char)) return '"';
        if (/[—–−]/.test(char)) return '-';
        return char;
      });
    
    // 使用正则分割：保留单词（包括内部的 - ' &）和纯标点符号
    const tokens = normalizedText.match(/[a-z0-9'\-&]+|[,.!?;:()"]/gi) || [];

    tokens.forEach((token) => {
      // 判断是否为纯标点符号（不包含字母数字、-'&）
      const isPurePunctuation = !/[a-z0-9]/i.test(token);
      
      result.push({
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
        try {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        } catch (e) {
          console.log('[playAudio] 恢复播放失败:', e);
        }
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
      
      // 提前 30ms 停止，确保不会播放超出时间轴的内容
      const stopThreshold = endMs - 30;

      console.log(`[playAudio] 播放片段: ${startMs}ms - ${endMs}ms (停止阈值: ${stopThreshold}ms)`);

      const { sound } = await Audio.Sound.createAsync(
        { uri: file.original_audio_signed_url },
        {
          shouldPlay: false, // 先不播放，设置位置后再播放
          isLooping: false,
          volume: volumeRef.current,
          rate: playbackRateRef.current,
          shouldCorrectPitch: true,
        },
        (status) => {
          if (status.isLoaded) {
            // 检查是否到达结束时间（使用提前阈值）
            if (status.positionMillis >= stopThreshold) {
              sound.pauseAsync().catch(() => void 0);
              setIsPlaying(false);

              // 循环播放
              if (isLoopingRef.current && isMountedRef.current) {
                setTimeout(() => {
                  if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                    soundRef.current.setPositionAsync(startMs).catch(() => void 0);
                    soundRef.current.playAsync().catch(() => void 0);
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
      
      // 设置起始位置后再播放
      try {
        await sound.setPositionAsync(startMs);
        await sound.playAsync();
        setIsPlaying(true);
      } catch (seekError) {
        console.log('[playAudio] Seeking 失败:', seekError);
        // 尝试直接播放
        try {
          await sound.playAsync();
          setIsPlaying(true);
        } catch (playError) {
          console.log('[playAudio] 播放失败:', playError);
        }
      }

      // 监听播放位置
      const checkInterval = setInterval(async () => {
        if (!soundRef.current) {
          clearInterval(checkInterval);
          return;
        }
        try {
          const s = await soundRef.current.getStatusAsync();
          if (s.isLoaded && s.positionMillis >= stopThreshold) {
            await sound.pauseAsync().catch(() => void 0);
            setIsPlaying(false);
            clearInterval(checkInterval);

            // 循环播放
            if (isLoopingRef.current && isMountedRef.current) {
              setTimeout(() => {
                if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                  soundRef.current.setPositionAsync(startMs).catch(() => void 0);
                  soundRef.current.playAsync().catch(() => void 0);
                  setIsPlaying(true);
                }
              }, 500);
            }
          }
        } catch (e) {
          clearInterval(checkInterval);
        }
      }, 30); // 缩短检查间隔到 30ms

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

    // 重置句子积分
    currentSentencePointsRef.current = 0;

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
      // 批量获取翻译
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

  // 减少错题次数（错题练习模式下调用）
  const reduceErrorCount = useCallback(async (word: string) => {
    if (!isAuthenticated || !user?.id || !fileId || !errorPriority) return;
    
    try {
      /**
       * 服务端文件：server/src/routes/error-words.ts
       * 接口：POST /api/v1/error-words/reduce
       * Body 参数：user_id: string, sentence_file_id: number, sentence_index: number, word: string
       */
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/reduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sentence_file_id: fileId,
          sentence_index: currentIndex,
          word: word.toLowerCase(),
        }),
      });
      console.log(`[错题练习] 已减少 "${word}" 的错误次数`);
    } catch (error) {
      console.error('[错题练习] 减少错误次数失败:', error);
    }
  }, [isAuthenticated, user?.id, fileId, errorPriority, currentIndex]);

  // 记录积分
  const recordScore = useCallback(async (score: number) => {
    if (!isAuthenticated || !user?.id || !fileId) return;
    
    try {
      /**
       * 服务端文件：server/src/routes/learning.ts
       * 接口：POST /api/v1/learning-records/progress/:fileId
       * Body 参数：user_id: string, sentence_index: number, score: number
       */
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/progress/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sentence_index: currentIndex,
          score: score,
        }),
      });
    } catch (error) {
      console.error('[积分] 记录积分失败:', error);
    }
  }, [isAuthenticated, user?.id, fileId, currentIndex]);

  // 处理单词正确输入（统一处理减少错题次数和记录积分）
  const handleWordCorrect = useCallback((word: string) => {
    // 错题练习模式：减少错题次数 + 记录1.5积分
    // 普通模式：记录1积分
    const score = errorPriority ? 1.5 : 1;
    
    // 累积当前句子积分
    currentSentencePointsRef.current += score;
    
    reduceErrorCount(word);
    recordScore(score);
    
    // 薄弱词汇练习：追踪目标单词的正确次数
    if (targetWord && word.toLowerCase() === targetWord) {
      targetWordCorrectRef.current += 1;
      console.log(`[薄弱词汇练习] "${word}" 正确次数: ${targetWordCorrectRef.current}/${targetCorrectCount}`);
      
      // 检查是否达到目标，设置标记等句子完成后返回
      if (targetWordCorrectRef.current >= targetCorrectCount) {
        console.log(`[薄弱词汇练习] 目标单词 "${word}" 已完成，句子完成后自动返回`);
        shouldReturnAfterSentenceRef.current = true;
      }
    }
  }, [errorPriority, reduceErrorCount, recordScore, targetWord, targetCorrectCount]);

  // ==================== 自建键盘相关 ====================
  
  // 字符到按键的映射
  const charToKey: Record<string, string> = {
    'a': 'ABC', 'b': 'ABC', 'c': 'ABC',
    'd': 'DEF', 'e': 'DEF', 'f': 'DEF',
    'g': 'GHI', 'h': 'GHI', 'i': 'GHI',
    'j': 'JKL', 'k': 'JKL', 'l': 'JKL',
    'm': 'MNO', 'n': 'MNO', 'o': 'MNO',
    'p': 'PQRS', 'q': 'PQRS', 'r': 'PQRS', 's': 'PQRS',
    't': 'TUV', 'u': 'TUV', 'v': 'TUV',
    'w': 'WXYZ', 'x': 'WXYZ', 'y': 'WXYZ', 'z': 'WXYZ',
    '-': '-',
    '\'': '\'',
    '&': '&',
  };

  // 将单词转换为按键编码序列
  const wordToKeySequence = useCallback((word: string): string[] => {
    const sequence: string[] = [];
    const lowerWord = word.toLowerCase();
    
    for (const char of lowerWord) {
      // 处理引号类字符
      if (isSingleQuoteLike(char)) {
        sequence.push('\'');
      } else if (isDashLike(char)) {
        sequence.push('-');
      } else if (charToKey[char]) {
        sequence.push(charToKey[char]);
      }
    }
    
    return sequence;
  }, []);

  // 预计算所有未完成单词的按键编码
  const wordKeySequences = useMemo(() => {
    const sequences: { word: string; keySequence: string[]; index: number }[] = [];
    
    wordStatuses.forEach(ws => {
      if (!ws.isPunctuation && !ws.revealed) {
        sequences.push({
          word: ws.word,
          keySequence: wordToKeySequence(ws.word),
          index: ws.index,
        });
      }
    });
    
    return sequences;
  }, [wordStatuses, wordToKeySequence]);

  // 检测句子中是否有相似前缀的单词对（需要延迟确认）
  // 例如：i/I, to/today, a/an 等
  const hasAmbiguousPrefixes = useMemo(() => {
    if (wordKeySequences.length < 2) return false;
    
    // 检查是否存在一个单词的按键序列是另一个的前缀
    for (let i = 0; i < wordKeySequences.length; i++) {
      for (let j = i + 1; j < wordKeySequences.length; j++) {
        const seq1 = wordKeySequences[i].keySequence;
        const seq2 = wordKeySequences[j].keySequence;
        
        // 检查是否一个是另一个的前缀
        const shorter = seq1.length < seq2.length ? seq1 : seq2;
        const longer = seq1.length < seq2.length ? seq2 : seq1;
        
        if (shorter.length < longer.length) {
          const isPrefix = shorter.every((k, idx) => k === longer[idx]);
          if (isPrefix) {
            return true; // 找到相似前缀对
          }
        }
      }
    }
    return false;
  }, [wordKeySequences]);

  // 检测输入是否可能匹配更长的单词（用于手机键盘/电脑键盘）
  const hasLongerPotentialMatch = useCallback((input: string) => {
    const lowerInput = input.toLowerCase();
    return wordKeySequences.some(item => 
      item.word.toLowerCase().startsWith(lowerInput) && item.word.length > input.length
    );
  }, [wordKeySequences]);

  // 处理长串句子匹配（用于语音识别输入的完整句子）
  const handleLongTextInput = useCallback((text: string) => {
    const currentWordStatuses = wordStatusesRef.current;
    
    // 获取未完成的单词列表
    const incompleteWords = currentWordStatuses.filter(w => !w.isPunctuation && !w.revealed);
    if (incompleteWords.length === 0) return;
    
    // 按位置排序
    incompleteWords.sort((a, b) => a.index - b.index);
    
    // 提取输入中的单词（去除标点，转小写）
    const inputWords = text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, '') // 保留字母、数字、空格、连字符、单引号
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    if (inputWords.length === 0) return;
    
    // 记录匹配成功的单词索引
    const matchedIndices: number[] = [];
    
    // 从第一个未完成的单词开始匹配
    let wordIndex = 0;
    for (const inputWord of inputWords) {
      // 从当前位置开始查找匹配
      while (wordIndex < incompleteWords.length) {
        const targetWord = incompleteWords[wordIndex];
        if (wordsMatch(targetWord.word, inputWord)) {
          matchedIndices.push(targetWord.index);
          wordIndex++;
          break;
        }
        wordIndex++;
      }
    }
    
    // 标记所有匹配成功的单词
    if (matchedIndices.length > 0) {
      updateWordStatusesWithRef(prev => prev.map(ws => {
        if (matchedIndices.includes(ws.index)) {
          return {
            ...ws,
            revealed: true,
            revealedChars: new Array(ws.word.length).fill(true),
            errorCharIndex: -1,
          };
        }
        return ws;
      }));
      
      // 对每个匹配成功的单词调用 handleWordCorrect
      matchedIndices.forEach(idx => {
        const ws = incompleteWords.find(w => w.index === idx);
        if (ws) {
          handleWordCorrect(ws.word);
        }
      });
      
      console.log(`[语音匹配] 成功匹配 ${matchedIndices.length} 个单词`);
    }
  }, [updateWordStatusesWithRef, handleWordCorrect]);

  // 处理手机键盘/电脑键盘输入
  const handleInputChange = useCallback((text: string) => {
    const currentWordStatuses = wordStatusesRef.current;

    // 检测是否输入了空格或回车（用户确认单词）
    const lastChar = text[text.length - 1];
    const isConfirmChar = lastChar === ' ' || lastChar === '\n';
    
    // 提取实际单词内容（去掉末尾的空格/回车）
    const actualInput = isConfirmChar ? text.slice(0, -1) : text;

    // 空输入时重置
    if (actualInput.length === 0) {
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

    // 检测是否是多单词输入（包含空格）
    const wordsInInput = actualInput.split(/\s+/).filter(w => w.length > 0);
    if (wordsInInput.length > 1) {
      // 多单词输入，使用长文本匹配逻辑
      handleLongTextInput(actualInput);
      setCurrentInput('');
      setCurrentKeySequence([]);
      setTargetWordIndexWithRef(null);
      return;
    }

    // 如果用户按了空格/回车，强制匹配当前输入
    if (isConfirmChar) {
      // 取消待确认的定时器
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      
      const matchedWord = incompleteWords.find(w => wordsMatch(w.word, actualInput));
      
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
        // 处理单词正确（减少错题次数 + 记录积分）
        handleWordCorrect(matchedWord.word);
      }
      // 无论匹配成功与否，都清空输入框和按键序列
      setCurrentInput('');
      setCurrentKeySequence([]);
      setTargetWordIndexWithRef(null);
      return;
    }

    // 正常输入流程：检查是否完全匹配某个单词
    // 位置优先：找到第一个匹配的单词
    const matchedWord = incompleteWords
      .sort((a, b) => a.index - b.index)
      .find(w => wordsMatch(w.word, actualInput));

    if (matchedWord) {
      // 检查是否有更长的可能匹配
      const hasLonger = hasLongerPotentialMatch(actualInput);
      
      // 只有在句子中有相似前缀且有更长匹配时才延迟确认
      if (hasAmbiguousPrefixes && hasLonger) {
        // 显示匹配的单词，但延迟确认
        setCurrentInput(actualInput);
        setTargetWordIndexWithRef(matchedWord.index);
        
        // 取消之前的定时器
        if (confirmTimerRef.current) {
          clearTimeout(confirmTimerRef.current);
        }
        
        // 延迟确认
        confirmTimerRef.current = setTimeout(() => {
          handleInputChange(actualInput + ' '); // 用空格触发确认
          confirmTimerRef.current = null;
        }, 250);
      } else {
        // 没有相似前缀或没有更长匹配，立即确认
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
        // 处理单词正确（减少错题次数 + 记录积分）
        handleWordCorrect(matchedWord.word);
        setCurrentInput('');
        setCurrentKeySequence([]);
        setTargetWordIndexWithRef(null);
      }
      return;
    }

    // 输入过程中只保留用户输入
    setCurrentInput(text);
    setTargetWordIndexWithRef(null);
  }, [updateWordStatusesWithRef, setTargetWordIndexWithRef, hasAmbiguousPrefixes, hasLongerPotentialMatch, handleLongTextInput, handleWordCorrect]);

  // 当前按键序列
  const [currentKeySequence, setCurrentKeySequence] = useState<string[]>([]);

  // 处理自建键盘按键
  const handleCustomKeyPress = useCallback((key: string, keyLetters: string) => {
    if (key === '⌫') {
      // 删除时，取消待确认的定时器
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setCurrentInput(prev => prev.slice(0, -1));
      setCurrentKeySequence(prev => prev.slice(0, -1));
      return;
    }
    
    if (key === '清空') {
      // 清空时，取消待确认的定时器
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setCurrentInput('');
      setCurrentKeySequence([]);
      setTargetWordIndexWithRef(null);
      return;
    }
    
    if (key === '空格') {
      // 空格键：立即确认当前输入
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      if (currentInput.length > 0) {
        handleInputChange(currentInput);
        setCurrentInput('');
        setCurrentKeySequence([]);
        setTargetWordIndexWithRef(null);
      }
      return;
    }
    
    // 取消之前的延迟确认定时器（用户继续输入）
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    
    // 添加按键到序列
    const pressedKey = ['-', '\'', '&'].includes(key) ? key : keyLetters;
    
    setCurrentKeySequence(prev => {
      const newSequence = [...prev, pressedKey];
      
      // 1. 找到所有匹配的单词（按键序列前缀匹配）
      const matched = wordKeySequences.filter(item => {
        const targetSeq = item.keySequence;
        if (newSequence.length > targetSeq.length) return false;
        return newSequence.every((k, i) => k === targetSeq[i]);
      });
      
      if (matched.length === 0) {
        // 没有匹配，不更新序列
        return prev;
      }
      
      // 2. 检查是否有完全匹配
      const exactMatches = matched.filter(item => item.keySequence.length === newSequence.length);
      
      // 3. 检查是否有更长的前缀匹配（说明可能有更长的单词）
      const hasLongerMatch = matched.some(item => item.keySequence.length > newSequence.length);
      
      // 4. 按位置排序：优先选择位置靠前的单词
      matched.sort((a, b) => a.index - b.index);
      
      if (exactMatches.length > 0 && !hasLongerMatch) {
        // 有完全匹配，且没有更长的前缀匹配 → 可以确认
        // 最长匹配优先：在完全匹配中选择单词最长的那个
        exactMatches.sort((a, b) => b.word.length - a.word.length);
        const word = exactMatches[0];
        setCurrentInput(word.word);
        setTargetWordIndexWithRef(word.index);
        
        // 只有在句子中有相似前缀的情况下才延迟确认
        if (hasAmbiguousPrefixes) {
          confirmTimerRef.current = setTimeout(() => {
            handleInputChange(word.word);
            setCurrentInput('');
            setCurrentKeySequence([]);
            setTargetWordIndexWithRef(null);
            confirmTimerRef.current = null;
          }, 250);
        } else {
          // 没有相似前缀，立即确认
          handleInputChange(word.word);
          setCurrentInput('');
          setCurrentKeySequence([]);
          setTargetWordIndexWithRef(null);
        }
        
        return newSequence;
      }
      
      // 有完全匹配但也有更长的前缀匹配，或者只有前缀匹配
      // 显示第一个匹配单词的前缀（按位置优先）
      const firstMatch = matched[0];
      const wordChars = firstMatch.word.slice(0, newSequence.length);
      setCurrentInput(wordChars);
      setTargetWordIndexWithRef(firstMatch.index);
      return newSequence;
    });
  }, [wordKeySequences, handleInputChange, setTargetWordIndexWithRef, currentInput, hasAmbiguousPrefixes]);

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
    
    // 保存学习进度（当前句子已完成，准备进入下一句）
    saveProgress(currentIndex);

    // 重置累积积分（积分已在后台记录，无需显示）
    currentSentencePointsRef.current = 0;

    // 检查是否需要在句子完成后返回薄弱词汇页面
    if (shouldReturnAfterSentenceRef.current) {
      // 获取翻译并显示后返回
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
          router.back();
        }, 1000);
      } catch (e) {
        console.error('获取翻译失败:', e);
        router.back();
      }
      return;
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
  }, [currentSentence, pauseAudio, currentIndex, saveProgress, router]);

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
      
      // 记录错题：用户查看提示说明不知道这个单词
      if (isAuthenticated && user?.id && fileId && currentSentence) {
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            sentence_file_id: fileId,
            sentence_index: currentSentence.sentence_index,
            word: ws.word,
            sentence_text: currentSentence.text,
          }),
        }).catch(e => console.log('记录错题失败:', e));
      }
    }
  }, [wordTranslations, isAuthenticated, user?.id, fileId, currentSentence]);

  // 跳转到上一句
  const goToPrevSentence = useCallback(() => {
    if (currentIndex > 0) {
      stopPlayback();
      currentSentencePointsRef.current = 0; // 重置句子积分
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, stopPlayback]);

  // 跳转到下一句
  const goToNextSentence = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      stopPlayback();
      currentSentencePointsRef.current = 0; // 重置句子积分
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
          {/* 编辑此句按钮 */}
          <TouchableOpacity
            style={styles.smallControlBtn}
            onPress={() => {
              stopPlayback();
              router.push('/edit-sentence-audio', { 
                fileId: fileId, 
                sentenceIndex: currentIndex 
              });
            }}
          >
            <FontAwesome6 name="pencil" size={14} color={theme.textMuted} />
          </TouchableOpacity>
          {/* 键盘切换按钮 */}
          <TouchableOpacity
            style={[styles.smallControlBtn, keyboardType === 'custom' && styles.smallControlBtnActive]}
            onPress={() => setKeyboardType(prev => prev === 'system' ? 'custom' : 'system')}
          >
            <FontAwesome6 name={keyboardType === 'custom' ? "keyboard" : "mobile-screen"} size={14} color={keyboardType === 'custom' ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
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
                <TouchableOpacity 
                  key={idx} 
                  style={styles.wordWrapper}
                  onPress={() => handleWordPress(ws)}
                  activeOpacity={0.7}
                >
                  {ws.isPunctuation ? (
                    <ThemedText variant="h4" color={theme.textPrimary}>
                      {ws.displayText}
                    </ThemedText>
                  ) : (
                    <View style={styles.wordBox}>
                      <View style={styles.wordRow}>
                        {ws.displayText.split('').map((char, charIdx) => {
                          // 判断显示内容
                          let displayChar = char;
                          if (!ws.revealed) {
                            if (hintWordIndex === ws.index) {
                              // 提示模式：显示完整单词
                              displayChar = char;
                            } else {
                              // 正常模式：显示下划线
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
                                  : theme.textMuted
                              }
                              style={[
                                styles.char,
                                !ws.revealed && hintWordIndex !== ws.index && styles.hiddenChar,
                              ]}
                            >
                              {displayChar}
                            </ThemedText>
                          );
                        })}
                      </View>
                      {/* 已完成单词显示翻译 */}
                      {ws.revealed && translationWordIndex === ws.index && (
                        <ThemedText 
                          variant="caption" 
                          color={theme.textSecondary}
                          style={styles.translationText}
                        >
                          {wordTranslations[ws.word] || '...'}
                        </ThemedText>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
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
          {/* 手机键盘模式 */}
          {keyboardType === 'system' && (
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={currentInput}
                onChangeText={handleInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                blurOnSubmit={false}
                textContentType="none"
                autoComplete="off"
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
          )}

          {/* 自建键盘模式 */}
          {keyboardType === 'custom' && (
            <View style={styles.customKeyboardContainer}>
              {/* 当前输入显示 + 导航按钮 */}
              <View style={styles.customInputRow}>
                <TouchableOpacity
                  style={[styles.navBtnSmall, currentIndex === 0 && styles.navBtnDisabled]}
                  onPress={goToPrevSentence}
                  disabled={currentIndex === 0}
                >
                  <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
                </TouchableOpacity>
                
                <View style={styles.customInputDisplay}>
                  {currentInput ? (
                    <ThemedText variant="h4" color={theme.success}>
                      {currentInput}
                    </ThemedText>
                  ) : null}
                </View>
                
                <TouchableOpacity
                  style={[styles.navBtnSmall, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
                  onPress={goToNextSentence}
                  disabled={currentIndex === sentences.length - 1}
                >
                  <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? theme.textMuted : theme.primary} />
                </TouchableOpacity>
              </View>
              
              {/* 候选词列表 */}
              {/* 自建键盘 */}
              <View style={styles.customKeyboard}>
                {/* 第一列：特殊符号 - 3行均匀分布 */}
                <View style={styles.keyboardColumn}>
                  {/* 连接符 */}
                  <TouchableOpacity
                    style={[styles.keyButton, styles.symbolKey]}
                    onPress={() => handleCustomKeyPress('-', '-')}
                  >
                    <ThemedText variant="h4" color={theme.textPrimary}>-</ThemedText>
                  </TouchableOpacity>
                  {/* 单引号 */}
                  <TouchableOpacity
                    style={[styles.keyButton, styles.symbolKey]}
                    onPress={() => handleCustomKeyPress('\'', '\'')}
                  >
                    <ThemedText variant="h4" color={theme.textPrimary}>&apos;</ThemedText>
                  </TouchableOpacity>
                  {/* &符号 */}
                  <TouchableOpacity
                    style={[styles.keyButton, styles.symbolKey]}
                    onPress={() => handleCustomKeyPress('&', '&')}
                  >
                    <ThemedText variant="h4" color={theme.textPrimary}>&amp;</ThemedText>
                  </TouchableOpacity>
                </View>

                {/* 第二到第四列：字母 - 3行均匀分布 */}
                <View style={styles.keyboardLetterSection}>
                  {/* 第一行 */}
                  <View style={styles.keyboardRow}>
                    <TouchableOpacity
                      style={[styles.keyButton, styles.letterKey, showNumberPanel && styles.numberKeyActive]}
                      onPress={() => setShowNumberPanel(!showNumberPanel)}
                    >
                      <ThemedText variant="body" color={showNumberPanel ? theme.primary : theme.textMuted}>数字</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.keyButton, styles.letterKey]}
                      onPress={() => handleCustomKeyPress('ABC', 'ABC')}
                    >
                      <ThemedText variant="h4" color={theme.textPrimary}>ABC</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.keyButton, styles.letterKey]}
                      onPress={() => handleCustomKeyPress('DEF', 'DEF')}
                    >
                      <ThemedText variant="h4" color={theme.textPrimary}>DEF</ThemedText>
                    </TouchableOpacity>
                  </View>
                  
                  {/* 第二行 - 字母或数字 */}
                  {showNumberPanel ? (
                    <View style={styles.keyboardRow}>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[styles.keyButton, styles.letterKey]}
                          onPress={() => {
                            // 取消之前的延迟确认定时器
                            if (confirmTimerRef.current) {
                              clearTimeout(confirmTimerRef.current);
                              confirmTimerRef.current = null;
                            }
                            // 直接输入数字
                            const newInput = currentInput + num.toString();
                            setCurrentInput(newInput);
                            // 位置优先：找到第一个匹配的单词（按位置排序）
                            const allMatches = wordStatuses.filter(ws => 
                              !ws.isPunctuation && !ws.revealed && ws.word.toLowerCase() === newInput.toLowerCase()
                            );
                            if (allMatches.length > 0) {
                              // 按位置排序，选择最靠前的
                              const matched = allMatches.sort((a, b) => a.index - b.index)[0];
                              setTargetWordIndexWithRef(matched.index);
                              // 延迟确认
                              confirmTimerRef.current = setTimeout(() => {
                                handleInputChange(newInput);
                                setCurrentInput('');
                                setCurrentKeySequence([]);
                                setTargetWordIndexWithRef(null);
                                setShowNumberPanel(false);
                                confirmTimerRef.current = null;
                              }, 500);
                            }
                          }}
                        >
                          <ThemedText variant="h4" color={theme.textPrimary}>{num}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.keyboardRow}>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('GHI', 'GHI')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>GHI</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('JKL', 'JKL')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>JKL</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('MNO', 'MNO')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>MNO</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* 第三行 - 数字或字母 */}
                  {showNumberPanel ? (
                    <View style={styles.keyboardRow}>
                      {[6, 7, 8, 9, 0].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[styles.keyButton, styles.letterKey]}
                          onPress={() => {
                            // 取消之前的延迟确认定时器
                            if (confirmTimerRef.current) {
                              clearTimeout(confirmTimerRef.current);
                              confirmTimerRef.current = null;
                            }
                            // 直接输入数字
                            const newInput = currentInput + num.toString();
                            setCurrentInput(newInput);
                            // 位置优先：找到第一个匹配的单词（按位置排序）
                            const allMatches = wordStatuses.filter(ws => 
                              !ws.isPunctuation && !ws.revealed && ws.word.toLowerCase() === newInput.toLowerCase()
                            );
                            if (allMatches.length > 0) {
                              // 按位置排序，选择最靠前的
                              const matched = allMatches.sort((a, b) => a.index - b.index)[0];
                              setTargetWordIndexWithRef(matched.index);
                              // 延迟确认
                              confirmTimerRef.current = setTimeout(() => {
                                handleInputChange(newInput);
                                setCurrentInput('');
                                setCurrentKeySequence([]);
                                setTargetWordIndexWithRef(null);
                                setShowNumberPanel(false);
                                confirmTimerRef.current = null;
                              }, 500);
                            }
                          }}
                        >
                          <ThemedText variant="h4" color={theme.textPrimary}>{num}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.keyboardRow}>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('PQRS', 'PQRS')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>PQRS</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('TUV', 'TUV')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>TUV</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('WXYZ', 'WXYZ')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>WXYZ</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 第五列：功能键 - 3行均匀分布 */}
                <View style={styles.keyboardColumn}>
                  <TouchableOpacity
                    style={[styles.keyButton, styles.functionKey]}
                    onPress={() => handleCustomKeyPress('⌫', '')}
                  >
                    <FontAwesome6 name="delete-left" size={22} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.keyButton, styles.functionKey]}
                    onPress={() => handleCustomKeyPress('清空', '')}
                  >
                    <ThemedText variant="body" color={theme.textPrimary}>清空</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.keyButton, styles.functionKey]}
                    onPress={() => handleCustomKeyPress('空格', '')}
                  >
                    <ThemedText variant="body" color={theme.textPrimary}>空格</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* 手机键盘模式的导航按钮 */}
          {keyboardType === 'system' && (
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
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
