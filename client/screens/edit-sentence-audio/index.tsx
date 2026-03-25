import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AudioPlayer } from '@/components/AudioPlayer';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface SentenceItem {
  id: number;
  sentence_file_id: number;
  text: string;
  order_number: number;
  start_time: number | null;
  end_time: number | null;
  audio_url: string | null;
}

interface SentenceFile {
  id: number;
  title: string;
  original_audio_signed_url?: string;  // 原始音频签名URL
  text_content: string | null;
  status: string;
}

export default function EditSentenceAudioScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ fileId?: number }>();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [file, setFile] = useState<SentenceFile | null>(null);
  const [sentences, setSentences] = useState<SentenceItem[]>([]);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  
  const [successDialog, setSuccessDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // 如果有fileId参数，直接加载该文件
  useEffect(() => {
    if (params.fileId) {
      loadFile(params.fileId);
    }
  }, [params.fileId]);

  // 加载文件和句子数据
  const loadFile = async (fileId: number) => {
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files/:id
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${fileId}`);
      const result = await response.json();
      
      if (result.file) {
        setFile(result.file);
        
        // 如果已经有句子数据，加载它们
        if (result.file.sentences && result.file.sentences.length > 0) {
          setSentences(result.file.sentences);
        } else if (result.file.text_content) {
          // 否则从文本内容创建句子
          const lines = result.file.text_content.split(/\n\s*\n/);
          const newSentences = lines
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .map((line: string, index: number) => ({
              id: 0, // 新句子没有ID
              sentence_file_id: fileId,
              text: line,
              order_number: index + 1,
              start_time: null,
              end_time: null,
              audio_url: null,
            }));
          setSentences(newSentences);
        }
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `加载失败：${(error as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  // 更新句子的时间戳
  const updateTimeStamp = (index: number, field: 'start_time' | 'end_time', value: number) => {
    setSentences(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // 设置开始时间为当前播放时间
  const setStartTimeFromCurrent = (index: number) => {
    updateTimeStamp(index, 'start_time', Math.floor(currentPlayTime * 100) / 100);
  };

  // 设置结束时间为当前播放时间
  const setEndTimeFromCurrent = (index: number) => {
    updateTimeStamp(index, 'end_time', Math.floor(currentPlayTime * 100) / 100);
  };

  // 保存时间戳数据
  const handleSave = async () => {
    if (!file) {
      setErrorDialog({ visible: true, message: '请先加载文件' });
      return;
    }
    
    setSaving(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：POST /api/v1/sentence-files/:id/sentences
       * Path 参数：id: number
       * Body 参数：sentences: Array<{ text: string, order_number: number, start_time?: number, end_time?: number }>
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/sentences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccessDialog({ visible: true, message: '时间戳保存成功' });
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `保存失败：${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  // 生成句子语音片段
  const handleGenerateAudio = async () => {
    if (!file) {
      setErrorDialog({ visible: true, message: '请先加载文件' });
      return;
    }
    
    // 检查是否所有句子都有时间戳
    const hasMissingTimestamps = sentences.some(s => s.start_time === null || s.end_time === null);
    if (hasMissingTimestamps) {
      setErrorDialog({ visible: true, message: '请先为所有句子设置时间戳' });
      return;
    }
    
    setProcessing(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：POST /api/v1/sentence-files/:id/generate-audio
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/generate-audio`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccessDialog({ visible: true, message: '语音片段生成成功！句库制作完成。' });
        // 重新加载数据
        if (file) {
          loadFile(file.id);
        }
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `生成失败：${(error as Error).message}` });
    } finally {
      setProcessing(false);
    }
  };

  // 格式化时间（秒 -> mm:ss.SS）
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--.--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  };

  // 渲染句子编辑器
  const renderSentenceEditor = (sentence: SentenceItem, index: number) => {
    const isSelected = selectedSentenceIndex === index;
    
    return (
      <TouchableOpacity
        key={sentence.id || index}
        style={[styles.sentenceCard, isSelected && styles.sentenceCardSelected]}
        onPress={() => setSelectedSentenceIndex(index)}
        activeOpacity={0.8}
      >
        <View style={styles.sentenceHeader}>
          <View style={styles.sentenceNumber}>
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              {sentence.order_number}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.textMuted}>
            {formatTime(sentence.start_time)} - {formatTime(sentence.end_time)}
          </ThemedText>
        </View>
        
        <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
          {sentence.text}
        </ThemedText>
        
        <View style={styles.timeEditor}>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setStartTimeFromCurrent(index)}
          >
            <FontAwesome6 name="backward" size={14} color={theme.textMuted} />
            <ThemedText variant="small" color={theme.textMuted}>
              设置开始
            </ThemedText>
          </TouchableOpacity>
          
          <TextInput
            style={styles.timeInput}
            value={sentence.start_time?.toString() || ''}
            onChangeText={(text) => updateTimeStamp(index, 'start_time', parseFloat(text) || 0)}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
          
          <TextInput
            style={styles.timeInput}
            value={sentence.end_time?.toString() || ''}
            onChangeText={(text) => updateTimeStamp(index, 'end_time', parseFloat(text) || 0)}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
          
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setEndTimeFromCurrent(index)}
          >
            <FontAwesome6 name="forward" size={14} color={theme.textMuted} />
            <ThemedText variant="small" color={theme.textMuted}>
              设置结束
            </ThemedText>
          </TouchableOpacity>
        </View>
        
        {sentence.audio_url && (
          <View style={styles.audioStatus}>
            <FontAwesome6 name="circle-check" size={14} color={theme.success} />
            <ThemedText variant="small" color={theme.success}>
              已生成语音
            </ThemedText>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
              剪辑句子语音
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            为每个句子分配时间戳
          </ThemedText>
        </ThemedView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText variant="body" color={theme.textMuted}>
              加载中...
            </ThemedText>
          </View>
        ) : file ? (
          <>
            {/* File Info */}
            <View style={styles.fileInfoCard}>
              <View style={styles.fileInfoHeader}>
                <FontAwesome6 name="file-audio" size={24} color={theme.primary} />
                <View style={styles.fileInfoContent}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    {file.title}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    {sentences.length} 个句子
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Audio Player */}
            <View style={styles.playerSection}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>
                音频播放器
              </ThemedText>
              <AudioPlayer
                uri={file.original_audio_signed_url || ''}
                onTimeUpdate={setCurrentPlayTime}
                onDurationLoad={setDuration}
              />
              <View style={styles.currentTimeDisplay}>
                <ThemedText variant="caption" color={theme.textMuted}>
                  当前时间: {formatTime(currentPlayTime)} / 总时长: {formatTime(duration)}
                </ThemedText>
              </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>
                操作说明
              </ThemedText>
              <View style={styles.instructionList}>
                <View style={styles.instructionItem}>
                  <FontAwesome6 name="1" size={14} color={theme.primary} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    点击句子卡片选中
                  </ThemedText>
                </View>
                <View style={styles.instructionItem}>
                  <FontAwesome6 name="2" size={14} color={theme.primary} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    播放音频定位到句子开始位置
                  </ThemedText>
                </View>
                <View style={styles.instructionItem}>
                  <FontAwesome6 name="3" size={14} color={theme.primary} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    点击「设置开始/结束」按钮记录时间
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Sentences List */}
            <View style={styles.sentencesSection}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>
                句子列表
              </ThemedText>
              <View style={styles.sentencesList}>
                {sentences.map((sentence, index) => renderSentenceEditor(sentence, index))}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.buttonPrimaryText} />
                ) : (
                  <>
                    <FontAwesome6 name="floppy-disk" size={18} color={theme.buttonPrimaryText} />
                    <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                      保存时间戳
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.generateButton, processing && styles.generateButtonDisabled]}
                onPress={handleGenerateAudio}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color={theme.buttonPrimaryText} />
                ) : (
                  <>
                    <FontAwesome6 name="wand-magic-sparkles" size={18} color={theme.buttonPrimaryText} />
                    <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                      生成语音片段
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="folder-open" size={48} color={theme.textMuted} />
            <ThemedText variant="body" color={theme.textMuted}>
              请先完成文本编辑
            </ThemedText>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/edit-text-content')}
            >
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                编辑文本
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Error Dialog */}
      <ConfirmDialog
        visible={errorDialog.visible}
        title="错误"
        message={errorDialog.message}
        confirmText="确定"
        onConfirm={() => setErrorDialog({ visible: false, message: '' })}
        onCancel={() => setErrorDialog({ visible: false, message: '' })}
      />

      {/* Success Dialog */}
      <ConfirmDialog
        visible={successDialog.visible}
        title="成功"
        message={successDialog.message}
        confirmText="确定"
        onConfirm={() => setSuccessDialog({ visible: false, message: '' })}
        onCancel={() => setSuccessDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}
