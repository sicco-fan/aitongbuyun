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

interface WordTimestamp {
  word: string;
  start_time: number;
  end_time: number;
}

interface MatchResult {
  matched: boolean;
  start_time: number;
  end_time: number;
  confidence: { start: number; end: number };
  first_words: string[];
  last_words: string[];
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
  
  // 单词级时间戳数据
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  
  // 当前句子的匹配结果
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  
  // 编辑中的时间戳
  const [editStartTime, setEditStartTime] = useState(0);
  const [editEndTime, setEditEndTime] = useState(0);
  
  // 时间轴宽度
  const [timelineWidth, setTimelineWidth] = useState(0);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // 提示对话框
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  const currentSentence = sentences[currentIndex];

  // 获取材料详情和单词时间戳
  const fetchData = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      // 并行获取材料详情和单词时间戳
      const [materialRes, wordsRes] = await Promise.all([
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`),
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/word-timestamps`, {
          method: 'POST',
        }),
      ]);
      
      const materialData = await materialRes.json();
      const wordsData = await wordsRes.json();
      
      if (materialData.material) {
        setAudioUrl(materialData.material.audio_url || '');
        setDuration(materialData.material.duration || 0);
      }
      
      if (materialData.sentences && materialData.sentences.length > 0) {
        setSentences(materialData.sentences);
      }
      
      if (wordsData.words && wordsData.words.length > 0) {
        setWordTimestamps(wordsData.words);
        if (wordsData.duration) {
          setDuration(wordsData.duration);
        }
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

  // 当切换句子时，自动匹配并更新编辑时间
  useEffect(() => {
    if (currentSentence && duration > 0) {
      setEditStartTime(currentSentence.start_time || 0);
      setEditEndTime(currentSentence.end_time || duration);
      
      // 自动匹配当前句子
      autoMatchSentence(currentSentence.text);
      
      // 跳转到开始位置
      if (soundRef.current) {
        soundRef.current.setPositionAsync(currentSentence.start_time || 0);
        setPosition(currentSentence.start_time || 0);
      }
    }
  }, [currentIndex, currentSentence, duration]);

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

  // 自动匹配句子位置
  const autoMatchSentence = async (sentenceText: string) => {
    if (!sentenceText || wordTimestamps.length === 0) {
      setMatchResult(null);
      return;
    }
    
    setIsMatching(true);
    try {
      // 本地匹配（使用已加载的单词时间戳）
      const sentenceWords = sentenceText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const firstWords = sentenceWords.slice(0, 3);
      const lastWords = sentenceWords.slice(-3);
      
      // 清理标点的函数
      const cleanWord = (w: string) => w.replace(/[.,!?;:'"]/g, '').toLowerCase();
      
      // 在音频单词列表中查找匹配
      const lowerWords = wordTimestamps.map(w => ({
        ...w,
        wordLower: cleanWord(w.word),
      }));
      
      // 查找前N个单词的起始位置
      let startMatch = { index: -1, confidence: 0 };
      for (let i = 0; i <= lowerWords.length - firstWords.length; i++) {
        const slice = lowerWords.slice(i, i + firstWords.length);
        const matchCount = slice.filter((w, idx) => {
          const fw = cleanWord(firstWords[idx]);
          return w.wordLower === fw || w.wordLower.includes(fw) || fw.includes(w.wordLower);
        }).length;
        
        const confidence = matchCount / firstWords.length;
        if (confidence > startMatch.confidence && confidence >= 0.5) {
          startMatch = { index: i, confidence };
        }
      }
      
      // 查找后N个单词的结束位置
      let endMatch = { index: -1, confidence: 0 };
      for (let i = firstWords.length; i <= lowerWords.length; i++) {
        const slice = lowerWords.slice(i - lastWords.length, i);
        const matchCount = slice.filter((w, idx) => {
          const lw = cleanWord(lastWords[idx]);
          return w.wordLower === lw || w.wordLower.includes(lw) || lw.includes(w.wordLower);
        }).length;
        
        const confidence = matchCount / lastWords.length;
        if (confidence > endMatch.confidence && confidence >= 0.5) {
          endMatch = { index: i, confidence };
        }
      }
      
      // 计算时间戳
      let startTime = 0;
      let endTime = duration;
      let matched = false;
      
      if (startMatch.index >= 0 && endMatch.index > startMatch.index) {
        startTime = lowerWords[startMatch.index].start_time;
        endTime = lowerWords[endMatch.index - 1].end_time;
        matched = true;
      } else if (startMatch.index >= 0) {
        startTime = lowerWords[startMatch.index].start_time;
        const avgWordDuration = wordTimestamps.length > 1 ?
          (wordTimestamps[wordTimestamps.length - 1].end_time - wordTimestamps[0].start_time) / wordTimestamps.length :
          500;
        endTime = startTime + sentenceWords.length * avgWordDuration;
        matched = true;
      }
      
      const result: MatchResult = {
        matched,
        start_time: Math.round(startTime),
        end_time: Math.round(endTime),
        confidence: { start: startMatch.confidence, end: endMatch.confidence },
        first_words: firstWords,
        last_words: lastWords,
      };
      
      setMatchResult(result);
      
      // 如果匹配成功，自动更新编辑时间
      if (matched) {
        setEditStartTime(Math.round(startTime));
        setEditEndTime(Math.round(endTime));
      }
    } catch (error) {
      console.error('自动匹配失败:', error);
    } finally {
      setIsMatching(false);
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
    
    const playDuration = end - start;
    setTimeout(async () => {
      if (soundRef.current && isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        setPosition(start);
      }
    }, playDuration);
  };

  // 确认当前时间戳并跳转下一句
  const confirmAndNext = async () => {
    const newSentences = [...sentences];
    
    // 更新当前句
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(editStartTime),
      end_time: Math.round(editEndTime),
    };
    
    // 自动设置下一句的开始时间
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: Math.round(editEndTime),
      };
    }
    
    setSentences(newSentences);
    
    // 跳转下一句或完成
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的时间戳设置！' });
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

  // 点击时间轴跳转
  const handleTimelinePress = (evt: any) => {
    if (timelineWidth === 0 || duration === 0) return;
    const x = evt.nativeEvent.locationX;
    const time = (x / timelineWidth) * duration;
    seekTo(Math.max(0, Math.min(time, duration)));
  };

  // 计算选择区域样式
  const getSelectionStyle = () => {
    if (duration === 0) return { left: '0%' as const, width: '100%' as const };
    const left = (editStartTime / duration) * 100;
    const width = ((editEndTime - editStartTime) / duration) * 100;
    return {
      left: `${left}%` as const,
      width: `${Math.max(width, 1)}%` as const,
    };
  };

  // 获取单词在时间轴上的位置
  const getWordMarkers = () => {
    if (wordTimestamps.length === 0 || duration === 0 || timelineWidth === 0) return [];
    
    // 只显示当前选择区域附近的单词
    return wordTimestamps
      .filter(w => w.start_time >= editStartTime - 2000 && w.end_time <= editEndTime + 2000)
      .slice(0, 20); // 最多显示20个单词
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            正在加载音频数据...
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
            onPress={() => setCurrentIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <FontAwesome6 name="chevron-left" size={14} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
          </TouchableOpacity>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>
            {currentIndex + 1} / {sentences.length}
          </ThemedText>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
            onPress={() => setCurrentIndex(currentIndex + 1)}
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
          
          {/* 匹配信息 */}
          {matchResult && (
            <View style={styles.matchInfo}>
              <View style={styles.matchLabels}>
                <View style={styles.matchLabelItem}>
                  <View style={[styles.matchDot, { backgroundColor: theme.primary }]} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    前3词: {matchResult.first_words.join(' ')}
                  </ThemedText>
                </View>
                <View style={styles.matchLabelItem}>
                  <View style={[styles.matchDot, { backgroundColor: theme.success }]} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    后3词: {matchResult.last_words.join(' ')}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.matchStatus}>
                {matchResult.matched ? (
                  <View style={styles.matchSuccess}>
                    <FontAwesome6 name="circle-check" size={14} color={theme.success} />
                    <ThemedText variant="small" color={theme.success}>
                      自动匹配成功 ({Math.round(matchResult.confidence.start * 100)}%)
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText variant="small" color={theme.error}>
                    未找到匹配，请手动调整
                  </ThemedText>
                )}
              </View>
            </View>
          )}
        </View>

        {/* 时间轴可视化 */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeader}>
            <ThemedText variant="smallMedium" color={theme.textSecondary}>
              时间轴（点击跳转）
            </ThemedText>
            <TouchableOpacity onPress={() => autoMatchSentence(currentSentence?.text)}>
              {isMatching ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <View style={styles.rematchBtn}>
                  <FontAwesome6 name="wand-magic-sparkles" size={14} color={theme.accent} />
                  <ThemedText variant="small" color={theme.accent}>重新匹配</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* 时间轴容器 */}
          <View
            style={styles.timelineContainer}
            onLayout={(e: LayoutChangeEvent) => setTimelineWidth(e.nativeEvent.layout.width)}
          >
            {/* 背景轨道 */}
            <View style={styles.timelineTrack}>
              {/* 当前选择区域 */}
              <View style={[styles.selectionBlock, getSelectionStyle()]}>
                {/* 前词标记 */}
                {matchResult?.matched && (
                  <>
                    <View style={[styles.wordMarker, styles.startMarker]} />
                    <View style={[styles.wordMarker, styles.endMarker]} />
                  </>
                )}
              </View>
            </View>

            {/* 播放位置指示器 */}
            {duration > 0 && (
              <View
                style={[
                  styles.playhead,
                  { left: `${(position / duration) * 100}%` as const },
                ]}
              />
            )}

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
              {formatTime(editStartTime)} → {formatTime(editEndTime)}
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
              <ThemedText variant="small" color={theme.textSecondary}>开始</ThemedText>
              <ThemedText variant="bodyMedium" color={theme.primary}>{formatTime(editStartTime)}</ThemedText>
            </View>
            <View style={styles.sliderWrapper}>
              <Slider
                value={editStartTime}
                minimumValue={0}
                maximumValue={Math.max(editEndTime - 100, 0)}
                onValueChange={setEditStartTime}
                onSlidingComplete={(value) => seekTo(value)}
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
              <ThemedText variant="small" color={theme.textSecondary}>结束</ThemedText>
              <ThemedText variant="bodyMedium" color={theme.success}>{formatTime(editEndTime)}</ThemedText>
            </View>
            <View style={styles.sliderWrapper}>
              <Slider
                value={editEndTime}
                minimumValue={editStartTime + 100}
                maximumValue={duration}
                onValueChange={setEditEndTime}
                onSlidingComplete={(value) => seekTo(value)}
                minimumTrackTintColor={theme.success}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.success}
                style={styles.slider}
              />
            </View>
          </View>

          {/* 选择时长 */}
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
        </View>

        {/* 确认按钮 */}
        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndNext}>
          <FontAwesome6 name="check" size={18} color={theme.buttonPrimaryText} />
          <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
            确认并继续下一句
          </ThemedText>
        </TouchableOpacity>

        {/* 使用提示 */}
        <View style={styles.tipBox}>
          <FontAwesome6 name="lightbulb" size={14} color={theme.accent} />
          <ThemedText variant="small" color={theme.textSecondary}>
            系统已自动根据句子的前3个词和后3个词匹配位置，拖动滑块可微调
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
