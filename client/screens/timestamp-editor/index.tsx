import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
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
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  
  // 单词级时间戳（用于显示波形参考）
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  
  // 选择区域（毫秒）
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  // 波形容器宽度
  const [waveformWidth, setWaveformWidth] = useState(SCREEN_WIDTH - 48);
  const waveformRef = useRef<View>(null);
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'selection' | 'start' | 'end' | null>(null);
  const dragStartRef = useRef({ x: 0, start: 0, end: 0 });
  
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // 提示对话框
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  const currentSentence = sentences[currentIndex];

  // 获取材料详情
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

  // 当切换句子时，初始化选择区域
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

  // 加载音频
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
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`;
  };

  const timeToPixel = (time: number) => {
    if (duration === 0) return 0;
    return (time / duration) * waveformWidth;
  };

  const pixelToTime = (pixel: number) => {
    return (pixel / waveformWidth) * duration;
  };

  // 生成波形数据
  const generateWaveformData = useMemo(() => {
    const barCount = Math.floor(waveformWidth / 4);
    const bars: { height: number; hasWord: boolean }[] = [];
    
    for (let i = 0; i < barCount; i++) {
      const startTime = (i / barCount) * duration;
      const endTime = ((i + 1) / barCount) * duration;
      
      const hasWord = wordTimestamps.some(
        w => w.start_time < endTime && w.end_time > startTime
      );
      
      const height = hasWord ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3;
      
      bars.push({ height, hasWord });
    }
    
    return bars;
  }, [waveformWidth, duration, wordTimestamps]);

  // ========== 鼠标/触摸事件处理 ==========
  
  // 获取事件位置相对于波形容器的x坐标
  const getEventX = (evt: any): number => {
    // 对于Web端的鼠标事件
    if (Platform.OS === 'web' && evt.nativeEvent.offsetX !== undefined) {
      return evt.nativeEvent.offsetX;
    }
    // 对于触摸事件
    if (evt.nativeEvent.locationX !== undefined) {
      return evt.nativeEvent.locationX;
    }
    // 对于Web触摸事件
    const touch = evt.nativeEvent.touches?.[0];
    if (touch) {
      return touch.clientX - (evt.currentTarget?.offsetLeft || 0);
    }
    return 0;
  };

  // 开始拖拽选择
  const handleDragStart = (evt: any, type: 'selection' | 'start' | 'end') => {
    const x = getEventX(evt);
    setIsDragging(true);
    setDragType(type);
    dragStartRef.current = {
      x,
      start: selectionStart,
      end: selectionEnd,
    };
  };

  // 拖拽移动
  const handleDragMove = (evt: any) => {
    if (!isDragging || !dragType) return;
    
    const x = getEventX(evt);
    const deltaX = x - dragStartRef.current.x;
    const deltaTime = pixelToTime(deltaX);
    
    if (dragType === 'start') {
      // 移动开始位置
      const newStart = Math.max(0, Math.min(dragStartRef.current.start + deltaTime, selectionEnd - 100));
      setSelectionStart(newStart);
    } else if (dragType === 'end') {
      // 移动结束位置
      const newEnd = Math.max(selectionStart + 100, Math.min(dragStartRef.current.end + deltaTime, duration));
      setSelectionEnd(newEnd);
    } else if (dragType === 'selection') {
      // 移动整个选择区域
      const selectionDuration = dragStartRef.current.end - dragStartRef.current.start;
      let newStart = dragStartRef.current.start + deltaTime;
      let newEnd = newStart + selectionDuration;
      
      // 边界检查
      if (newStart < 0) {
        newStart = 0;
        newEnd = selectionDuration;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - selectionDuration;
      }
      
      setSelectionStart(newStart);
      setSelectionEnd(newEnd);
    }
  };

  // 结束拖拽
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragType(null);
  };

  // 点击波形设置播放位置或开始新选择
  const handleWaveformClick = (evt: any) => {
    if (isDragging) return;
    
    const x = getEventX(evt);
    const time = pixelToTime(Math.max(0, Math.min(x, waveformWidth)));
    
    // 跳转到点击位置播放
    if (soundRef.current) {
      soundRef.current.setPositionAsync(time);
      setPosition(time);
    }
  };

  // 双击设置开始/结束位置
  const handleSetStart = () => {
    setSelectionStart(Math.max(0, position));
  };

  const handleSetEnd = () => {
    setSelectionEnd(Math.min(duration, Math.max(selectionStart + 100, position)));
  };

  // 上一句/下一句
  const goToPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const goToNext = () => {
    if (currentIndex < sentences.length - 1) setCurrentIndex(currentIndex + 1);
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            正在加载音频...
          </ThemedText>
        </ThemedView>
      </Screen>
    );
  }

  if (sentences.length === 0) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <FontAwesome6 name="file-lines" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            没有句子，请先切分文本
          </ThemedText>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>返回</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <ThemedText variant="h3" color={theme.textPrimary}>
              音频分配
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted}>
              {currentIndex + 1}/{sentences.length} · {formatTime(duration)}
            </ThemedText>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <FontAwesome6 name="check" size={20} color={theme.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 当前句子 */}
        <View style={styles.sentenceSection}>
          <View style={styles.sentenceHeader}>
            <TouchableOpacity 
              style={[styles.sentenceNavBtn, currentIndex === 0 && styles.sentenceNavBtnDisabled]}
              onPress={goToPrev}
              disabled={currentIndex === 0}
            >
              <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
            </TouchableOpacity>
            
            <View style={styles.sentenceNumber}>
              <ThemedText variant="h4" color={theme.primary}>{currentIndex + 1}</ThemedText>
            </View>
            
            <TouchableOpacity 
              style={[styles.sentenceNavBtn, currentIndex === sentences.length - 1 && styles.sentenceNavBtnDisabled]}
              onPress={goToNext}
              disabled={currentIndex === sentences.length - 1}
            >
              <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? theme.textMuted : theme.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.sentenceCard}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.sentenceText}>
              {currentSentence?.text}
            </ThemedText>
          </View>
        </View>

        {/* 波形选择器 */}
        <View style={styles.waveformSection}>
          {/* 时间显示 */}
          <View style={styles.timeDisplay}>
            <View style={styles.timeBox}>
              <ThemedText variant="caption" color={theme.textMuted}>开始</ThemedText>
              <ThemedText variant="h4" color={theme.primary}>{formatTime(selectionStart)}</ThemedText>
            </View>
            <View style={styles.durationBox}>
              <FontAwesome6 name="arrow-right" size={12} color={theme.textMuted} />
              <ThemedText variant="bodyMedium" color={theme.textSecondary}>
                {formatTime(selectionEnd - selectionStart)}
              </ThemedText>
            </View>
            <View style={styles.timeBox}>
              <ThemedText variant="caption" color={theme.textMuted}>结束</ThemedText>
              <ThemedText variant="h4" color={theme.success}>{formatTime(selectionEnd)}</ThemedText>
            </View>
          </View>
          
          {/* 波形容器 */}
          <View 
            ref={waveformRef}
            style={styles.waveformContainer}
            onLayout={(e) => setWaveformWidth(e.nativeEvent.layout.width)}
            // @ts-ignore - Web端鼠标事件
            onMouseMove={isDragging ? handleDragMove : undefined}
            // @ts-ignore - Web端鼠标事件
            onMouseUp={handleDragEnd}
            // @ts-ignore - Web端鼠标事件
            onMouseLeave={handleDragEnd}
            onClick={handleWaveformClick}
          >
            {/* 波形背景 */}
            <View style={styles.waveformTrack} pointerEvents="none">
              {generateWaveformData.map((bar, index) => (
                <View
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      height: `${bar.height * 100}%`,
                      backgroundColor: bar.hasWord ? theme.primary : theme.textMuted,
                      opacity: bar.hasWord ? 0.8 : 0.3,
                    },
                  ]}
                />
              ))}
            </View>
            
            {/* 未选中区域遮罩 - 左侧 */}
            <View
              style={[
                styles.maskOverlay,
                { left: 0, width: timeToPixel(selectionStart) },
              ]}
              pointerEvents="none"
            />
            
            {/* 未选中区域遮罩 - 右侧 */}
            <View
              style={[
                styles.maskOverlay,
                { left: timeToPixel(selectionEnd), right: 0 },
              ]}
              pointerEvents="none"
            />
            
            {/* 播放位置指示器 */}
            <View
              style={[
                styles.playhead,
                { left: timeToPixel(position) },
              ]}
              pointerEvents="none"
            />
            
            {/* 左侧把手 - 开始位置 */}
            <View
              style={[
                styles.handle,
                { left: timeToPixel(selectionStart) - 16 },
              ]}
              // @ts-ignore - Web端需要
              onMouseDown={(e: any) => {
                e.stopPropagation();
                handleDragStart(e, 'start');
              }}
              // 移动端触摸事件
              onTouchStart={(e: any) => handleDragStart(e, 'start')}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <View style={[styles.handleBar, { backgroundColor: theme.primary }]} />
              <View style={[styles.handleTriangle, { borderTopColor: theme.primary }]} />
            </View>
            
            {/* 右侧把手 - 结束位置 */}
            <View
              style={[
                styles.handle,
                styles.handleEnd,
                { left: timeToPixel(selectionEnd) - 16 },
              ]}
              // @ts-ignore - Web端需要
              onMouseDown={(e: any) => {
                e.stopPropagation();
                handleDragStart(e, 'end');
              }}
              // 移动端触摸事件
              onTouchStart={(e: any) => handleDragStart(e, 'end')}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <View style={[styles.handleBar, { backgroundColor: theme.success }]} />
              <View style={[styles.handleTriangle, { borderTopColor: theme.success }]} />
            </View>
          </View>
          
          {/* 时间刻度 */}
          <View style={styles.timeLabels}>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>0:00</Text>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {formatTime(duration / 2)}
            </Text>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {formatTime(duration)}
            </Text>
          </View>
          
          {/* 快捷按钮 */}
          <View style={styles.quickButtons}>
            <TouchableOpacity 
              style={[styles.quickBtn, { backgroundColor: theme.primary + '20' }]}
              onPress={handleSetStart}
            >
              <FontAwesome6 name="play" size={12} color={theme.primary} />
              <ThemedText variant="small" color={theme.primary}>设为开始</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.quickBtn, { backgroundColor: theme.success + '20' }]}
              onPress={handleSetEnd}
            >
              <FontAwesome6 name="stop" size={12} color={theme.success} />
              <ThemedText variant="small" color={theme.success}>设为结束</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.playBtn} onPress={playSelection}>
            <FontAwesome6 name={isPlaying ? "pause" : "play"} size={24} color={theme.buttonPrimaryText} />
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
              {isPlaying ? '暂停' : '播放选中'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmSelection}>
            <FontAwesome6 name="check" size={20} color={theme.buttonPrimaryText} />
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
              确认并下一句
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* 提示 */}
        <View style={styles.tipBox}>
          <FontAwesome6 name="lightbulb" size={14} color={theme.accent} />
          <ThemedText variant="small" color={theme.textSecondary}>
            拖动两侧把手选择范围，或播放后点击「设为开始/结束」按钮
          </ThemedText>
        </View>

        {/* 句子列表 */}
        <View style={styles.listSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>
            所有句子
          </ThemedText>
          {sentences.map((sentence, index) => (
            <TouchableOpacity
              key={sentence.id}
              style={[
                styles.listItem,
                index === currentIndex && styles.listItemActive,
              ]}
              onPress={() => setCurrentIndex(index)}
            >
              <View style={[
                styles.listItemNumber,
                index === currentIndex && { backgroundColor: theme.primary },
              ]}>
                <ThemedText variant="caption" color={index === currentIndex ? theme.buttonPrimaryText : theme.textMuted}>
                  {index + 1}
                </ThemedText>
              </View>
              <View style={styles.listItemContent}>
                <ThemedText
                  variant="small"
                  color={index === currentIndex ? theme.textPrimary : theme.textSecondary}
                  numberOfLines={2}
                >
                  {sentence.text}
                </ThemedText>
                <ThemedText variant="caption" color={theme.textMuted}>
                  {sentence.start_time > 0 ? `${formatTime(sentence.start_time)} → ${formatTime(sentence.end_time)}` : '未分配'}
                </ThemedText>
              </View>
              {index === currentIndex && (
                <FontAwesome6 name="volume-high" size={12} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 提示对话框 */}
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
