import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  PanResponder,
  Dimensions,
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
  
  // 拖拽状态
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  
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
      // 获取材料详情
      const materialRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const materialData = await materialRes.json();
      
      if (materialData.material) {
        setAudioUrl(materialData.material.audio_url || '');
        setDuration(materialData.material.duration || 0);
      }
      
      if (materialData.sentences && materialData.sentences.length > 0) {
        setSentences(materialData.sentences);
      }
      
      // 获取单词时间戳用于波形参考
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
        console.log('未获取到单词时间戳，将使用简单波形');
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
      // 如果已有时间戳，使用它；否则估算一个初始位置
      if (currentSentence.start_time > 0 || currentSentence.end_time > 0) {
        setSelectionStart(currentSentence.start_time || 0);
        setSelectionEnd(currentSentence.end_time || duration);
      } else {
        // 根据上一句的结束时间初始化
        const prevEnd = currentIndex > 0 ? sentences[currentIndex - 1].end_time : 0;
        const estimatedDuration = Math.min(3000, duration - prevEnd); // 默认3秒
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

  // 播放状态更新
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    }
  };

  // 停止播放
  const stopPlaying = async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  };

  // 播放选中的区域
  const playSelection = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (!soundRef.current) return;
    
    // 先停止当前播放
    await stopPlaying();
    
    // 跳转到选择开始位置
    await soundRef.current.setPositionAsync(selectionStart);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    // 设置定时器在选择结束位置停止
    const playDuration = selectionEnd - selectionStart;
    setTimeout(async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        setPosition(selectionStart);
      }
    }, playDuration);
  };

  // 跳转到选择开始位置
  const seekToStart = async () => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(selectionStart);
      setPosition(selectionStart);
    }
  };

  // 确认当前选择，保存并跳转下一句
  const confirmSelection = async () => {
    const newSentences = [...sentences];
    
    // 更新当前句
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(selectionStart),
      end_time: Math.round(selectionEnd),
    };
    
    // 自动设置下一句的开始时间
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: Math.round(selectionEnd),
      };
    }
    
    setSentences(newSentences);
    
    // 跳转下一句或完成
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的音频分配！' });
    }
  };

  // 保存所有时间戳
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

  // 格式化时间
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`;
  };

  // 时间转像素位置
  const timeToPixel = (time: number) => {
    if (duration === 0) return 0;
    return (time / duration) * waveformWidth;
  };

  // 像素转时间
  const pixelToTime = (pixel: number) => {
    return (pixel / waveformWidth) * duration;
  };

  // 生成波形数据
  const generateWaveformData = useMemo(() => {
    const barCount = Math.floor(waveformWidth / 4); // 每4像素一个柱子
    const bars: { height: number; hasWord: boolean }[] = [];
    
    for (let i = 0; i < barCount; i++) {
      const startTime = (i / barCount) * duration;
      const endTime = ((i + 1) / barCount) * duration;
      
      // 检查这个时间段是否有单词
      const hasWord = wordTimestamps.some(
        w => w.start_time < endTime && w.end_time > startTime
      );
      
      // 如果有单词时间戳，根据单词位置设置高度；否则随机
      const height = hasWord ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3;
      
      bars.push({ height, hasWord });
    }
    
    return bars;
  }, [waveformWidth, duration, wordTimestamps]);

  // 开始拖拽手势
  const createPanResponder = (type: 'start' | 'end') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setDragging(type);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const time = pixelToTime(Math.max(0, Math.min(x, waveformWidth)));
        
        if (type === 'start') {
          // 开始位置不能超过结束位置
          if (time < selectionEnd - 100) {
            setSelectionStart(Math.max(0, time));
          }
        } else {
          // 结束位置不能小于开始位置
          if (time > selectionStart + 100) {
            setSelectionEnd(Math.min(duration, time));
          }
        }
      },
      onPanResponderRelease: () => {
        setDragging(null);
      },
    });
  };

  const startPanResponder = useMemo(() => createPanResponder('start'), [selectionEnd, duration]);
  const endPanResponder = useMemo(() => createPanResponder('end'), [selectionStart, duration]);

  // 点击波形跳转
  const handleWaveformPress = (evt: any) => {
    if (dragging) return;
    const x = evt.nativeEvent.locationX;
    const time = pixelToTime(Math.max(0, Math.min(x, waveformWidth)));
    
    // 跳转到点击位置
    if (soundRef.current) {
      soundRef.current.setPositionAsync(time);
      setPosition(time);
    }
  };

  // 上一句/下一句
  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
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
          <ThemedText variant="smallMedium" color={theme.textSecondary}>
            拖动两侧把手选择音频片段
          </ThemedText>
          
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
            style={styles.waveformContainer}
            onLayout={(e) => setWaveformWidth(e.nativeEvent.layout.width)}
          >
            {/* 波形背景 */}
            <View style={styles.waveformTrack}>
              {/* 波形柱子 */}
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
            
            {/* 选中区域高亮 */}
            <View
              style={[
                styles.selectionOverlay,
                {
                  left: timeToPixel(selectionStart),
                  width: timeToPixel(selectionEnd) - timeToPixel(selectionStart),
                },
              ]}
            />
            
            {/* 未选中区域遮罩 */}
            <View
              style={[
                styles.maskOverlay,
                { left: 0, width: timeToPixel(selectionStart) },
              ]}
            />
            <View
              style={[
                styles.maskOverlay,
                { left: timeToPixel(selectionEnd), right: 0 },
              ]}
            />
            
            {/* 播放位置指示器 */}
            <View
              style={[
                styles.playhead,
                { left: timeToPixel(position) },
              ]}
            />
            
            {/* 左侧把手 */}
            <View
              style={[
                styles.handle,
                styles.handleStart,
                { left: timeToPixel(selectionStart) - 12 },
              ]}
              {...startPanResponder.panHandlers}
            >
              <View style={[styles.handleBar, { backgroundColor: theme.primary }]} />
            </View>
            
            {/* 右侧把手 */}
            <View
              style={[
                styles.handle,
                styles.handleEnd,
                { left: timeToPixel(selectionEnd) - 12 },
              ]}
              {...endPanResponder.panHandlers}
            >
              <View style={[styles.handleBar, { backgroundColor: theme.success }]} />
            </View>
            
            {/* 点击层 */}
            <View
              style={styles.waveformTouchLayer}
              onTouchEnd={handleWaveformPress}
            />
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
            拖动波形两侧的把手来选择音频范围，点击「播放选中」试听效果
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
