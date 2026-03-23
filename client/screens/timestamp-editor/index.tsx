import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Audio } from 'expo-av';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
const SCREEN_WIDTH = Dimensions.get('window').width;

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
  
  // 选择区域 - 使用 ref 来避免拖拽时的重新渲染
  const selectionStartRef = useRef(0);
  const selectionEndRef = useRef(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  // 波形宽度
  const waveformWidthRef = useRef(SCREEN_WIDTH - 32);
  const [waveformWidth, setWaveformWidth] = useState(SCREEN_WIDTH - 32);
  
  // 拖拽状态 - 使用 ref 避免重新渲染
  const isSelectingRef = useRef(false);
  const selectionOriginRef = useRef(0);
  
  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<View>(null);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  const currentSentence = sentences[currentIndex];

  // 生成稳定的波形数据
  const waveformDataRef = useRef<number[]>([]);
  
  // 生成波形数据（只生成一次）
  const generateWaveform = useCallback((width: number, dur: number, words: WordTimestamp[]) => {
    const barCount = Math.floor(width / 1.5); // 更密集的波形
    const bars: number[] = [];
    
    // 使用固定的随机种子，确保波形稳定
    const seed = 12345;
    let rand = seed;
    const seededRandom = () => {
      rand = (rand * 9301 + 49297) % 233280;
      return rand / 233280;
    };
    
    for (let i = 0; i < barCount; i++) {
      const startTime = (i / barCount) * dur;
      const endTime = ((i + 1) / barCount) * dur;
      
      const hasWord = words.some(
        w => w.start_time < endTime && w.end_time > startTime
      );
      
      // 生成波形高度（0-1）
      let height: number;
      if (hasWord) {
        // 有声音的区域：更高的波形
        height = 0.4 + seededRandom() * 0.55;
      } else {
        // 静音区域：较低的波形
        height = 0.05 + seededRandom() * 0.15;
      }
      
      bars.push(height);
    }
    
    return bars;
  }, []);

  // 绘制波形到 Canvas
  const drawWaveform = useCallback(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = waveformWidthRef.current;
    const height = canvas.height;
    const bars = waveformDataRef.current;
    
    // 清空画布
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // 绘制波形
    const centerY = height / 2;
    const barWidth = 1;
    const gap = 0.5;
    
    ctx.fillStyle = '#00ff88';
    
    for (let i = 0; i < bars.length; i++) {
      const x = i * (barWidth + gap);
      const barHeight = bars[i] * centerY * 0.9;
      
      // 上半部分
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
      // 下半部分
      ctx.fillRect(x, centerY, barWidth, barHeight);
    }
    
    // 绘制零电平线
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, []);

  // 绘制选区
  const drawSelection = useCallback(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = waveformWidthRef.current;
    const height = canvas.height;
    const dur = duration;
    
    // 重绘波形
    drawWaveform();
    
    // 计算选区位置
    const startX = (selectionStartRef.current / dur) * width;
    const endX = (selectionEndRef.current / dur) * width;
    const leftX = Math.min(startX, endX);
    const rightX = Math.max(startX, endX);
    
    // 绘制未选中区域的遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    if (leftX > 0) {
      ctx.fillRect(0, 0, leftX, height);
    }
    if (rightX < width) {
      ctx.fillRect(rightX, 0, width - rightX, height);
    }
    
    // 绘制选区高亮
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.fillRect(leftX, 0, rightX - leftX, height);
    
    // 绘制边界线
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    
    // 左边界
    ctx.beginPath();
    ctx.moveTo(leftX, 0);
    ctx.lineTo(leftX, height);
    ctx.stroke();
    
    // 右边界
    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX, height);
    ctx.stroke();
  }, [duration, drawWaveform]);

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
      
      if (materialData.sentences && materialData.sentences.length > 0) {
        setSentences(materialData.sentences);
      }
      
      try {
        const wordsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/word-timestamps`, {
          method: 'POST',
        });
        const wordsData = await wordsRes.json();
        if (wordsData.words && wordsData.words.length > 0) {
          setWordTimestamps(wordsData.words);
          if (wordsData.duration) {
            setDuration(wordsData.duration);
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

  // 当数据加载完成后，生成波形并绘制
  useEffect(() => {
    if (!loading && duration > 0 && waveformWidth > 0) {
      waveformDataRef.current = generateWaveform(waveformWidth, duration, wordTimestamps);
      drawSelection();
    }
  }, [loading, duration, waveformWidth, wordTimestamps, generateWaveform, drawSelection]);

  useEffect(() => {
    if (currentSentence && duration > 0) {
      if (currentSentence.start_time > 0 || currentSentence.end_time > 0) {
        selectionStartRef.current = currentSentence.start_time || 0;
        selectionEndRef.current = currentSentence.end_time || duration;
        setSelectionStart(selectionStartRef.current);
        setSelectionEnd(selectionEndRef.current);
      } else {
        const prevEnd = currentIndex > 0 ? sentences[currentIndex - 1].end_time : 0;
        const estimatedDuration = Math.min(3000, duration - prevEnd);
        selectionStartRef.current = prevEnd;
        selectionEndRef.current = Math.min(prevEnd + estimatedDuration, duration);
        setSelectionStart(selectionStartRef.current);
        setSelectionEnd(selectionEndRef.current);
      }
      drawSelection();
    }
  }, [currentIndex, currentSentence, duration, sentences, drawSelection]);

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

  const playSelection = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (!soundRef.current) return;
    
    await stopPlaying();
    const start = selectionStartRef.current;
    const end = selectionEndRef.current;
    
    await soundRef.current.setPositionAsync(Math.min(start, end));
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    const playDuration = Math.abs(end - start);
    setTimeout(async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      }
    }, playDuration);
  };

  const confirmSelection = async () => {
    const newSentences = [...sentences];
    
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(Math.min(selectionStartRef.current, selectionEndRef.current)),
      end_time: Math.round(Math.max(selectionStartRef.current, selectionEndRef.current)),
    };
    
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: Math.round(Math.max(selectionStartRef.current, selectionEndRef.current)),
      };
    }
    
    setSentences(newSentences);
    
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的音频分配！' });
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
      
      setDialog({
        visible: true,
        message: '保存成功！',
        onConfirm: () => router.back(),
      });
    } catch (error) {
      console.error('保存失败:', error);
      setDialog({ visible: true, message: `保存失败: ${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const decimal = Math.floor((totalSeconds % 1) * 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${decimal.toString().padStart(2, '0')}`;
  };

  const formatTimeSimple = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 鼠标事件处理
  const handleMouseDown = useCallback((evt: any) => {
    if (duration === 0) return;
    
    const rect = evt.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    
    const x = evt.clientX - rect.left;
    const time = (x / waveformWidthRef.current) * duration;
    
    isSelectingRef.current = true;
    selectionOriginRef.current = time;
    selectionStartRef.current = time;
    selectionEndRef.current = time;
    
    if (isPlaying) {
      stopPlaying();
    }
    
    drawSelection();
    setSelectionStart(time);
    setSelectionEnd(time);
  }, [duration, isPlaying, stopPlaying, drawSelection]);

  const handleMouseMove = useCallback((evt: any) => {
    if (!isSelectingRef.current || duration === 0) return;
    
    const rect = evt.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    
    const x = evt.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(x, waveformWidthRef.current));
    const time = (clampedX / waveformWidthRef.current) * duration;
    
    if (time < selectionOriginRef.current) {
      selectionStartRef.current = time;
      selectionEndRef.current = selectionOriginRef.current;
    } else {
      selectionStartRef.current = selectionOriginRef.current;
      selectionEndRef.current = time;
    }
    
    drawSelection();
    setSelectionStart(selectionStartRef.current);
    setSelectionEnd(selectionEndRef.current);
  }, [duration, drawSelection]);

  const handleMouseUp = useCallback(() => {
    if (!isSelectingRef.current) return;
    
    isSelectingRef.current = false;
    
    // 确保最小选择时长
    const diff = Math.abs(selectionEndRef.current - selectionStartRef.current);
    if (diff < 100) {
      selectionEndRef.current = selectionStartRef.current + 1000;
      if (selectionEndRef.current > duration) {
        selectionEndRef.current = duration;
      }
      drawSelection();
      setSelectionStart(selectionStartRef.current);
      setSelectionEnd(selectionEndRef.current);
    }
  }, [duration, drawSelection]);

  const handleLayout = useCallback((e: any) => {
    const width = e.nativeEvent.layout.width;
    waveformWidthRef.current = width;
    setWaveformWidth(width);
  }, []);

  if (loading) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={{ color: '#888', marginTop: 16 }}>正在加载音频...</Text>
        </ThemedView>
      </Screen>
    );
  }

  if (sentences.length === 0) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <FontAwesome6 name="file-lines" size={48} color="#666" />
          <Text style={{ color: '#888', marginTop: 16 }}>没有句子，请先切分文本</Text>
          <TouchableOpacity style={{ marginTop: 24, padding: 16, backgroundColor: '#00ff88', borderRadius: 8 }} onPress={() => router.back()}>
            <Text style={{ color: '#000', fontWeight: '600' }}>返回</Text>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  const selectionDuration = Math.abs(selectionEnd - selectionStart);

  return (
    <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
      {/* 顶部状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusText}>句子 {currentIndex + 1}/{sentences.length}</Text>
          <Text style={styles.statusInfo}>总时长: {formatTimeSimple(duration)}</Text>
        </View>
        <View style={styles.statusRight}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <FontAwesome6 name="xmark" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 当前句子 */}
      <View style={styles.sentenceBar}>
        <TouchableOpacity 
          style={styles.navBtn}
          onPress={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
        
        <View style={styles.sentenceContent}>
          <Text style={styles.sentenceText} numberOfLines={2}>
            {currentSentence?.text}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.navBtn}
          onPress={() => currentIndex < sentences.length - 1 && setCurrentIndex(currentIndex + 1)}
          disabled={currentIndex === sentences.length - 1}
        >
          <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
      </View>

      {/* 波形编辑区域 */}
      <View style={styles.waveformSection}>
        {/* 时间刻度 */}
        <View style={styles.timeScale}>
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <Text key={ratio} style={styles.timeTick}>
              {formatTimeSimple(duration * ratio)}
            </Text>
          ))}
        </View>
        
        {/* 波形容器 */}
        <View 
          ref={containerRef}
          style={styles.waveformContainer}
          onLayout={handleLayout}
          // @ts-ignore
          onMouseDown={handleMouseDown}
          // @ts-ignore
          onMouseMove={handleMouseMove}
          // @ts-ignore
          onMouseUp={handleMouseUp}
          // @ts-ignore
          onMouseLeave={handleMouseUp}
        >
          {Platform.OS === 'web' && (
            <canvas
              ref={canvasRef}
              width={waveformWidth}
              height={200}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
          )}
          {Platform.OS !== 'web' && (
            <View style={styles.waveformPlaceholder}>
              <Text style={styles.placeholderText}>请在Web端操作</Text>
            </View>
          )}
        </View>
        
        {/* 选区时间信息 */}
        <View style={styles.selectionInfo}>
          <View style={styles.selectionTimeBox}>
            <Text style={styles.selectionLabel}>开始</Text>
            <Text style={styles.selectionValue}>{formatTime(Math.min(selectionStart, selectionEnd))}</Text>
          </View>
          
          <View style={styles.selectionDurationBox}>
            <Text style={styles.selectionDuration}>{formatTime(selectionDuration)}</Text>
            <Text style={styles.selectionDurationLabel}>选中时长</Text>
          </View>
          
          <View style={styles.selectionTimeBox}>
            <Text style={styles.selectionLabel}>结束</Text>
            <Text style={styles.selectionValue}>{formatTime(Math.max(selectionStart, selectionEnd))}</Text>
          </View>
        </View>
      </View>

      {/* 操作提示 */}
      <View style={styles.tipBar}>
        <FontAwesome6 name="hand-pointer" size={14} color="#00ff88" />
        <Text style={styles.tipText}>在波形上按住鼠标拖动选择音频片段</Text>
      </View>

      {/* 底部控制栏 */}
      <View style={styles.controls}>
        {/* 播放控制 */}
        <View style={styles.playControls}>
          <TouchableOpacity style={styles.playBtn} onPress={playSelection}>
            <FontAwesome6 name={isPlaying ? "pause" : "play"} size={24} color="#000" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlBtn} onPress={stopPlaying}>
            <FontAwesome6 name="stop" size={18} color="#888" />
          </TouchableOpacity>
        </View>
        
        {/* 确认按钮 */}
        <TouchableOpacity style={styles.confirmBtn} onPress={confirmSelection}>
          <FontAwesome6 name="check" size={18} color="#000" />
          <Text style={styles.confirmBtnText}>确认并下一句</Text>
          <FontAwesome6 name="arrow-right" size={14} color="#000" />
        </TouchableOpacity>
        
        {/* 保存按钮 */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#00ff88" />
          ) : (
            <FontAwesome6 name="floppy-disk" size={18} color="#00ff88" />
          )}
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={dialog.visible}
        title="提示"
        message={dialog.message}
        confirmText="确定"
        onConfirm={() => {
          setDialog({ visible: false, message: '' });
          dialog.onConfirm?.();
        }}
        onCancel={() => setDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusInfo: {
    color: '#888',
    fontSize: 12,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    padding: 8,
  },
  
  // 句子栏
  sentenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentenceContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sentenceText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // 波形区域
  waveformSection: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  timeScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#111',
  },
  timeTick: {
    color: '#666',
    fontSize: 10,
  },
  waveformContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    minHeight: 200,
  },
  waveformPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
  
  // 选区信息
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  selectionTimeBox: {
    alignItems: 'center',
  },
  selectionLabel: {
    color: '#666',
    fontSize: 10,
    marginBottom: 4,
  },
  selectionValue: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  selectionDurationBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectionDuration: {
    color: '#00ff88',
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  selectionDurationLabel: {
    color: '#00ff88',
    fontSize: 10,
    marginTop: 2,
  },
  
  // 提示栏
  tipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  tipText: {
    color: '#888',
    fontSize: 12,
  },
  
  // 底部控制
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
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00ff88',
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
