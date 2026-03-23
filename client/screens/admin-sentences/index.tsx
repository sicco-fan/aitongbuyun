import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';

// 后端服务地址 - 直接连接后端服务器，不经过 Metro 代理
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Sentence {
  id: number;
  material_id: number;
  sentence_index: number;
  text: string;
  start_time: number;
  end_time: number;
  attempts: number;
  is_completed: boolean;
}

interface Material {
  id: number;
  title: string;
  audio_url: string;
  duration: number;
}

export default function AdminSentencesScreen() {
  const { materialId, title } = useSafeSearchParams<{ materialId: number; title: string }>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const [material, setMaterial] = useState<Material | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // 编辑表单
  const [editText, setEditText] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  
  // 分割模式 - 改进版
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [splitSentence, setSplitSentence] = useState<Sentence | null>(null);
  const [splitText, setSplitText] = useState(''); // 分割点的文本
  const [splitStartTime, setSplitStartTime] = useState(''); // 新句子的开始时间
  
  // 音频播放
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playingSentenceId, setPlayingSentenceId] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    fetchMaterial();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [materialId]);

  const fetchMaterial = async () => {
    if (!materialId) return;

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const data = await response.json();

      if (data.material && data.sentences) {
        setMaterial(data.material);
        setSentences(data.sentences.sort((a: Sentence, b: Sentence) => a.sentence_index - b.sentence_index));
      }
    } catch (error) {
      console.error('加载材料失败:', error);
      Alert.alert('错误', '加载材料失败');
    } finally {
      setLoading(false);
    }
  };

  // 播放指定时间段的音频
  const playAudioSegment = async (sentence: Sentence) => {
    if (!material?.audio_url) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      setPlayingSentenceId(sentence.id);

      const { sound } = await Audio.Sound.createAsync(
        { uri: material.audio_url },
        { shouldPlay: true, positionMillis: sentence.start_time },
        (status) => {
          if (status.isLoaded) {
            setCurrentTime(status.positionMillis);
            
            if (status.positionMillis >= sentence.end_time || status.didJustFinish) {
              sound.stopAsync();
              setIsPlaying(false);
              setPlayingSentenceId(null);
            }
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      console.error('播放失败:', error);
      Alert.alert('播放失败', '无法播放音频');
    }
  };

  // 停止播放
  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      setPlayingSentenceId(null);
    }
  };

  // 打开编辑弹窗
  const openEditModal = (sentence: Sentence) => {
    setEditingSentence(sentence);
    setEditText(sentence.text);
    setEditStartTime(sentence.start_time.toString());
    setEditEndTime(sentence.end_time.toString());
    setEditModalVisible(true);
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingSentence) return;

    if (!editText.trim()) {
      Alert.alert('错误', '句子文本不能为空');
      return;
    }

    const startTime = parseInt(editStartTime) || 0;
    const endTime = parseInt(editEndTime) || 0;

    if (endTime <= startTime) {
      Alert.alert('错误', '结束时间必须大于开始时间');
      return;
    }

    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${editingSentence.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: editText.trim(),
            start_time: startTime,
            end_time: endTime,
          }),
        }
      );

      if (response.ok) {
        setSentences(prev =>
          prev.map(s =>
            s.id === editingSentence.id
              ? { ...s, text: editText.trim(), start_time: startTime, end_time: endTime }
              : s
          )
        );
        setEditModalVisible(false);
        Alert.alert('成功', '句子已更新');
      } else {
        throw new Error('更新失败');
      }
    } catch (error) {
      console.error('更新句子失败:', error);
      Alert.alert('错误', '更新句子失败');
    }
  };

  // 删除句子
  const deleteSentence = async (sentence: Sentence) => {
    Alert.alert(
      '删除句子',
      `确定要删除「${sentence.text.substring(0, 30)}${sentence.text.length > 30 ? '...' : ''}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${sentence.id}`,
                { method: 'DELETE' }
              );

              if (response.ok) {
                await fetchMaterial();
                Alert.alert('成功', '句子已删除');
              } else {
                throw new Error('删除失败');
              }
            } catch (error) {
              console.error('删除句子失败:', error);
              Alert.alert('错误', '删除句子失败');
            }
          },
        },
      ]
    );
  };

  // 打开分割弹窗 - 改进版
  const openSplitModal = (sentence: Sentence) => {
    setSplitSentence(sentence);
    // 默认在中间位置分割
    const midPoint = Math.floor(sentence.text.length / 2);
    setSplitText(sentence.text.substring(midPoint).trim());
    // 默认时间在中间
    const midTime = Math.round((sentence.start_time + sentence.end_time) / 2);
    setSplitStartTime(midTime.toString());
    setSplitModalVisible(true);
  };

  // 执行分割
  const executeSplit = async () => {
    if (!splitSentence) return;

    const splitTime = parseInt(splitStartTime) || 0;

    if (splitTime <= splitSentence.start_time || splitTime >= splitSentence.end_time) {
      Alert.alert('错误', '分割时间必须在当前句子的时间范围内');
      return;
    }

    try {
      // 找到分割点在文本中的位置
      const textAfter = splitText.trim();
      const textBefore = splitSentence.text.replace(textAfter, '').trim();

      if (!textBefore || !textAfter) {
        Alert.alert('错误', '分割后的文本不能为空');
        return;
      }

      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/split-sentence/${splitSentence.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            split_position: splitSentence.text.indexOf(textAfter),
            new_start_time: splitTime,
            new_end_time: splitSentence.end_time,
          }),
        }
      );

      if (response.ok) {
        await fetchMaterial();
        setSplitModalVisible(false);
        setSplitSentence(null);
        Alert.alert('成功', '句子已分割');
      } else {
        const error = await response.json();
        throw new Error(error.error || '分割失败');
      }
    } catch (error: any) {
      console.error('分割句子失败:', error);
      Alert.alert('错误', error.message || '分割句子失败');
    }
  };

  // 添加新句子
  const addSentence = () => {
    Alert.prompt(
      '添加句子',
      '请输入句子文本',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '添加',
          onPress: async (text?: string) => {
            if (!text?.trim()) return;

            try {
              const lastSentence = sentences[sentences.length - 1];
              const startTime = lastSentence ? lastSentence.end_time : 0;

              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: text.trim(),
                    start_time: startTime,
                    end_time: startTime + 3000,
                  }),
                }
              );

              if (response.ok) {
                await fetchMaterial();
                Alert.alert('成功', '句子已添加');
              } else {
                throw new Error('添加失败');
              }
            } catch (error) {
              console.error('添加句子失败:', error);
              Alert.alert('错误', '添加句子失败');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // 格式化时间
  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return minutes > 0 ? `${minutes}:${secs.padStart(5, '0')}` : `${secs}s`;
  };

  // 时间滑块组件
  const TimeSlider = ({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) => {
    const percentage = ((value - min) / (max - min)) * 100;
    
    return (
      <View style={{ marginVertical: Spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
          <ThemedText variant="caption" color={theme.textMuted}>{formatTime(min)}</ThemedText>
          <ThemedText variant="smallMedium" color={theme.primary}>{formatTime(value)}</ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>{formatTime(max)}</ThemedText>
        </View>
        <View style={{
          height: 40,
          backgroundColor: theme.backgroundTertiary,
          borderRadius: BorderRadius.md,
          position: 'relative',
        }}>
          <View style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 18,
            height: 4,
            backgroundColor: theme.border,
          }} />
          <View style={{
            position: 'absolute',
            left: `${percentage}%`,
            top: 10,
            width: 20,
            height: 20,
            backgroundColor: theme.primary,
            borderRadius: 10,
            marginLeft: -10,
          }} />
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.md,
            paddingTop: 10,
          }}>
            <TouchableOpacity onPress={() => onChange(Math.max(min, value - 100))} style={{ padding: Spacing.sm }}>
              <FontAwesome6 name="backward" size={16} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(Math.min(max, value + 100))} style={{ padding: Spacing.sm }}>
              <FontAwesome6 name="forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
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

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.headerTitle}>
              {title || material?.title}
            </ThemedText>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.timestampBtn}
                onPress={() => router.push('/timestamp-editor', { materialId: materialId, title: title })}
              >
                <FontAwesome6 name="sliders" size={16} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={addSentence}>
                <FontAwesome6 name="plus" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <ThemedText variant="small" color={theme.textMuted}>
            共 {sentences.length} 句 · 点击句子播放对应音频 · 长按编辑
          </ThemedText>
        </ThemedView>

        {/* Sentences List */}
        <View style={styles.sentencesSection}>
          {sentences.map((sentence, index) => {
            const isCurrentPlaying = playingSentenceId === sentence.id;
            
            return (
              <TouchableOpacity
                key={sentence.id}
                style={[
                  styles.sentenceCard,
                  isCurrentPlaying && { borderColor: theme.primary, borderWidth: 2 }
                ]}
                onPress={() => isCurrentPlaying ? stopPlayback() : playAudioSegment(sentence)}
                onLongPress={() => openEditModal(sentence)}
              >
                <View style={styles.sentenceHeader}>
                  <View style={[styles.sentenceIndex, isCurrentPlaying && { backgroundColor: theme.success }]}>
                    <ThemedText variant="captionMedium" color={theme.buttonPrimaryText}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    {formatTime(sentence.start_time)} - {formatTime(sentence.end_time)}
                  </ThemedText>
                  <View style={styles.sentenceDuration}>
                    <ThemedText variant="caption" color={theme.primary}>
                      {(sentence.end_time - sentence.start_time) / 1000}s
                    </ThemedText>
                  </View>
                </View>
                
                <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
                  {sentence.text}
                </ThemedText>

                <View style={styles.sentenceActions}>
                  <TouchableOpacity
                    style={styles.sentenceActionBtn}
                    onPress={() => playAudioSegment(sentence)}
                  >
                    <FontAwesome6 name={isCurrentPlaying ? "stop" : "play"} size={12} color={theme.primary} />
                    <ThemedText variant="caption" color={theme.primary}>
                      {isCurrentPlaying ? '停止' : '播放'}
                    </ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.sentenceActionBtn}
                    onPress={() => openEditModal(sentence)}
                  >
                    <FontAwesome6 name="pen" size={12} color={theme.textSecondary} />
                    <ThemedText variant="caption" color={theme.textSecondary}>编辑</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.sentenceActionBtn}
                    onPress={() => openSplitModal(sentence)}
                  >
                    <FontAwesome6 name="scissors" size={12} color={theme.accent} />
                    <ThemedText variant="caption" color={theme.accent}>分割</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.sentenceActionBtn}
                    onPress={() => deleteSentence(sentence)}
                  >
                    <FontAwesome6 name="trash" size={12} color={theme.error} />
                    <ThemedText variant="caption" color={theme.error}>删除</ThemedText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              编辑句子
            </ThemedText>

            <View style={styles.formGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>文本内容</ThemedText>
              <TextInput
                style={[styles.textInput, { minHeight: 80 }]}
                value={editText}
                onChangeText={setEditText}
                multiline
                numberOfLines={3}
                placeholder="输入句子文本"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>开始时间 (ms)</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={editStartTime}
                  onChangeText={setEditStartTime}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>结束时间 (ms)</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={editEndTime}
                  onChangeText={setEditEndTime}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText variant="smallMedium" color={theme.textPrimary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveEdit}
              >
                <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>保存</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Split Modal - 改进版 */}
      <Modal
        visible={splitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSplitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 450 }]}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              分割句子
            </ThemedText>

            {splitSentence && (
              <>
                {/* 原句信息 */}
                <View style={[styles.infoBox, { backgroundColor: theme.backgroundTertiary, marginBottom: Spacing.md }]}>
                  <ThemedText variant="caption" color={theme.textMuted}>原句</ThemedText>
                  <ThemedText variant="body" color={theme.textPrimary} style={{ marginTop: Spacing.xs }}>
                    {splitSentence.text}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: Spacing.xs }}>
                    时间：{formatTime(splitSentence.start_time)} - {formatTime(splitSentence.end_time)}
                  </ThemedText>
                </View>

                {/* 时间选择器 */}
                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText variant="smallMedium" color={theme.textSecondary}>分割时间点</ThemedText>
                    <TouchableOpacity
                      onPress={() => {
                        if (splitSentence) {
                          const splitTime = parseInt(splitStartTime) || splitSentence.start_time;
                          playAudioSegment({
                            ...splitSentence,
                            end_time: splitTime + 500, // 播放分割点前后一小段
                          });
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}
                    >
                      <FontAwesome6 name="play" size={12} color={theme.primary} />
                      <ThemedText variant="caption" color={theme.primary}>试听</ThemedText>
                    </TouchableOpacity>
                  </View>
                  
                  <TimeSlider
                    value={parseInt(splitStartTime) || Math.round((splitSentence.start_time + splitSentence.end_time) / 2)}
                    min={splitSentence.start_time}
                    max={splitSentence.end_time}
                    onChange={(v) => setSplitStartTime(v.toString())}
                  />
                  
                  <TextInput
                    style={styles.textInput}
                    value={splitStartTime}
                    onChangeText={setSplitStartTime}
                    keyboardType="numeric"
                    placeholder="输入分割时间点 (ms)"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                {/* 分割后的后半句文本 */}
                <View style={styles.formGroup}>
                  <ThemedText variant="smallMedium" color={theme.textSecondary}>后半句文本（可编辑）</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    value={splitText}
                    onChangeText={setSplitText}
                    placeholder="分割后的后半部分文本"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                {/* 预览 */}
                <View style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
                  <View style={[styles.previewBox, { backgroundColor: theme.success + '15', borderColor: theme.success }]}>
                    <ThemedText variant="caption" color={theme.success}>前半句（将保留原句ID）</ThemedText>
                    <ThemedText variant="small" color={theme.textPrimary}>
                      {splitSentence.text.replace(splitText.trim(), '').trim() || '(空)'}
                    </ThemedText>
                  </View>
                  <View style={[styles.previewBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
                    <ThemedText variant="caption" color={theme.primary}>后半句（将创建新句子）</ThemedText>
                    <ThemedText variant="small" color={theme.textPrimary}>
                      {splitText.trim() || '(空)'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setSplitModalVisible(false)}
                  >
                    <ThemedText variant="smallMedium" color={theme.textPrimary}>取消</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={executeSplit}
                  >
                    <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>确认分割</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
