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
import { ScrollView } from 'react-native';

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
  const { theme, isDark } = useTheme();
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ materialId: number; title: string }>();
  
  const materialId = params.materialId;
  const title = params.title || '材料';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  
  // 选择区域
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  // 波形宽度
  const [waveformWidth, setWaveformWidth] = useState(SCREEN_WIDTH - 32);
  
  // 拖拽状态
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionOrigin, setSelectionOrigin] = useState(0);
  
  // 缩放（可选）
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const waveformRef = useRef<View>(null);
  
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  const currentSentence = sentences[currentIndex];

  // 样式 - 黑色背景专业风格
  const styles = useMemo(() => createWaveformStyles(theme), [theme]);

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

  useEffect(() => {
    if (currentSentence && duration > 0) {
      if (currentSentence.start_time > 0 || currentSentence.end_time > 0) {
        setSelectionStart(currentSentence.start_time || 0);
        setSelectionEnd(currentSentence.end_time || duration);
      } else {
        const prevEnd = currentIndex > 0 ? sentences[currentIndex - 1].end_time : 0;
        const estimatedDuration = Math.min(3000, duration - prevEnd);
        setSelectionStart(prevEnd);
        setSelectionEnd(Math.min(prevEnd + estimatedDuration, duration));
      }
    }
  }, [currentIndex, currentSentence, duration, sentences]);

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
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
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
    await soundRef.current.setPositionAsync(selectionStart);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    const playDuration = selectionEnd - selectionStart;
    setTimeout(async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        setPosition(selectionStart);
      }
    }, playDuration);
  };

  const playFromStart = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (!soundRef.current) return;
    
    await stopPlaying();
    await soundRef.current.setPositionAsync(0);
    await soundRef.current.playAsync();
    setIsPlaying(true);
  };

  const confirmSelection = async () => {
    const newSentences = [...sentences];
    
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(selectionStart),
      end_time: Math.round(selectionEnd),
    };
    
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: Math.round(selectionEnd),
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

  const timeToPixel = (time: number) => {
    if (duration === 0) return 0;
    return (time / duration) * waveformWidth;
  };

  const pixelToTime = (pixel: number) => {
    return Math.max(0, Math.min((pixel / waveformWidth) * duration, duration));
  };

  // 生成波形数据
  const waveformData = useMemo(() => {
    const barCount = Math.floor(waveformWidth / 2);
    const bars: number[] = [];
    
    for (let i = 0; i < barCount; i++) {
      const startTime = (i / barCount) * duration;
      const endTime = ((i + 1) / barCount) * duration;
      
      const hasWord = wordTimestamps.some(
        w => w.start_time < endTime && w.end_time > startTime
      );
      
      // 生成上下两部分（模拟立体声波形）
      const upperHeight = hasWord ? 0.5 + Math.random() * 0.4 : 0.15 + Math.random() * 0.2;
      const lowerHeight = hasWord ? 0.4 + Math.random() * 0.35 : 0.1 + Math.random() * 0.15;
      
      bars.push(upperHeight, lowerHeight);
    }
    
    return bars;
  }, [waveformWidth, duration, wordTimestamps]);

  // 获取相对于波形容器的X坐标
  const getRelativeX = (evt: any): number => {
    if (Platform.OS === 'web') {
      const rect = evt.currentTarget?.getBoundingClientRect?.();
      if (rect) {
        return evt.clientX - rect.left;
      }
      return evt.nativeEvent?.offsetX || 0;
    }
    const touch = evt.nativeEvent?.touches?.[0];
    return touch?.locationX || evt.nativeEvent?.locationX || 0;
  };

  // 开始选择
  const handleSelectionStart = (evt: any) => {
    const x = getRelativeX(evt);
    const time = pixelToTime(x);
    
    setIsSelecting(true);
    setSelectionOrigin(time);
    setSelectionStart(time);
    setSelectionEnd(time);
    
    if (isPlaying) {
      stopPlaying();
    }
  };

  // 选择中
  const handleSelectionMove = (evt: any) => {
    if (!isSelecting) return;
    
    const x = getRelativeX(evt);
    const time = pixelToTime(x);
    
    if (time < selectionOrigin) {
      setSelectionStart(time);
      setSelectionEnd(selectionOrigin);
    } else {
      setSelectionStart(selectionOrigin);
      setSelectionEnd(time);
    }
  };

  // 结束选择
  const handleSelectionEnd = () => {
    if (!isSelecting) return;
    
    setIsSelecting(false);
    
    // 确保最小选择时长
    if (selectionEnd - selectionStart < 100) {
      setSelectionEnd(selectionStart + 1000);
    }
  };

  // 计算选择区域
  const selectionStyle = useMemo(() => {
    const left = timeToPixel(Math.min(selectionStart, selectionEnd));
    const width = timeToPixel(Math.abs(selectionEnd - selectionStart));
    return { left, width: Math.max(width, 4) };
  }, [selectionStart, selectionEnd, duration, waveformWidth]);

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
          ref={waveformRef}
          style={styles.waveformContainer}
          onLayout={(e) => setWaveformWidth(e.nativeEvent.layout.width)}
          // @ts-ignore
          onMouseDown={handleSelectionStart}
          // @ts-ignore
          onMouseMove={handleSelectionMove}
          // @ts-ignore
          onMouseUp={handleSelectionEnd}
          // @ts-ignore
          onMouseLeave={handleSelectionEnd}
          onTouchStart={handleSelectionStart}
          onTouchMove={handleSelectionMove}
          onTouchEnd={handleSelectionEnd}
        >
          {/* 波形 */}
          <View style={styles.waveformTrack}>
            {Array.from({ length: waveformData.length / 2 }).map((_, i) => (
              <View key={i} style={styles.barContainer}>
                {/* 上半部分波形 */}
                <View style={[styles.barUpper, { height: `${waveformData[i * 2] * 50}%` }]} />
                {/* 下半部分波形 */}
                <View style={[styles.barLower, { height: `${waveformData[i * 2 + 1] * 50}%` }]} />
              </View>
            ))}
          </View>
          
          {/* 零电平线 */}
          <View style={styles.zeroLine} />
          
          {/* 未选中遮罩 - 左 */}
          <View style={[styles.mask, { left: 0, width: selectionStyle.left }]} />
          
          {/* 未选中遮罩 - 右 */}
          <View style={[styles.mask, { left: selectionStyle.left + selectionStyle.width, right: 0 }]} />
          
          {/* 选中区域 */}
          <View style={[styles.selection, { left: selectionStyle.left, width: selectionStyle.width }]} />
          
          {/* 左边界标记 */}
          <View style={[styles.marker, styles.markerStart, { left: selectionStyle.left - 1 }]} />
          
          {/* 右边界标记 */}
          <View style={[styles.marker, styles.markerEnd, { left: selectionStyle.left + selectionStyle.width - 1 }]} />
          
          {/* 播放位置 */}
          {!isSelecting && position > 0 && (
            <View style={[styles.playhead, { left: timeToPixel(position) }]} />
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
        <Text style={styles.tipText}>在波形上拖动鼠标选择音频片段</Text>
      </View>

      {/* 底部控制栏 */}
      <View style={styles.controls}>
        {/* 播放控制 */}
        <View style={styles.playControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={playFromStart}>
            <FontAwesome6 name="backward" size={18} color="#888" />
          </TouchableOpacity>
          
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

// 专业波形编辑器样式
const createWaveformStyles = (theme: any) => StyleSheet.create({
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
    position: 'relative',
    marginHorizontal: 8,
  },
  waveformTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barContainer: {
    width: 2,
    height: '100%',
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barUpper: {
    width: 1.5,
    backgroundColor: '#00ff88',
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  barLower: {
    width: 1.5,
    backgroundColor: '#00ff88',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: '#ff4444',
  },
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderWidth: 0,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 10,
  },
  markerStart: {
    backgroundColor: '#00ff88',
  },
  markerEnd: {
    backgroundColor: '#00ff88',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ff0',
    zIndex: 5,
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
    backgroundColor: '#00ff8820',
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
