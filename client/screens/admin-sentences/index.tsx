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
import { Spacing } from '@/constants/theme';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

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
  
  // 分割模式
  const [splitMode, setSplitMode] = useState(false);
  const [splitSentence, setSplitSentence] = useState<Sentence | null>(null);
  const [splitPosition, setSplitPosition] = useState(0);
  
  // 音频播放
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackStatusRef = useRef<any>(null);

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
  const playAudioSegment = async (startTime: number, endTime: number) => {
    if (!material?.audio_url) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: material.audio_url },
        { shouldPlay: true, positionMillis: startTime },
        (status) => {
          if (status.isLoaded) {
            setCurrentTime(status.positionMillis);
            playbackStatusRef.current = status;
            
            if (status.positionMillis >= endTime) {
              sound.stopAsync();
              setIsPlaying(false);
            }
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      console.error('播放失败:', error);
    }
  };

  // 播放整段音频
  const playFullAudio = async () => {
    if (!material?.audio_url) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: material.audio_url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setCurrentTime(status.positionMillis);
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      console.error('播放失败:', error);
    }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
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

    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：PUT /api/v1/materials/:id/sentences/:sentenceId
       * Body 参数：text: string, start_time: number, end_time: number
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${editingSentence.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: editText,
            start_time: parseInt(editStartTime) || 0,
            end_time: parseInt(editEndTime) || 0,
          }),
        }
      );

      if (response.ok) {
        setSentences(prev =>
          prev.map(s =>
            s.id === editingSentence.id
              ? { ...s, text: editText, start_time: parseInt(editStartTime) || 0, end_time: parseInt(editEndTime) || 0 }
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
      `确定要删除「${sentence.text.substring(0, 20)}...」吗？`,
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
                await fetchMaterial(); // 重新加载以获取更新后的索引
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

  // 开始分割句子
  const startSplit = (sentence: Sentence) => {
    setSplitSentence(sentence);
    setSplitPosition(0);
    setSplitMode(true);
  };

  // 执行分割
  const executeSplit = async () => {
    if (!splitSentence || splitPosition <= 0 || splitPosition >= splitSentence.text.length) {
      Alert.alert('错误', '请选择有效的分割位置');
      return;
    }

    try {
      const textBefore = splitSentence.text.substring(0, splitPosition).trim();
      const textAfter = splitSentence.text.substring(splitPosition).trim();

      // 计算新的时间（按字符数比例估算）
      const ratio = textBefore.length / splitSentence.text.length;
      const midTime = splitSentence.start_time + (splitSentence.end_time - splitSentence.start_time) * ratio;

      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：POST /api/v1/materials/:id/split-sentence/:sentenceId
       * Body 参数：split_position: number, new_start_time?: number, new_end_time?: number
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/split-sentence/${splitSentence.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            split_position: splitPosition,
            new_start_time: Math.round(midTime),
          }),
        }
      );

      if (response.ok) {
        await fetchMaterial();
        setSplitMode(false);
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
  const addSentence = async () => {
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

              /**
               * 服务端文件：server/src/routes/materials.ts
               * 接口：POST /api/v1/materials/:id/sentences
               * Body 参数：text: string, start_time?: number, end_time?: number
               */
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: text.trim(),
                    start_time: startTime,
                    end_time: startTime + 3000, // 默认3秒
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
    return `${seconds.toFixed(2)}s`;
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
            <TouchableOpacity onPress={addSentence}>
              <FontAwesome6 name="plus" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <ThemedText variant="small" color={theme.textMuted}>
            共 {sentences.length} 句 · 点击句子可预览音频
          </ThemedText>
        </ThemedView>

        {/* Audio Controls */}
        <View style={styles.audioControls}>
          <TouchableOpacity
            style={[styles.audioButton, isPlaying && styles.audioButtonActive]}
            onPress={isPlaying ? stopPlayback : playFullAudio}
          >
            <FontAwesome6
              name={isPlaying ? 'stop' : 'play'}
              size={16}
              color={theme.buttonPrimaryText}
            />
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              {isPlaying ? '停止' : '播放全部'}
            </ThemedText>
          </TouchableOpacity>
          {isPlaying && (
            <ThemedText variant="caption" color={theme.textMuted}>
              当前: {formatTime(currentTime)}
            </ThemedText>
          )}
        </View>

        {/* Sentences List */}
        <View style={styles.sentencesSection}>
          {sentences.map((sentence, index) => (
            <TouchableOpacity
              key={sentence.id}
              style={styles.sentenceCard}
              onPress={() => playAudioSegment(sentence.start_time, sentence.end_time)}
              onLongPress={() => openEditModal(sentence)}
            >
              <View style={styles.sentenceHeader}>
                <View style={styles.sentenceIndex}>
                  <ThemedText variant="captionMedium" color={theme.buttonPrimaryText}>
                    {index + 1}
                  </ThemedText>
                </View>
                <ThemedText variant="caption" color={theme.textMuted}>
                  {formatTime(sentence.start_time)} - {formatTime(sentence.end_time)}
                </ThemedText>
              </View>
              
              <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
                {sentence.text}
              </ThemedText>

              <View style={styles.sentenceActions}>
                <TouchableOpacity
                  style={styles.sentenceActionBtn}
                  onPress={() => playAudioSegment(sentence.start_time, sentence.end_time)}
                >
                  <FontAwesome6 name="play" size={12} color={theme.primary} />
                  <ThemedText variant="caption" color={theme.primary}>播放</ThemedText>
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
                  onPress={() => startSplit(sentence)}
                >
                  <FontAwesome6 name="scissors" size={12} color={theme.textSecondary} />
                  <ThemedText variant="caption" color={theme.textSecondary}>分割</ThemedText>
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
          ))}
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
              <ThemedText variant="smallMedium" color={theme.textSecondary}>文本</ThemedText>
              <TextInput
                style={styles.textInput}
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

      {/* Split Modal */}
      <Modal
        visible={splitMode}
        transparent
        animationType="slide"
        onRequestClose={() => setSplitMode(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              分割句子
            </ThemedText>

            {splitSentence && (
              <>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.splitOriginal}>
                  原句：{splitSentence.text}
                </ThemedText>

                <View style={styles.formGroup}>
                  <ThemedText variant="smallMedium" color={theme.textSecondary}>
                    分割位置（从第几个字符后分割）
                  </ThemedText>
                  <TextInput
                    style={styles.textInput}
                    value={splitPosition.toString()}
                    onChangeText={(v) => setSplitPosition(parseInt(v) || 0)}
                    keyboardType="numeric"
                    placeholder="输入位置"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                {splitPosition > 0 && splitPosition < splitSentence.text.length && (
                  <View style={styles.splitPreview}>
                    <ThemedText variant="small" color={theme.success}>
                      前半句：{splitSentence.text.substring(0, splitPosition).trim()}
                    </ThemedText>
                    <ThemedText variant="small" color={theme.primary}>
                      后半句：{splitSentence.text.substring(splitPosition).trim()}
                    </ThemedText>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setSplitMode(false)}
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
