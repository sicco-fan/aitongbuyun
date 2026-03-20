import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Text,
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
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionRef = useRef<number>(0);
  
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
        setSentences(data.sentences);
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

  // 加载音频
  const loadAudio = async () => {
    if (!audioUrl) return;
    
    try {
      // 先卸载旧音频
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
    } catch (error) {
      console.error('加载音频失败:', error);
    }
  };

  // 播放状态更新
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      positionRef.current = status.positionMillis;
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  // 播放/暂停
  const togglePlay = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (soundRef.current) {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
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

  // 设置开始时间
  const setStartTime = () => {
    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(position),
    };
    setSentences(newSentences);
  };

  // 设置结束时间
  const setEndTime = () => {
    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      end_time: Math.round(position),
    };
    setSentences(newSentences);
  };

  // 播放当前句子
  const playCurrentSentence = async () => {
    if (!soundRef.current || !currentSentence) return;
    
    const start = currentSentence.start_time || 0;
    const end = currentSentence.end_time || duration;
    
    await soundRef.current.setPositionAsync(start);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    // 播放到结束时间后停止
    const playDuration = end - start;
    setTimeout(async () => {
      if (soundRef.current && isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      }
    }, playDuration);
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
      // 更新每个句子的时间戳
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
            时间戳设置
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
          {title}
        </ThemedText>
      </View>

      <View style={styles.content}>
        {/* 进度指示 */}
        <View style={styles.progressRow}>
          <ThemedText variant="caption" color={theme.textMuted}>
            句子 {currentIndex + 1} / {sentences.length}
          </ThemedText>
        </View>

        {/* 当前句子卡片 */}
        <View style={styles.sentenceCard}>
          <View style={styles.sentenceNav}>
            <TouchableOpacity 
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
              onPress={prevSentence}
              disabled={currentIndex === 0}
            >
              <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
            </TouchableOpacity>
            
            <View style={styles.sentenceContent}>
              <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
                {currentSentence?.text}
              </ThemedText>
            </View>
            
            <TouchableOpacity 
              style={[styles.navBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
              onPress={nextSentence}
              disabled={currentIndex === sentences.length - 1}
            >
              <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? theme.textMuted : theme.primary} />
            </TouchableOpacity>
          </View>
          
          {/* 时间显示 */}
          <View style={styles.timeRow}>
            <View style={styles.timeBox}>
              <ThemedText variant="caption" color={theme.textMuted}>开始</ThemedText>
              <ThemedText variant="h4" color={theme.primary}>
                {formatTime(currentSentence?.start_time || 0)}
              </ThemedText>
            </View>
            <View style={styles.timeBox}>
              <ThemedText variant="caption" color={theme.textMuted}>结束</ThemedText>
              <ThemedText variant="h4" color={theme.success}>
                {formatTime(currentSentence?.end_time || duration)}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* 音频播放器 */}
        <View style={styles.playerSection}>
          {/* 进度条 */}
          <View style={styles.progressBar}>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {formatTime(position)}
            </Text>
            <View style={styles.sliderContainer}>
              <Slider
                value={position}
                minimumValue={0}
                maximumValue={duration}
                onValueChange={(value) => seekTo(value)}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
                style={styles.slider}
              />
            </View>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {formatTime(duration)}
            </Text>
          </View>
          
          {/* 播放控制 */}
          <View style={styles.playControls}>
            <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
              <FontAwesome6 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color={theme.buttonPrimaryText} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playSentenceBtn} onPress={playCurrentSentence}>
              <FontAwesome6 name="repeat" size={20} color={theme.buttonPrimaryText} />
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>播放当前句</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* 时间戳设置按钮 */}
        <View style={styles.timestampButtons}>
          <TouchableOpacity style={[styles.timestampBtn, styles.startBtn]} onPress={setStartTime}>
            <FontAwesome6 name="play" size={16} color={theme.buttonPrimaryText} />
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              设为开始 ({formatTime(position)})
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.timestampBtn, styles.endBtn]} onPress={setEndTime}>
            <FontAwesome6 name="stop" size={16} color={theme.buttonPrimaryText} />
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              设为结束 ({formatTime(position)})
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* 句子列表预览 */}
        <View style={styles.listSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>
            所有句子
          </ThemedText>
          <ScrollView style={styles.scrollView}>
            {sentences.map((sentence, index) => (
              <TouchableOpacity 
                key={sentence.id}
                style={[
                  styles.listItem,
                  index === currentIndex && styles.listItemActive
                ]}
                onPress={() => setCurrentIndex(index)}
              >
                <View style={styles.listItemNumber}>
                  <ThemedText variant="caption" color={index === currentIndex ? theme.buttonPrimaryText : theme.textMuted}>
                    {index + 1}
                  </ThemedText>
                </View>
                <ThemedText 
                  variant="small" 
                  color={index === currentIndex ? theme.textPrimary : theme.textSecondary}
                  numberOfLines={1}
                  style={styles.listItemText}
                >
                  {sentence.text}
                </ThemedText>
                <ThemedText variant="caption" color={theme.textMuted}>
                  {formatTime(sentence.start_time)}-{formatTime(sentence.end_time)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

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
