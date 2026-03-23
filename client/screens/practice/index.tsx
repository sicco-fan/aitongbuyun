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
  word: string; // 纯单词（无标点）
  displayText: string; // 显示文本（包含标点，如 "hello," 或 "world!"）
  revealed: boolean; // 整个单词是否已完全显示
  revealedChars: boolean[]; // 每个字母是否已显示
  index: number;
  isPunctuation: boolean; // 是否是标点符号
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
  const [hintWordIndex, setHintWordIndex] = useState<number | null>(null); // 当前显示提示的单词索引
  
  // 音频控制状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [volume, setVolume] = useState(1.0);
  
  // 语音输入状态
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const [recordingCount, setRecordingCount] = useState(0); // 录音次数计数
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isLoopingRef = useRef(true);
  const sentenceTimesRef = useRef({ start: 0, end: 0 });
  const isRecordingRef = useRef(false); // 使用 ref 跟踪录音状态，避免闭包问题
  const inputRef = useRef<TextInput>(null); // 输入框引用

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
    if (currentSentence && material?.audio_url) {
      const tokens = extractWords(currentSentence.text);
      
      setWordStatuses(tokens.map((token, index) => ({
        word: token.word,
        displayText: token.displayText,
        revealed: token.isPunctuation, // 标点符号默认显示
        revealedChars: token.isPunctuation ? [] : new Array(token.word.length).fill(false),
        index,
        isPunctuation: token.isPunctuation,
      })));
      setCurrentInput('');
      setFeedback(null);
      setHintWordIndex(null);
      setPlayCount(0);
      
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
          if (status.isLoaded) {
            // 当播放到句子结束位置时，跳回开始位置继续播放
            if (status.positionMillis >= end && isLoopingRef.current) {
              soundRef.current?.setPositionAsync(start);
              setPlayCount(prev => prev + 1);
            }
            
            if (status.didJustFinish && !isLoopingRef.current) {
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
    isLoopingRef.current = false;
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {
        // 忽略错误
      }
      setIsPlaying(false);
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

  // 实时检查输入并更新字母显示
  const checkInputRealtime = useCallback((input: string) => {
    if (!input) return;
    
    const inputLower = input.toLowerCase();
    let matchedAny = false;
    
    setWordStatuses(prev => {
      const newStatuses = [...prev];
      
      // 遍历所有未完成的单词
      for (let wordIdx = 0; wordIdx < newStatuses.length; wordIdx++) {
        const ws = newStatuses[wordIdx];
        if (ws.isPunctuation || ws.revealed) continue;
        
        const wordLower = ws.word.toLowerCase();
        
        // 检查输入是否能匹配到这个单词的开头
        if (wordLower.startsWith(inputLower)) {
          matchedAny = true;
          
          // 更新已显示的字母
          const newRevealedChars = [...ws.revealedChars];
          for (let i = 0; i < inputLower.length && i < wordLower.length; i++) {
            newRevealedChars[i] = true;
          }
          newStatuses[wordIdx] = { ...ws, revealedChars: newRevealedChars };
          
          // 如果整个单词都输入了，标记为完成
          if (inputLower.length >= wordLower.length) {
            newStatuses[wordIdx] = { ...newStatuses[wordIdx], revealed: true };
          }
          break; // 只匹配第一个符合条件的单词
        }
      }
      
      return newStatuses;
    });
    
    return matchedAny;
  }, []);

  // 监听单词状态变化，自动跳转到下一句
  useEffect(() => {
    // 检查是否所有非标点单词都已答出
    const allWordsRevealed = wordStatuses.length > 0 && 
      wordStatuses.filter(w => !w.isPunctuation).every(w => w.revealed);
    
    if (allWordsRevealed && currentSentence && !completed) {
      // 延迟一下再跳转，让用户看到完成状态
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
          setCompleted(true);
        }
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [wordStatuses, currentSentence, currentIndex, sentences.length, totalAttempts, stopPlayback, completed]);

  // 处理输入变化 - 实时匹配
  const handleInputChange = (text: string) => {
    setCurrentInput(text);
    
    // 检测到空格时自动清空并继续
    if (text.includes(' ')) {
      setCurrentInput('');
      return;
    }
    
    // 实时检查输入
    if (text.length > 0) {
      checkInputRealtime(text);
    }
  };

  // 监听单词完成，自动清空输入框
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
      setCurrentInput('');
      setFeedbackWord(currentInput);
      setFeedback('correct');
      setTimeout(() => setFeedback(null), 300);
    }
  }, [wordStatuses, currentInput]);

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
      
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true 
      });
      
      setIsRecording(true);
      isRecordingRef.current = true; // 同步设置 ref
      setRecordingCount(0);
      
      // 开始第一段录音
      await startNewRecordingSegment();
      
    } catch (error) {
      console.error('录音失败:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
      resumePlayback();
    }
  };

  // 开始新的录音片段
  const startNewRecordingSegment = async () => {
    // 先清理之前的录音
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {
        // 忽略
      }
      recordingRef.current = null;
    }

    // 检查是否还在录音状态
    if (!isRecordingRef.current) return;

    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      
      // 500ms后自动识别并继续录音（快速响应）
      setTimeout(async () => {
        if (isRecordingRef.current) {
          await recognizeAndContinue();
        }
      }, 500);
      
    } catch (error) {
      console.error('录音片段失败:', error);
      // 出错后尝试继续录音
      if (isRecordingRef.current) {
        setTimeout(() => startNewRecordingSegment(), 100);
      }
    }
  };

  // 识别当前录音并继续
  const recognizeAndContinue = async () => {
    if (!recordingRef.current) {
      // 如果没有录音，直接开始新录音
      if (isRecordingRef.current) {
        await startNewRecordingSegment();
      }
      return;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecordingCount(prev => prev + 1);

      if (uri) {
        const formData = new FormData();
        const audioFile = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
        formData.append('file', audioFile as any);

        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech-recognize`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.text) {
          // 对于语音识别的结果，逐词匹配
          const words = data.text.split(/\s+/).filter((w: string) => w.length > 0);
          for (const word of words) {
            checkInputRealtime(word);
          }
        }
      }
      
      // 继续下一段录音（如果还在录音状态）
      if (isRecordingRef.current) {
        await startNewRecordingSegment();
      }
      
    } catch (error) {
      console.error('语音识别失败:', error);
      // 即使识别失败，也继续录音
      if (isRecordingRef.current) {
        await startNewRecordingSegment();
      }
    }
  };

  // 停止持续录音
  const stopContinuousRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false; // 同步设置 ref
    
    // 识别最后一段录音
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;

        if (uri) {
          const formData = new FormData();
          const audioFile = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
          formData.append('file', audioFile as any);

          const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech-recognize`, {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (data.text) {
            const words = data.text.split(/\s+/).filter((w: string) => w.length > 0);
            for (const word of words) {
              checkInputRealtime(word);
            }
          }
        }
      } catch (error) {
        console.error('最后识别失败:', error);
      }
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
      setCompleted(true);
    }
  };

  // 渲染单词显示（带字母进度）
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
    
    // 如果单词已完成或正在提示，显示完整单词
    if (ws.revealed) {
      return (
        <TouchableOpacity 
          key={idx} 
          style={[styles.wordSlot, styles.wordCorrect]}
          activeOpacity={0.7}
        >
          <Text style={{ color: theme.success, fontWeight: '600', fontSize: 16 }}>
            {ws.displayText}
          </Text>
        </TouchableOpacity>
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
        style={[styles.wordSlot, styles.wordHidden]}
        onPress={() => showHintForWord(idx)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {chars.map((char, charIdx) => (
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
          ))}
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
                  onPress={() => handleVolumeChange(Math.max(0, volume - 0.1))}
                >
                  <FontAwesome6 name="minus" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: Spacing.sm, backgroundColor: theme.backgroundTertiary, borderRadius: 8 }}
                  onPress={() => handleVolumeChange(Math.min(1, volume + 0.1))}
                >
                  <FontAwesome6 name="plus" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: Spacing.sm, backgroundColor: volume >= 0.9 ? theme.primary : theme.backgroundTertiary, borderRadius: 8 }}
                  onPress={() => handleVolumeChange(1.0)}
                >
                  <FontAwesome6 name="volume-high" size={14} color={volume >= 0.9 ? theme.buttonPrimaryText : theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            {isPlaying ? '循环播放当前句子中' : '已暂停'} · 已循环 {playCount} 次
          </ThemedText>
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
          {isRecording && (
            <ThemedText variant="caption" color={theme.primary} style={{ marginTop: 8, textAlign: 'center' }}>
              正在识别... 说对的单词会自动填入 · 已识别 {recordingCount} 次
            </ThemedText>
          )}
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
