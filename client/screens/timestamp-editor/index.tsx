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
  const [detecting, setDetecting] = useState(false);
  
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
        // 时长可能很大，先设置，后面加载音频时会获取真实时长
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

  // 当切换句子时，自动跳转到该句的开始时间
  useEffect(() => {
    if (currentSentence && soundRef.current) {
      const startPos = currentSentence.start_time || 0;
      soundRef.current.setPositionAsync(startPos);
      setPosition(startPos);
    }
  }, [currentIndex]);

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

  // 设置开始时间（通常只需要第一句设置）
  const setStartTime = () => {
    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(position),
    };
    setSentences(newSentences);
  };

  // 设置结束时间（核心功能：立即停止 + 自动连锁到下一句）
  const setEndTime = async () => {
    // 立即停止播放
    await stopPlaying();
    
    const endTime = Math.round(position);
    const newSentences = [...sentences];
    
    // 设置当前句的结束时间
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      end_time: endTime,
    };
    
    // 自动设置下一句的开始时间 = 当前句的结束时间
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: endTime,
      };
    }
    
    setSentences(newSentences);
    
    // 自动跳到下一句
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // 自动检测语音开始位置（调用后端静音检测）
  const autoDetectStart = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    setDetecting(true);
    try {
      // 调用后端 API 检测语音开始位置
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/detect-speech-start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            from_time: currentSentence?.start_time || 0 
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.speech_start !== undefined) {
        // 跳转到检测到的语音开始位置
        await seekTo(data.speech_start);
        
        // 设置开始时间
        const newSentences = [...sentences];
        newSentences[currentIndex] = {
          ...newSentences[currentIndex],
          start_time: Math.round(data.speech_start),
        };
        setSentences(newSentences);
        
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

  // 播放当前句子
  const playCurrentSentence = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (!soundRef.current || !currentSentence) return;
    
    const start = currentSentence.start_time || 0;
    const end = currentSentence.end_time || duration;
    
    await soundRef.current.setPositionAsync(start);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    // 播放到结束时间后停止
    const playDuration = end - start;
    setTimeout(async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        setPosition(start); // 回到开始位置
      }
    }, playDuration);
  };

  // 播放剩余音频（从当前位置到结束）
  const playRemaining = async () => {
    if (!soundRef.current) {
      await loadAudio();
    }
    
    if (!soundRef.current) return;
    
    // 从当前句的开始位置播放
    const start = currentSentence?.start_time || 0;
    await soundRef.current.setPositionAsync(start);
    await soundRef.current.playAsync();
    setIsPlaying(true);
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
          {title} | 总时长: {formatTime(duration)}
        </ThemedText>
      </View>

      <View style={styles.content}>
        {/* 进度指示 */}
        <View style={styles.progressRow}>
          <ThemedText variant="caption" color={theme.textMuted}>
            句子 {currentIndex + 1} / {sentences.length} 
            {currentIndex === 0 && ' (请先设置开始时间)'}
            {currentIndex > 0 && ' (只需设置结束时间)'}
          </ThemedText>
        </View>

        {/* 当前句子卡片 - 完整显示文字 */}
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
              {currentIndex > 0 && (
                <ThemedText variant="caption" color={theme.textMuted}>(自动)</ThemedText>
              )}
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
              <FontAwesome6 name="repeat" size={16} color={theme.buttonPrimaryText} />
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>当前句</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.playSentenceBtn, { backgroundColor: theme.textSecondary }]} onPress={playRemaining}>
              <FontAwesome6 name="forward" size={16} color={theme.buttonPrimaryText} />
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>剩余</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* 时间戳设置按钮 */}
        <View style={styles.timestampButtons}>
          {/* 第一句需要设置开始时间，其他句自动继承 */}
          {currentIndex === 0 ? (
            <>
              <TouchableOpacity 
                style={[styles.timestampBtn, styles.startBtn]} 
                onPress={setStartTime}
              >
                <FontAwesome6 name="play" size={16} color={theme.buttonPrimaryText} />
                <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                  设为开始
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.timestampBtn, styles.detectBtn]} 
                onPress={autoDetectStart}
                disabled={detecting}
              >
                {detecting ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <FontAwesome6 name="wand-magic-sparkles" size={16} color={theme.buttonPrimaryText} />
                )}
                <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                  自动检测
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.timestampBtn, styles.detectBtn]} 
              onPress={autoDetectStart}
              disabled={detecting}
            >
              {detecting ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <FontAwesome6 name="wand-magic-sparkles" size={16} color={theme.buttonPrimaryText} />
              )}
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                自动检测语音开始
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* 设为结束按钮 - 突出显示 */}
        <TouchableOpacity style={styles.endBtnLarge} onPress={setEndTime}>
          <FontAwesome6 name="stop" size={20} color={theme.buttonPrimaryText} />
          <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
            设为结束 ({formatTime(position)})
          </ThemedText>
        </TouchableOpacity>

        {/* 使用提示 */}
        <View style={styles.tipBox}>
          <FontAwesome6 name="lightbulb" size={14} color={theme.accent} />
          <ThemedText variant="small" color={theme.textSecondary}>
            点击「设为结束」会立即停止播放，并自动跳到下一句
          </ThemedText>
        </View>

        {/* 句子列表预览 */}
        <View style={styles.listSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>
            所有句子（点击跳转）
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
                <View style={styles.listItemContent}>
                  <ThemedText 
                    variant="small" 
                    color={index === currentIndex ? theme.textPrimary : theme.textSecondary}
                    style={styles.listItemText}
                  >
                    {sentence.text}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    {formatTime(sentence.start_time)} → {formatTime(sentence.end_time)}
                  </ThemedText>
                </View>
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
