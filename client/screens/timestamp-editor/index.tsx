import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Text,
  LayoutChangeEvent,
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
import Slider from '@react-native-community/slider';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Sentence {
  id: number;
  text: string;
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
  const [detecting, setDetecting] = useState(false);
  
  // 时间轴宽度（用于计算点击位置）
  const [timelineWidth, setTimelineWidth] = useState(0);
  
  // 临时编辑的开始/结束时间（用于滑块调整）
  const [editStartTime, setEditStartTime] = useState(0);
  const [editEndTime, setEditEndTime] = useState(0);
  
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
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const data = await response.json();
      
      if (data.material) {
        setAudioUrl(data.material.audio_url || '');
        setDuration(data.material.duration || 0);
      }
      
      if (data.sentences && data.sentences.length > 0) {
        // 初始化：如果当前句没有开始时间，使用上一句的结束时间
        const processedSentences = data.sentences.map((s: Sentence, index: number) => {
          if (s.start_time === 0 && index > 0) {
            return {
              ...s,
              start_time: data.sentences[index - 1].end_time || 0,
            };
          }
          return s;
        });
        setSentences(processedSentences);
      }
    } catch (error) {
      console.error('获取材料失败:', error);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchData();
    return () => {
      // 清理音频
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [fetchData]);

  // 当切换句子时，更新编辑时间并跳转
  useEffect(() => {
    if (currentSentence) {
      setEditStartTime(currentSentence.start_time || 0);
      setEditEndTime(currentSentence.end_time || duration);
      
      // 跳转到开始时间
      if (soundRef.current) {
        soundRef.current.setPositionAsync(currentSentence.start_time || 0);
        setPosition(currentSentence.start_time || 0);
      }
    }
  }, [currentIndex, currentSentence, duration]);

  // 加载音频并获取真实时长
  const loadAudio = async () => {
    if (!audioUrl) return null;
    
    try {
      // 先卸载旧音频
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      
      // 获取真实时长
      if (status.isLoaded) {
        const realDuration = status.durationMillis || 0;
        console.log(`音频真实时长: ${realDuration}ms`);
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
        setPosition(0);
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

  // 播放/暂停
  const togglePlay = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (soundRef.current) {
      if (isPlaying) {
        await stopPlaying();
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    }
  };

  // 跳转到指定位置
  const seekTo = async (ms: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(ms);
      setPosition(ms);
    }
  };

  // 播放当前选择的区域
  const playSelection = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (!soundRef.current) return;
    
    const start = editStartTime;
    const end = editEndTime;
    
    await soundRef.current.setPositionAsync(start);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    // 播放到结束时间后停止
    const playDuration = end - start;
    setTimeout(async () => {
      if (soundRef.current && isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        setPosition(start); // 回到开始位置
      }
    }, playDuration);
  };

  // 确认当前时间戳设置
  const confirmTimestamp = async () => {
    const newSentences = [...sentences];
    
    // 设置当前句的时间
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(editStartTime),
      end_time: Math.round(editEndTime),
    };
    
    // 自动设置下一句的开始时间 = 当前句的结束时间
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: Math.round(editEndTime),
      };
    }
    
    setSentences(newSentences);
    
    // 自动跳到下一句
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的时间戳设置！' });
    }
  };

  // 自动检测语音开始位置
  const autoDetectStart = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    setDetecting(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/detect-speech-start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            from_time: editStartTime
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.speech_start !== undefined) {
        setEditStartTime(Math.round(data.speech_start));
        await seekTo(data.speech_start);
        setDialog({ 
          visible: true, 
          message: `检测到语音开始位置: ${formatTime(data.speech_start)}` 
        });
      } else {
        throw new Error(data.error || '检测失败');
      }
    } catch (error) {
      console.error('检测语音开始失败:', error);
      setDialog({ visible: true, message: `检测失败: ${(error as Error).message}` });
    } finally {
      setDetecting(false);
    }
  };

  // 上一句
  const prevSentence = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 下一句
  const nextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
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
        message: '时间戳保存成功！',
        onConfirm: () => router.back()
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

  // 点击时间轴跳转
  const handleTimelinePress = (evt: any) => {
    if (timelineWidth === 0 || duration === 0) return;
    
    const x = evt.nativeEvent.locationX;
    const time = (x / timelineWidth) * duration;
    seekTo(Math.max(0, Math.min(time, duration)));
  };

  // 计算时间轴上句子的位置
  const getSentenceStyle = (sentence: Sentence, index: number) => {
    const left = (sentence.start_time / duration) * 100;
    const width = ((sentence.end_time - sentence.start_time) / duration) * 100;
    const isActive = index === currentIndex;
    
    return {
      left: `${left}%` as const,
      width: `${width}%` as const,
      backgroundColor: isActive ? theme.primary : theme.textMuted,
      opacity: isActive ? 0.8 : 0.3,
    };
  };

  // 计算当前选择区域的样式
  const getSelectionStyle = () => {
    const left = (editStartTime / duration) * 100;
    const width = ((editEndTime - editStartTime) / duration) * 100;
    
    return {
      left: `${left}%` as const,
      width: `${Math.max(width, 1)}%` as const,
    };
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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
            时间轴切分
          </ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <FontAwesome6 name="check" size={20} color={theme.primary} />
            )}
          </TouchableOpacity>
        </View>
        <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
          {title} · 总时长 {formatTime(duration)}
        </ThemedText>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 进度指示 */}
        <View style={styles.progressRow}>
          <TouchableOpacity 
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]} 
            onPress={prevSentence}
            disabled={currentIndex === 0}
          >
            <FontAwesome6 name="chevron-left" size={14} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
          </TouchableOpacity>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>
            {currentIndex + 1} / {sentences.length}
          </ThemedText>
          <TouchableOpacity 
            style={[styles.navBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]} 
            onPress={nextSentence}
            disabled={currentIndex === sentences.length - 1}
          >
            <FontAwesome6 name="chevron-right" size={14} color={currentIndex === sentences.length - 1 ? theme.textMuted : theme.primary} />
          </TouchableOpacity>
        </View>

        {/* 当前句子卡片 */}
        <View style={styles.sentenceCard}>
          <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
            {currentSentence?.text}
          </ThemedText>
        </View>

        {/* 时间轴可视化 */}
        <View style={styles.timelineSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>
            时间轴（点击跳转）
          </ThemedText>
          
          {/* 时间轴容器 */}
          <View 
            style={styles.timelineContainer}
            onLayout={(e: LayoutChangeEvent) => setTimelineWidth(e.nativeEvent.layout.width)}
          >
            {/* 背景轨道 */}
            <View style={styles.timelineTrack}>
              {/* 已标记的句子区块 */}
              {sentences.map((sentence, index) => (
                <View
                  key={sentence.id}
                  style={[
                    styles.timelineBlock,
                    getSentenceStyle(sentence, index),
                  ]}
                />
              ))}
              
              {/* 当前选择区域 */}
              <View style={[styles.selectionBlock, getSelectionStyle()]}>
                {/* 播放位置指示器 */}
                {position >= editStartTime && position <= editEndTime && (
                  <View 
                    style={[
                      styles.playhead, 
                      { left: `${((position - editStartTime) / (editEndTime - editStartTime)) * 100}%` }
                    ]} 
                  />
                )}
              </View>
            </View>
            
            {/* 点击层 */}
            <View 
              style={styles.timelineTouchLayer}
              onTouchEnd={handleTimelinePress}
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

        {/* 双滑块范围选择器 */}
        <View style={styles.rangeSection}>
          {/* 开始时间滑块 */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabel}>
              <View style={[styles.sliderDot, { backgroundColor: theme.primary }]} />
              <ThemedText variant="small" color={theme.textSecondary}>开始时间</ThemedText>
              <ThemedText variant="bodyMedium" color={theme.primary}>{formatTime(editStartTime)}</ThemedText>
            </View>
            <View style={styles.sliderWrapper}>
              <Slider
                value={editStartTime}
                minimumValue={0}
                maximumValue={editEndTime - 100} // 开始不能超过结束
                onValueChange={setEditStartTime}
                onSlidingComplete={(value) => {
                  setEditStartTime(value);
                  seekTo(value);
                }}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
                style={styles.slider}
              />
            </View>
          </View>

          {/* 结束时间滑块 */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabel}>
              <View style={[styles.sliderDot, { backgroundColor: theme.success }]} />
              <ThemedText variant="small" color={theme.textSecondary}>结束时间</ThemedText>
              <ThemedText variant="bodyMedium" color={theme.success}>{formatTime(editEndTime)}</ThemedText>
            </View>
            <View style={styles.sliderWrapper}>
              <Slider
                value={editEndTime}
                minimumValue={editStartTime + 100} // 结束不能小于开始
                maximumValue={duration}
                onValueChange={setEditEndTime}
                onSlidingComplete={(value) => {
                  setEditEndTime(value);
                  seekTo(value);
                }}
                minimumTrackTintColor={theme.success}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.success}
                style={styles.slider}
              />
            </View>
          </View>

          {/* 选择时长显示 */}
          <View style={styles.durationInfo}>
            <ThemedText variant="small" color={theme.textMuted}>
              选择时长: {formatTime(editEndTime - editStartTime)}
            </ThemedText>
          </View>
        </View>

        {/* 播放控制 */}
        <View style={styles.playControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={togglePlay}>
            <FontAwesome6 
              name={isPlaying ? "pause" : "play"} 
              size={18} 
              color={theme.textPrimary} 
            />
            <ThemedText variant="small" color={theme.textPrimary}>
              {isPlaying ? '暂停' : '播放'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.controlBtn, styles.playSelectionBtn]} onPress={playSelection}>
            <FontAwesome6 name="repeat" size={18} color={theme.buttonPrimaryText} />
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              试听选中
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlBtn, { backgroundColor: theme.accent + '20' }]} 
            onPress={autoDetectStart}
            disabled={detecting}
          >
            {detecting ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <FontAwesome6 name="wand-magic-sparkles" size={18} color={theme.accent} />
            )}
            <ThemedText variant="small" color={theme.accent}>
              自动检测
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* 确认按钮 */}
        <TouchableOpacity style={styles.confirmBtn} onPress={confirmTimestamp}>
          <FontAwesome6 name="check" size={18} color={theme.buttonPrimaryText} />
          <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
            确认并继续下一句
          </ThemedText>
        </TouchableOpacity>

        {/* 使用提示 */}
        <View style={styles.tipBox}>
          <FontAwesome6 name="lightbulb" size={14} color={theme.accent} />
          <ThemedText variant="small" color={theme.textSecondary}>
            拖动滑块调整时间范围，点击时间轴快速跳转，点击「试听选中」检查效果
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
                index === currentIndex && styles.listItemActive
              ]}
              onPress={() => setCurrentIndex(index)}
            >
              <View style={[
                styles.listItemNumber,
                index === currentIndex && { backgroundColor: theme.primary }
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
                  {formatTime(sentence.start_time)} → {formatTime(sentence.end_time)}
                </ThemedText>
              </View>
              {index === currentIndex && (
                <FontAwesome6 name="play" size={12} color={theme.primary} />
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
