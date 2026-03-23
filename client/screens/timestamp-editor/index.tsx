import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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

  // 根据句子文本匹配单词时间戳，找到开始和结束时间
  const matchSentenceToTimestamps = useCallback((sentenceText: string, words: WordTimestamp[]): { start: number; end: number } => {
    if (words.length === 0) {
      return { start: 0, end: 0 };
    }
    
    // 清理句子文本，提取单词
    const sentenceWords = sentenceText.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    
    if (sentenceWords.length === 0) {
      return { start: 0, end: 0 };
    }
    
    const firstWord = sentenceWords[0];
    const lastWord = sentenceWords[sentenceWords.length - 1];
    
    // 找第一个单词的时间戳
    let startTime = 0;
    for (let i = 0; i < words.length; i++) {
      const wordLower = words[i].word.toLowerCase().replace(/[^\w]/g, '');
      if (wordLower === firstWord || wordLower.startsWith(firstWord) || firstWord.startsWith(wordLower)) {
        startTime = words[i].start_time;
        break;
      }
    }
    
    // 找最后一个单词的时间戳
    let endTime = duration || 0;
    for (let i = words.length - 1; i >= 0; i--) {
      const wordLower = words[i].word.toLowerCase().replace(/[^\w]/g, '');
      if (wordLower === lastWord || wordLower.endsWith(lastWord) || lastWord.endsWith(wordLower)) {
        endTime = words[i].end_time;
        break;
      }
    }
    
    return { start: startTime, end: endTime };
  }, [duration]);

  const fetchData = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      const materialRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const materialData = await materialRes.json();
      
      if (materialData.material) {
        setAudioUrl(materialData.material.audio_url || '');
        setDuration(materialData.material.duration || 0);
      }
      
      let wordsData: WordTimestamp[] = [];
      
      // 获取单词时间戳
      try {
        const wordsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/word-timestamps`, {
          method: 'POST',
        });
        const wordsJson = await wordsRes.json();
        if (wordsJson.words && wordsJson.words.length > 0) {
          wordsData = wordsJson.words;
          setWordTimestamps(wordsData);
          if (wordsJson.duration) {
            setDuration(wordsJson.duration);
          }
        }
      } catch (e) {
        console.log('未获取到单词时间戳');
      }
      
      // 获取句子
      if (materialData.sentences && materialData.sentences.length > 0) {
        // 自动匹配每个句子的时间戳
        const processedSentences = materialData.sentences.map((s: Sentence) => {
          // 如果已经有时间戳，保持不变
          if (s.start_time > 0 && s.end_time > 0) {
            return s;
          }
          
          // 否则自动匹配
          const { start, end } = matchSentenceToTimestamps(s.text, wordsData);
          return {
            ...s,
            start_time: start,
            end_time: end,
          };
        });
        
        setSentences(processedSentences);
      }
      
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [materialId, matchSentenceToTimestamps]);

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

  const stopPlaying = async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  };

  // 播放当前句子
  const playCurrentSentence = async () => {
    if (!soundRef.current) await loadAudio();
    if (!soundRef.current || !currentSentence) return;
    
    await stopPlaying();
    
    const start = currentSentence.start_time;
    const end = currentSentence.end_time;
    
    if (end <= start) {
      console.log('时间戳无效');
      return;
    }
    
    console.log('播放句子:', currentSentence.text);
    console.log('时间:', start, '-', end);
    
    await soundRef.current.setPositionAsync(start);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    const checkInterval = setInterval(async () => {
      if (!soundRef.current) {
        clearInterval(checkInterval);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.positionMillis >= end) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        clearInterval(checkInterval);
      }
    }, 50);
  };

  // 播放单个单词
  const playWord = async (word: WordTimestamp) => {
    if (!soundRef.current) await loadAudio();
    if (!soundRef.current) return;
    
    await stopPlaying();
    
    await soundRef.current.setPositionAsync(word.start_time);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    const checkInterval = setInterval(async () => {
      if (!soundRef.current) {
        clearInterval(checkInterval);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.positionMillis >= word.end_time) {
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

  // 确认并跳转下一句
  const confirmAndNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的时间轴设置！' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const sentence of sentences) {
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${sentence.id}`, {
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

  const formatTimeSimple = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // 获取当前句子范围内的单词
  const getSentenceWords = useCallback(() => {
    if (!currentSentence || wordTimestamps.length === 0) return [];
    
    const start = Math.min(currentSentence.start_time, currentSentence.end_time);
    const end = Math.max(currentSentence.start_time, currentSentence.end_time);
    
    return wordTimestamps.filter(w => w.start_time >= start && w.end_time <= end);
  }, [currentSentence, wordTimestamps]);

  if (loading) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={{ color: '#888', marginTop: 16 }}>正在加载...</Text>
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
  const sentenceDuration = Math.abs(currentSentence?.end_time - currentSentence?.start_time) || 0;

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

      {/* 时间信息 */}
      <View style={styles.timeInfo}>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>开始</Text>
          <Text style={styles.timeValue}>{formatTime(currentSentence?.start_time || 0)}</Text>
        </View>
        <View style={styles.durationBox}>
          <Text style={styles.durationValue}>{formatTime(sentenceDuration)}</Text>
          <Text style={styles.durationLabel}>时长</Text>
        </View>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>结束</Text>
          <Text style={styles.timeValue}>{formatTime(currentSentence?.end_time || 0)}</Text>
        </View>
      </View>

      {/* 单词列表 */}
      <View style={styles.wordsSection}>
        <Text style={styles.sectionTitle}>句子中的单词 (点击可播放，长按可设置时间)</Text>
        <ScrollView style={styles.wordsList} contentContainerStyle={styles.wordsContent}>
          {sentenceWords.length > 0 ? (
            sentenceWords.map((word, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.wordItem}
                onPress={() => playWord(word)}
                onLongPress={() => setStartFromWord(word)}
              >
                <Text style={styles.wordText}>{word.word}</Text>
                <Text style={styles.wordTime}>{formatTime(word.start_time)}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noWords}>该时间范围内没有单词，请调整开始/结束时间</Text>
          )}
        </ScrollView>
      </View>

      {/* 调整时间 */}
      <View style={styles.adjustSection}>
        <Text style={styles.sectionTitle}>调整时间边界</Text>
        <View style={styles.adjustButtons}>
          <TouchableOpacity style={styles.adjustBtn} onPress={() => {
            // 找到比当前开始时间早的单词
            const currentStart = currentSentence?.start_time || 0;
            const earlierWords = wordTimestamps.filter(w => w.end_time < currentStart);
            if (earlierWords.length > 0) {
              setStartFromWord(earlierWords[earlierWords.length - 1]);
            }
          }}>
            <FontAwesome6 name="backward" size={16} color="#00ff88" />
            <Text style={styles.adjustBtnText}>开始前移</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.adjustBtn} onPress={() => {
            // 找到比当前开始时间晚的单词
            const currentStart = currentSentence?.start_time || 0;
            const laterWords = wordTimestamps.filter(w => w.start_time > currentStart);
            if (laterWords.length > 0) {
              setStartFromWord(laterWords[0]);
            }
          }}>
            <FontAwesome6 name="forward" size={16} color="#00ff88" />
            <Text style={styles.adjustBtnText}>开始后移</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.adjustBtn} onPress={() => {
            // 找到比当前结束时间早的单词
            const currentEnd = currentSentence?.end_time || duration;
            const earlierWords = wordTimestamps.filter(w => w.end_time < currentEnd);
            if (earlierWords.length > 0) {
              setEndFromWord(earlierWords[earlierWords.length - 1]);
            }
          }}>
            <FontAwesome6 name="backward" size={16} color="#ff8800" />
            <Text style={styles.adjustBtnText}>结束前移</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.adjustBtn} onPress={() => {
            // 找到比当前结束时间晚的单词
            const currentEnd = currentSentence?.end_time || 0;
            const laterWords = wordTimestamps.filter(w => w.start_time > currentEnd);
            if (laterWords.length > 0) {
              setEndFromWord(laterWords[0]);
            }
          }}>
            <FontAwesome6 name="forward" size={16} color="#ff8800" />
            <Text style={styles.adjustBtnText}>结束后移</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 底部控制栏 */}
      <View style={styles.controls}>
        <View style={styles.playControls}>
          <TouchableOpacity style={styles.playBtn} onPress={playCurrentSentence}>
            <FontAwesome6 name={isPlaying ? "pause" : "play"} size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopBtn} onPress={stopPlaying}>
            <FontAwesome6 name="stop" size={18} color="#888" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndNext}>
          <FontAwesome6 name="check" size={18} color="#000" />
          <Text style={styles.confirmBtnText}>确认并下一句</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#00ff88" /> : <FontAwesome6 name="floppy-disk" size={18} color="#00ff88" />}
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
  
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  timeBox: {
    alignItems: 'center',
  },
  timeLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  timeValue: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  durationBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  durationValue: {
    color: '#00ff88',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  durationLabel: {
    color: '#00ff88',
    fontSize: 12,
    marginTop: 2,
  },
  
  wordsSection: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#111',
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
  
  adjustSection: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 12,
  },
  adjustButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  adjustBtn: {
    alignItems: 'center',
    padding: 8,
  },
  adjustBtnText: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  playControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00ff88',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
});
