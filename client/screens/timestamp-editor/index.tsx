import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TimeControl } from '@/components/TimeControl';
import { Audio } from 'expo-av';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Sentence {
  id: number;
  text: string;
  start_time: number;
  end_time: number;
}

interface WordTimestamp {
  word: string;
  start_time: number;
  end_time: number;
}

export default function TimestampEditorScreen() {
  const { theme } = useTheme();
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ materialId: number; title: string }>();
  
  const materialId = params.materialId;
  
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  const currentSentence = sentences[currentIndex];

  // 调用后端API自动匹配所有句子的时间戳
  const autoMatchAllSentences = useCallback(async (sentencesData: Sentence[], materialIdNum: number) => {
    setMatching(true);
    console.log('开始自动匹配所有句子...');
    
    try {
      // 批量调用后端匹配API
      const matchedSentences = await Promise.all(
        sentencesData.map(async (sentence) => {
          try {
            const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialIdNum}/match-sentence`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sentenceText: sentence.text }),
            });
            const data = await res.json();
            
            if (data.matched) {
              console.log(`句子 "${sentence.text.substring(0, 20)}..." 匹配成功: ${data.start_time}ms - ${data.end_time}ms`);
              return {
                ...sentence,
                start_time: data.start_time,
                end_time: data.end_time,
              };
            } else {
              console.log(`句子 "${sentence.text.substring(0, 20)}..." 未匹配到`);
              return sentence;
            }
          } catch (e) {
            console.log(`匹配句子失败:`, e);
            return sentence;
          }
        })
      );
      
      setSentences(matchedSentences);
      console.log('自动匹配完成！');
    } catch (error) {
      console.error('批量匹配失败:', error);
    } finally {
      setMatching(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      // 首先尝试自动准备时间轴数据
      const prepareRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/prepare-timestamps`, {
        method: 'POST',
      });
      const prepareData = await prepareRes.json();
      
      if (prepareData.sentences && prepareData.sentences.length > 0) {
        setSentences(prepareData.sentences);
        if (prepareData.wasProcessed) {
          console.log('自动处理完成:', prepareData.message);
        }
      }
      
      // 获取材料详情
      const materialRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const materialData = await materialRes.json();
      
      if (materialData.material) {
        setAudioUrl(materialData.material.audio_url || '');
        setDuration(materialData.material.duration || 0);
      }
      
      // 获取单词时间戳
      try {
        const wordsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/word-timestamps`, {
          method: 'POST',
        });
        const wordsJson = await wordsRes.json();
        if (wordsJson.words && wordsJson.words.length > 0) {
          setWordTimestamps(wordsJson.words);
          if (wordsJson.duration) {
            setDuration(wordsJson.duration);
          }
        }
      } catch (e) {
        console.log('未获取到单词时间戳');
      }
      
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchData();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [fetchData]);

  const loadAudio = async () => {
    if (!audioUrl) return null;
    
    try {
      // 先确保音频模式正确（从扬声器播放，而非听筒）
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1, // DoNotMix
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // DoNotMix
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch (e) {
        console.log('设置音频模式失败:', e);
      }
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      
      if (status.isLoaded) {
        const realDuration = status.durationMillis || 0;
        setDuration(realDuration);
        return realDuration;
      }
      return null;
    } catch (error) {
      console.error('加载音频失败:', error);
      return null;
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded && status.didJustFinish) {
      setIsPlaying(false);
    }
  };

  // 停止播放
  const handleStopPlaying = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
        }
      }
      setIsPlaying(false);
    } catch (e) {
      console.log('停止播放失败:', e);
      setIsPlaying(false);
    }
  }, []);

  // 播放完整句子（点击播放按钮时触发）
  const playFullSentence = async () => {
    console.log('[playFullSentence] 开始执行');
    console.log('[playFullSentence] currentSentence:', currentSentence?.text);
    console.log('[playFullSentence] start_time:', currentSentence?.start_time);
    console.log('[playFullSentence] end_time:', currentSentence?.end_time);
    console.log('[playFullSentence] audioUrl:', audioUrl);
    
    // 加载音频
    if (!soundRef.current) {
      console.log('[playFullSentence] 音频未加载，开始加载...');
      const loadedDuration = await loadAudio();
      if (!loadedDuration) {
        console.log('[playFullSentence] 音频加载失败');
        return;
      }
      console.log('[playFullSentence] 音频加载成功，时长:', loadedDuration);
    }
    
    if (!soundRef.current || !currentSentence) {
      console.log('[playFullSentence] 检查失败: soundRef=', !!soundRef.current, 'currentSentence=', !!currentSentence);
      return;
    }
    
    // 先停止之前的播放
    await handleStopPlaying();
    
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      console.log('[playFullSentence] 音频状态检查失败: 未加载');
      return;
    }
    
    const actualDuration = status.durationMillis || 0;
    let start = currentSentence.start_time;
    let end = currentSentence.end_time;
    
    console.log('[playFullSentence] 音频实际时长:', actualDuration, 'ms');
    console.log('[playFullSentence] 句子时间范围:', start, '-', end, 'ms');
    
    // 确保时间戳在有效范围内
    start = Math.max(0, Math.min(start, actualDuration - 100));
    end = Math.max(start + 100, Math.min(end, actualDuration));
    
    if (end <= start) {
      console.log('[playFullSentence] 时间戳无效: end <= start');
      return;
    }
    
    console.log('[playFullSentence] 开始播放: start=', start, 'end=', end, '时长=', end - start, 'ms');
    
    try {
      await soundRef.current.setPositionAsync(start);
      await soundRef.current.playAsync();
      setIsPlaying(true);
      console.log('[playFullSentence] 播放已启动');
    } catch (e) {
      console.error('[playFullSentence] 播放失败:', e);
      return;
    }
    
    const checkInterval = setInterval(async () => {
      if (!soundRef.current) {
        clearInterval(checkInterval);
        return;
      }
      const s = await soundRef.current.getStatusAsync();
      if (s.isLoaded && s.positionMillis >= end) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        clearInterval(checkInterval);
        console.log('[playFullSentence] 播放结束');
      }
    }, 50);
  };

  // 播放从结束时间前一小段到结束时间（按住结束时间按钮时触发）
  // 播放单个单词
  const playWord = async (word: WordTimestamp) => {
    // 加载音频
    if (!soundRef.current) {
      const loadedDuration = await loadAudio();
      if (!loadedDuration) {
        console.log('音频加载失败');
        return;
      }
    }
    
    if (!soundRef.current) return;
    
    // 检查音频是否已加载
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      console.log('音频未加载');
      return;
    }
    
    await handleStopPlaying();
    
    await soundRef.current.setPositionAsync(word.start_time);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    const checkInterval = setInterval(async () => {
      if (!soundRef.current) {
        clearInterval(checkInterval);
        return;
      }
      const s = await soundRef.current.getStatusAsync();
      if (s.isLoaded && s.positionMillis >= word.end_time) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        clearInterval(checkInterval);
      }
    }, 50);
  };

  // 调整句子开始时间（选择一个单词作为开始）
  const setStartFromWord = (word: WordTimestamp) => {
    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: word.start_time,
    };
    setSentences(newSentences);
  };

  // 调整句子结束时间（选择一个单词作为结束）
  const setEndFromWord = (word: WordTimestamp) => {
    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      end_time: word.end_time,
    };
    setSentences(newSentences);
  };

  // 手动重新匹配当前句子
  const rematchCurrentSentence = async () => {
    if (!currentSentence || !materialId) return;
    
    try {
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/match-sentence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentenceText: currentSentence.text }),
      });
      const data = await res.json();
      
      if (data.matched) {
        const newSentences = [...sentences];
        newSentences[currentIndex] = {
          ...newSentences[currentIndex],
          start_time: data.start_time,
          end_time: data.end_time,
        };
        setSentences(newSentences);
        Alert.alert('成功', `重新匹配成功: ${data.start_time}ms - ${data.end_time}ms`);
      } else {
        Alert.alert('提示', '未能匹配到该句子的时间戳');
      }
    } catch (e) {
      Alert.alert('错误', '重新匹配失败');
    }
  };

  // 确认并跳转下一句，同时自动调整下一句的开始时间
  const confirmAndNext = () => {
    if (currentIndex < sentences.length - 1) {
      // 自动调整下一句的开始时间：往前移1-2秒，避免累积误差
      const nextIndex = currentIndex + 1;
      const currentEnd = currentSentence?.end_time || 0;
      const nextStart = sentences[nextIndex].start_time;
      
      // 如果下一句的开始时间在当前句子结束之后，需要往前调整
      // 往前调整的时间 = 当前结束时间 + 100ms 到 下一句开始时间 - 500ms
      const adjustTime = 1500; // 往前移1.5秒
      let newNextStart = nextStart - adjustTime;
      
      // 确保不会早于当前句子的结束时间
      if (newNextStart <= currentEnd) {
        newNextStart = currentEnd + 100; // 当前结束后再加100ms
      }
      
      // 更新下一句的开始时间
      const newSentences = [...sentences];
      newSentences[nextIndex] = {
        ...newSentences[nextIndex],
        start_time: Math.max(0, newNextStart),
      };
      setSentences(newSentences);
      
      console.log(`自动调整第 ${nextIndex + 1} 句开始时间: ${nextStart}ms -> ${newNextStart}ms`);
      
      setCurrentIndex(nextIndex);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的时间轴设置！' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const sentence of sentences) {
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${sentence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: sentence.start_time,
            end_time: sentence.end_time,
          }),
        });
      }
      setDialog({ visible: true, message: '保存成功！', onConfirm: () => router.back() });
    } catch (error) {
      setDialog({ visible: true, message: `保存失败: ${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor((totalSeconds % 1) * 100).toString().padStart(2, '0')}`;
  };

  // 删除当前句子
  const handleDeleteSentence = useCallback(async () => {
    if (!currentSentence || !materialId) return;
    
    Alert.alert(
      '确认删除',
      `确定要删除这句话吗？\n\n"${currentSentence.text.substring(0, 50)}${currentSentence.text.length > 50 ? '...' : ''}"`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${currentSentence.id}`, {
                method: 'DELETE',
              });
              
              const data = await res.json();
              
              if (data.success) {
                // 从本地列表中移除
                const newSentences = sentences.filter((_, idx) => idx !== currentIndex);
                setSentences(newSentences);
                
                // 调整当前索引
                if (currentIndex >= newSentences.length) {
                  setCurrentIndex(Math.max(0, newSentences.length - 1));
                }
                
                Alert.alert('成功', '句子已删除');
              } else {
                Alert.alert('错误', '删除失败');
              }
            } catch (e) {
              Alert.alert('错误', `删除失败: ${(e as Error).message}`);
            }
          },
        },
      ]
    );
  }, [currentSentence, materialId, sentences, currentIndex]);

  // 获取当前句子范围内的单词
  const getSentenceWords = useCallback(() => {
    if (!currentSentence || wordTimestamps.length === 0) return [];
    
    const start = Math.min(currentSentence.start_time, currentSentence.end_time);
    const end = Math.max(currentSentence.start_time, currentSentence.end_time);
    
    return wordTimestamps.filter(w => w.start_time >= start && w.end_time <= end);
  }, [currentSentence, wordTimestamps]);

  // 计算当前句子之前的所有单词（用于调整开始时间）
  const getWordsBeforeSentence = useCallback(() => {
    if (!currentSentence || wordTimestamps.length === 0) return [];
    return wordTimestamps.filter(w => w.end_time < currentSentence.start_time).slice(-10);
  }, [currentSentence, wordTimestamps]);

  // 计算当前句子之后的所有单词（用于调整结束时间）
  const getWordsAfterSentence = useCallback(() => {
    if (!currentSentence || wordTimestamps.length === 0) return [];
    return wordTimestamps.filter(w => w.start_time > currentSentence.end_time).slice(0, 10);
  }, [currentSentence, wordTimestamps]);

  if (loading || matching) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={{ color: '#888', marginTop: 16 }}>
            {matching ? '正在自动匹配句子时间戳...' : '正在加载...'}
          </Text>
        </ThemedView>
      </Screen>
    );
  }

  if (sentences.length === 0) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <FontAwesome6 name="file-lines" size={48} color="#666" />
          <Text style={{ color: '#888', marginTop: 16 }}>没有句子</Text>
          <TouchableOpacity style={{ marginTop: 24, padding: 16, backgroundColor: '#00ff88', borderRadius: 8 }} onPress={() => router.back()}>
            <Text style={{ color: '#000', fontWeight: '600' }}>返回</Text>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  const sentenceWords = getSentenceWords();
  const wordsBefore = getWordsBeforeSentence();
  const wordsAfter = getWordsAfterSentence();
  const sentenceDuration = Math.abs(currentSentence?.end_time - currentSentence?.start_time) || 0;
  const hasValidTime = currentSentence && currentSentence.end_time > currentSentence.start_time;

  return (
    <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
      {/* 顶部状态栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>时间轴编辑</Text>
          <Text style={styles.headerInfo}>句子 {currentIndex + 1}/{sentences.length}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <FontAwesome6 name="xmark" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* 句子导航 */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
        >
          <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
        
        <View style={styles.sentenceBox}>
          <Text style={styles.sentenceText}>{currentSentence?.text}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.navBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
          onPress={() => currentIndex < sentences.length - 1 && setCurrentIndex(currentIndex + 1)}
        >
          <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
      </View>

      {/* 时间调整区域 - 核心上下布局 */}
      <View style={styles.dialSection}>
        {/* 开始时间 */}
        <TimeControl
          value={currentSentence?.start_time || 0}
          onChange={(delta) => {
            if (!currentSentence) return;
            const newSentences = [...sentences];
            newSentences[currentIndex] = {
              ...newSentences[currentIndex],
              start_time: Math.max(0, currentSentence.start_time + delta),
            };
            setSentences(newSentences);
          }}
          onPlay={playFullSentence}
          label="开始"
          color="#00ff88"
        />
        
        {/* 时长 */}
        <View style={styles.durationRow}>
          <View style={styles.durationDivider} />
          <View style={styles.durationBox}>
            <Text style={styles.durationLabel}>时长</Text>
            <Text style={styles.durationValue}>
              {hasValidTime ? formatTime(sentenceDuration) : '--:--'}
            </Text>
          </View>
          <View style={styles.durationDivider} />
        </View>
        
        {/* 结束时间 */}
        <TimeControl
          value={currentSentence?.end_time || 0}
          onChange={(delta) => {
            if (!currentSentence) return;
            const newSentences = [...sentences];
            newSentences[currentIndex] = {
              ...newSentences[currentIndex],
              end_time: Math.max((currentSentence.start_time || 0) + 10, currentSentence.end_time + delta),
            };
            setSentences(newSentences);
          }}
          onPlay={playFullSentence}
          label="结束"
          color="#ff8800"
        />
      </View>

      {/* 单词列表 - 仅在有单词时间戳数据时显示 */}
      {wordTimestamps.length > 0 && (
        <View style={styles.wordsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>句子中的单词（点击试听）</Text>
            {hasValidTime && (
              <TouchableOpacity onPress={rematchCurrentSentence}>
                <Text style={styles.rematchBtn}>重新匹配</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {!hasValidTime ? (
            <View style={styles.emptyState}>
              <FontAwesome6 name="clock" size={32} color="#444" />
              <Text style={styles.emptyText}>该句子尚未匹配时间戳</Text>
              <TouchableOpacity style={styles.matchBtn} onPress={rematchCurrentSentence}>
                <FontAwesome6 name="wand-magic-sparkles" size={16} color="#000" />
                <Text style={styles.matchBtnText}>自动匹配</Text>
              </TouchableOpacity>
            </View>
          ) : sentenceWords.length > 0 ? (
            <ScrollView horizontal style={styles.wordsList} contentContainerStyle={styles.wordsContent}>
              {sentenceWords.map((word, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.wordItem}
                  onPress={() => playWord(word)}
                >
                  <Text style={styles.wordText}>{word.word}</Text>
                  <Text style={styles.wordTime}>{formatTime(word.start_time)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noWords}>当前时间范围内没有单词，请调整时间</Text>
          )}
        </View>
      )}

      {/* 调整时间边界 - 仅在有单词时间戳数据时显示 */}
      {hasValidTime && wordTimestamps.length > 0 && (
        <View style={styles.adjustSection}>
          <Text style={styles.sectionTitle}>调整时间边界（点击单词调整）</Text>
          
          {/* 开始时间调整 */}
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>开始前移:</Text>
            <View style={{ flex: 1 }}>
              <ScrollView horizontal style={styles.adjustWordsList}>
                {wordsBefore.length > 0 ? (
                  wordsBefore.slice().reverse().map((word, idx) => (
                    <TouchableOpacity 
                      key={`before-${idx}`} 
                      style={styles.adjustWordBtn}
                      onPress={() => setStartFromWord(word)}
                    >
                      <Text style={styles.adjustWordText}>{word.word}</Text>
                      <Text style={styles.adjustWordTime}>{formatTime(word.start_time)}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noWordsHint}>没有更早的单词</Text>
                )}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>开始后移:</Text>
            <View style={{ flex: 1 }}>
              <ScrollView horizontal style={styles.adjustWordsList}>
                {wordsAfter.length > 0 ? (
                  wordsAfter.slice(0, 5).map((word, idx) => (
                    <TouchableOpacity 
                      key={`start-after-${idx}`} 
                      style={[styles.adjustWordBtn, styles.startAfterBtn]}
                      onPress={() => setStartFromWord(word)}
                    >
                      <Text style={styles.adjustWordText}>{word.word}</Text>
                      <Text style={styles.adjustWordTime}>{formatTime(word.start_time)}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noWordsHint}>没有更晚的单词</Text>
                )}
              </ScrollView>
            </View>
          </View>
          
          {/* 结束时间调整 */}
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>结束前移:</Text>
            <View style={{ flex: 1 }}>
              <ScrollView horizontal style={styles.adjustWordsList}>
                {wordsBefore.length > 0 ? (
                  wordsBefore.slice(-5).reverse().map((word, idx) => (
                    <TouchableOpacity 
                      key={`end-before-${idx}`} 
                      style={[styles.adjustWordBtn, styles.endBeforeBtn]}
                      onPress={() => setEndFromWord(word)}
                    >
                      <Text style={styles.adjustWordText}>{word.word}</Text>
                      <Text style={styles.adjustWordTime}>{formatTime(word.end_time)}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noWordsHint}>没有更早的单词</Text>
                )}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>结束延后:</Text>
            <View style={{ flex: 1 }}>
              <ScrollView horizontal style={styles.adjustWordsList}>
                {wordsAfter.length > 0 ? (
                  wordsAfter.map((word, idx) => (
                    <TouchableOpacity 
                      key={`after-${idx}`} 
                      style={styles.adjustWordBtn}
                      onPress={() => setEndFromWord(word)}
                    >
                      <Text style={styles.adjustWordText}>{word.word}</Text>
                      <Text style={styles.adjustWordTime}>{formatTime(word.end_time)}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noWordsHint}>没有更晚的单词</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      )}

      {/* 底部控制栏 */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSentence}>
          <FontAwesome6 name="trash" size={16} color="#ff4444" />
          <Text style={styles.deleteBtnText}>删除</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.stopBtn} onPress={handleStopPlaying}>
          <FontAwesome6 name="stop" size={16} color="#888" />
          <Text style={styles.stopBtnText}>停止</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndNext}>
          <FontAwesome6 name="check" size={16} color="#000" />
          <Text style={styles.confirmBtnText}>确认并下一句</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#00ff88" /> : <FontAwesome6 name="floppy-disk" size={16} color="#00ff88" />}
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={dialog.visible}
        title="提示"
        message={dialog.message}
        confirmText="确定"
        onConfirm={() => { setDialog({ visible: false, message: '' }); dialog.onConfirm?.(); }}
        onCancel={() => setDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerInfo: {
    color: '#00ff88',
    fontSize: 14,
  },
  closeBtn: {
    padding: 8,
  },
  
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  sentenceBox: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sentenceText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // 时间调整区域 - 上下布局
  dialSection: {
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  durationDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  durationBox: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  durationLabel: {
    color: '#666',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  durationValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  
  wordsSection: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
  },
  rematchBtn: {
    color: '#00ff88',
    fontSize: 12,
  },
  wordsList: {
    flex: 1,
  },
  wordsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  wordItem: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  wordText: {
    color: '#fff',
    fontSize: 14,
  },
  wordTime: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  noWords: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  matchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00ff88',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  matchBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  
  adjustSection: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 12,
    maxHeight: 280,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  adjustLabel: {
    color: '#666',
    fontSize: 11,
    width: 70,
  },
  adjustWordsList: {
    flex: 1,
  },
  adjustWordBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
    alignItems: 'center',
  },
  startAfterBtn: {
    backgroundColor: '#1a4d1a',
    borderColor: '#00ff88',
    borderWidth: 1,
  },
  endBeforeBtn: {
    backgroundColor: '#4d331a',
    borderColor: '#ff8800',
    borderWidth: 1,
  },
  adjustWordText: {
    color: '#fff',
    fontSize: 11,
  },
  adjustWordTime: {
    color: '#888',
    fontSize: 9,
    marginTop: 1,
  },
  noWordsHint: {
    color: '#444',
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#2a1a1a',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  deleteBtnText: {
    color: '#ff4444',
    fontSize: 13,
    fontWeight: '500',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  stopBtnText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  saveBtnText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '500',
  },
});
