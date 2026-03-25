import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface SentenceFile {
  id: number;
  title: string;
  description?: string;
  original_audio_url: string;
  original_audio_signed_url?: string;
  original_duration?: number;
  text_content: string | null;
  status: string;
  created_at: string;
  sentences_count?: number;
}

interface Sentence {
  id: string;
  text: string;
  order: number;
}

export default function EditTextContentScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ fileId?: number }>();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  
  // 文件列表
  const [inputFiles, setInputFiles] = useState<SentenceFile[]>([]); // 待处理
  const [outputFiles, setOutputFiles] = useState<SentenceFile[]>([]); // 已归档
  const [currentFile, setCurrentFile] = useState<SentenceFile | null>(null); // 当前编辑
  
  const [textContent, setTextContent] = useState('');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  
  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingFileId, setPlayingFileId] = useState<number | null>(null);
  
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  
  const [successDialog, setSuccessDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; fileId: number | null; fileName?: string }>({
    visible: false,
    fileId: null,
    fileName: '',
  });
  const [deleting, setDeleting] = useState(false);

  // 清理音频资源
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  // 页面获得焦点时加载数据
  useFocusEffect(
    useCallback(() => {
      if (params.fileId) {
        loadFile(params.fileId);
      } else {
        loadAllFiles();
      }
    }, [params.fileId])
  );

  // 加载所有文件
  const loadAllFiles = async () => {
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const result = await response.json();
      
      if (result.files) {
        // 分类：输入端（待处理）和输出端（已归档）
        const inputs = result.files.filter((f: SentenceFile) => 
          f.status === 'audio_ready' || f.status === 'pending'
        );
        const outputs = result.files.filter((f: SentenceFile) => 
          f.status === 'text_ready' || f.status === 'completed'
        );
        setInputFiles(inputs);
        setOutputFiles(outputs);
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载单个文件
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
        setCurrentFile(result.file);
        if (result.file.text_content) {
          setTextContent(result.file.text_content);
          parseSentences(result.file.text_content);
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

  // 从音频提取文本
  const handleExtractText = async () => {
    if (!currentFile) return;
    
    setExtracting(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：POST /api/v1/sentence-files/:id/extract-text
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${currentFile.id}/extract-text`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 后端返回的是 text 字段
        const extractedText = result.text || result.text_content || '';
        if (extractedText) {
          setTextContent(extractedText);
          parseSentences(extractedText);
          setSuccessDialog({ visible: true, message: '文本提取成功' });
        } else {
          throw new Error('提取的文本为空');
        }
      } else {
        throw new Error(result.error || result.message || '提取失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `提取失败：${(error as Error).message}` });
    } finally {
      setExtracting(false);
    }
  };

  // 解析句子
  const parseSentences = (text: string) => {
    const lines = text.split(/\n\s*\n/);
    const parsed = lines
      .map((line, index) => line.trim())
      .filter(line => line.length > 0)
      .map((line, index) => ({
        id: `sentence-${index}`,
        text: line,
        order: index + 1,
      }));
    setSentences(parsed);
  };

  // 保存文本
  const handleSave = async () => {
    if (!currentFile) return;
    
    setSaving(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：PATCH /api/v1/sentence-files/:id
       * Path 参数：id: number
       * Body 参数：text_content: string, sentences?: Array
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${currentFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_content: textContent,
          sentences: sentences.map(s => ({ text: s.text, order: s.order })),
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新当前文件状态
        setCurrentFile(prev => prev ? { ...prev, status: 'text_ready', text_content: textContent } : null);
        setSuccessDialog({ visible: true, message: '文本保存成功！文件已移至输出端。' });
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `保存失败：${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  // ===== 音频播放功能 =====
  
  const togglePlayback = async (audioUrl: string, fileId: number) => {
    if (!audioUrl) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      if (soundRef.current && playingFileId === fileId) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && status.positionMillis >= (status.durationMillis || 0)) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      } else {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true, isLooping: false },
          (status) => {
            if (status.isLoaded) {
              setPlaybackPosition(status.positionMillis);
              setPlaybackDuration(status.durationMillis || 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackPosition(0);
                setPlayingFileId(null);
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
        setPlayingFileId(fileId);
      }
    } catch (error) {
      console.error('播放失败:', error);
      setErrorDialog({ visible: true, message: '音频播放失败' });
    }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.setPositionAsync(0);
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlayingFileId(null);
    }
  };

  const handleDownload = async (audioUrl: string, fileName: string) => {
    if (!audioUrl) return;

    try {
      if (Platform.OS === 'web') {
        // Web 端：在新标签页打开，用户可以在新标签页中下载
        window.open(audioUrl, '_blank');
      } else {
        if (await Sharing.isAvailableAsync()) {
          const cacheDir = (FileSystem as any).cacheDirectory || '';
          const downloadPath = `${cacheDir}${fileName}.mp3`;
          const downloadResult = await (FileSystem as any).downloadAsync(audioUrl, downloadPath);
          if (downloadResult.uri) {
            await Sharing.shareAsync(downloadResult.uri);
          }
        } else {
          // 使用系统浏览器打开
          await Linking.openURL(audioUrl);
        }
      }
    } catch (error) {
      console.error('下载失败:', error);
      setErrorDialog({ visible: true, message: '下载失败，请重试' });
    }
  };

  // 删除文件
  const handleDelete = async () => {
    const fileId = deleteConfirm.fileId;
    if (!fileId) return;
    
    setDeleting(true);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：DELETE /api/v1/sentence-files/:id
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${fileId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 如果删除的是当前编辑的文件
        if (currentFile && currentFile.id === fileId) {
          handleExitEdit();
        }
        // 刷新列表
        loadAllFiles();
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `删除失败：${(error as Error).message}` });
    } finally {
      setDeleting(false);
      setDeleteConfirm({ visible: false, fileId: null, fileName: '' });
    }
  };

  // 退出编辑
  const handleExitEdit = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setCurrentFile(null);
    setTextContent('');
    setSentences([]);
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setPlayingFileId(null);
    router.replace('/edit-text-content');
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 渲染文件卡片（输入端/输出端通用）
  const renderFileCard = (item: SentenceFile, isOutput: boolean = false) => {
    const audioUrl = item.original_audio_signed_url;
    const isCurrentPlaying = playingFileId === item.id && isPlaying;
    
    return (
      <View key={item.id} style={styles.fileCard}>
        <View style={styles.fileCardHeader}>
          <View style={[styles.fileCardIcon, isOutput && styles.fileCardIconOutput]}>
            <FontAwesome6 
              name={isOutput ? "file-lines" : "music"} 
              size={16} 
              color={isOutput ? theme.success : theme.primary} 
            />
          </View>
          <View style={styles.fileCardInfo}>
            <ThemedText variant="smallMedium" color={theme.textPrimary} numberOfLines={1}>
              {item.title}
            </ThemedText>
            <View style={styles.fileCardMeta}>
              {item.original_duration ? (
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {formatDuration(item.original_duration)}
                </ThemedText>
              ) : null}
              {item.sentences_count ? (
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {item.sentences_count} 句
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>
        
        <View style={styles.fileCardActions}>
          {/* 播放按钮 - 仅输入端 */}
          {!isOutput && audioUrl && (
            <TouchableOpacity 
              style={styles.fileCardActionButton}
              onPress={() => togglePlayback(audioUrl, item.id)}
            >
              <FontAwesome6 
                name={isCurrentPlaying ? "pause" : "play"} 
                size={12} 
                color={theme.buttonPrimaryText} 
              />
            </TouchableOpacity>
          )}
          
          {/* 下载按钮 */}
          {audioUrl && (
            <TouchableOpacity 
              style={[styles.fileCardActionButton, styles.fileCardActionSecondary]}
              onPress={() => handleDownload(audioUrl, item.title)}
            >
              <FontAwesome6 name="download" size={12} color={theme.textPrimary} />
            </TouchableOpacity>
          )}
          
          {/* 删除按钮 */}
          <TouchableOpacity 
            style={[styles.fileCardActionButton, styles.fileCardActionDelete]}
            onPress={() => setDeleteConfirm({ visible: true, fileId: item.id, fileName: item.title })}
          >
            <FontAwesome6 name="trash" size={12} color={theme.error} />
          </TouchableOpacity>
          
          {/* 主操作按钮 */}
          <TouchableOpacity 
            style={styles.fileCardMainButton}
            onPress={() => {
              if (isOutput) {
                // 输出端：查看详情
                router.push('/edit-sentence-audio', { fileId: item.id });
              } else {
                // 输入端：编辑文本
                router.push('/edit-text-content', { fileId: item.id });
              }
            }}
          >
            <ThemedText variant="small" color={theme.buttonPrimaryText}>
              {isOutput ? '查看' : '编辑'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ===== 编辑端界面 =====
  if (currentFile) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <ThemedView level="root" style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleExitEdit}>
                <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
                编辑文本
              </ThemedText>
              <View style={{ width: 20 }} />
            </View>
          </ThemedView>

          {/* 输入端：原始音频文件 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, styles.sectionIconInput]}>
                  <FontAwesome6 name="arrow-right-to-bracket" size={14} color={theme.primary} />
                </View>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>
                  输入端 · 原始音频
                </ThemedText>
              </View>
            </View>
            
            {currentFile.original_audio_signed_url && (
              <View style={styles.audioPlayerCard}>
                <View style={styles.audioPlayerHeader}>
                  <View style={styles.audioPlayerIcon}>
                    <FontAwesome6 name="music" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.audioPlayerInfo}>
                    <ThemedText variant="smallMedium" color={theme.textPrimary} numberOfLines={1}>
                      {currentFile.title}
                    </ThemedText>
                    {currentFile.original_duration ? (
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        时长: {formatDuration(currentFile.original_duration)}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                
                {/* 播放进度 */}
                {playbackDuration > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { width: `${(playbackPosition / playbackDuration) * 100}%`, backgroundColor: theme.primary }
                        ]} 
                      />
                    </View>
                    <View style={styles.timeRow}>
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {formatDuration(playbackPosition)}
                      </ThemedText>
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {formatDuration(playbackDuration)}
                      </ThemedText>
                    </View>
                  </View>
                )}
                
                {/* 控制按钮 */}
                <View style={styles.audioPlayerControls}>
                  <TouchableOpacity style={styles.controlButtonSmall} onPress={stopPlayback}>
                    <FontAwesome6 name="stop" size={14} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.playButtonSmall}
                    onPress={() => togglePlayback(currentFile.original_audio_signed_url!, currentFile.id)}
                  >
                    <FontAwesome6 
                      name={isPlaying && playingFileId === currentFile.id ? "pause" : "play"} 
                      size={18} 
                      color={theme.buttonPrimaryText} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.controlButtonSmall}
                    onPress={() => handleDownload(currentFile.original_audio_signed_url!, currentFile.title)}
                  >
                    <FontAwesome6 name="download" size={14} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.controlButtonSmall, styles.controlButtonDelete]}
                    onPress={() => setDeleteConfirm({ visible: true, fileId: currentFile.id, fileName: currentFile.title })}
                  >
                    <FontAwesome6 name="trash" size={14} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 编辑端：文本提取和编辑 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, styles.sectionIconEdit]}>
                  <FontAwesome6 name="pen-to-square" size={14} color={theme.accent} />
                </View>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>
                  编辑端 · 文本内容
                </ThemedText>
              </View>
              <ThemedText variant="tiny" color={theme.textMuted}>
                {sentences.length} 个句子
              </ThemedText>
            </View>
            
            {/* 提取按钮 */}
            <TouchableOpacity
              style={styles.extractButton}
              onPress={handleExtractText}
              disabled={extracting}
            >
              {extracting ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <>
                  <FontAwesome6 name="wand-magic-sparkles" size={16} color={theme.buttonPrimaryText} />
                  <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                    从音频提取文本
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
            
            {/* 文本编辑器 */}
            <TextInput
              style={styles.textEditor}
              value={textContent}
              onChangeText={(text) => {
                setTextContent(text);
                parseSentences(text);
              }}
              placeholder="输入或粘贴文本内容，空行分隔句子"
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
            />
            
            {/* 句子预览 */}
            {sentences.length > 0 && (
              <View style={styles.sentencesPreview}>
                {sentences.slice(0, 3).map((item, index) => (
                  <View key={item.id} style={styles.sentencePreviewItem}>
                    <View style={styles.sentenceNumber}>
                      <ThemedText variant="tiny" color={theme.buttonPrimaryText}>
                        {item.order}
                      </ThemedText>
                    </View>
                    <ThemedText variant="small" color={theme.textPrimary} numberOfLines={1}>
                      {item.text}
                    </ThemedText>
                  </View>
                ))}
                {sentences.length > 3 && (
                  <ThemedText variant="tiny" color={theme.textMuted} style={styles.moreSentences}>
                    ... 还有 {sentences.length - 3} 个句子
                  </ThemedText>
                )}
              </View>
            )}
            
            {/* 保存按钮 */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <>
                  <FontAwesome6 name="floppy-disk" size={16} color={theme.buttonPrimaryText} />
                  <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                    保存并归档
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* 输出端提示 */}
          <View style={styles.outputHint}>
            <FontAwesome6 name="arrow-right-from-bracket" size={14} color={theme.textMuted} />
            <ThemedText variant="small" color={theme.textMuted}>
              保存后，文件将移至「输出端」归档
            </ThemedText>
          </View>
        </ScrollView>

        {/* Dialogs */}
        <ConfirmDialog
          visible={errorDialog.visible}
          title="错误"
          message={errorDialog.message}
          confirmText="确定"
          onConfirm={() => setErrorDialog({ visible: false, message: '' })}
          onCancel={() => setErrorDialog({ visible: false, message: '' })}
        />
        
        <ConfirmDialog
          visible={successDialog.visible}
          title="成功"
          message={successDialog.message}
          confirmText="确定"
          onConfirm={() => {
            setSuccessDialog({ visible: false, message: '' });
            handleExitEdit();
          }}
          onCancel={() => setSuccessDialog({ visible: false, message: '' })}
        />
        
        <ConfirmDialog
          visible={deleteConfirm.visible}
          title="确认删除"
          message={`确定要删除「${deleteConfirm.fileName}」吗？删除后将无法恢复。`}
          confirmText="删除"
          cancelText="取消"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ visible: false, fileId: null, fileName: '' })}
        />
      </Screen>
    );
  }

  // ===== 主界面：输入端 + 输出端 =====
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
              置入句子文本
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/create-sentence-file')}>
              <FontAwesome6 name="plus" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            管理输入文件、编辑文本、归档输出
          </ThemedText>
        </ThemedView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {/* 输入端：待处理的原始音频 */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIcon, styles.sectionIconInput]}>
                    <FontAwesome6 name="arrow-right-to-bracket" size={14} color={theme.primary} />
                  </View>
                  <ThemedText variant="smallMedium" color={theme.textSecondary}>
                    输入端 · 原始音频
                  </ThemedText>
                </View>
                <View style={styles.sectionBadge}>
                  <ThemedText variant="tiny" color={theme.primary}>
                    {inputFiles.length} 待处理
                  </ThemedText>
                </View>
              </View>
              
              {inputFiles.length === 0 ? (
                <View style={styles.emptySection}>
                  <FontAwesome6 name="folder-open" size={24} color={theme.textMuted} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    暂无待处理文件
                  </ThemedText>
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => router.push('/create-sentence-file')}
                  >
                    <ThemedText variant="small" color={theme.buttonPrimaryText}>
                      上传文件
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                inputFiles.map(file => renderFileCard(file, false))
              )}
            </View>

            {/* 编辑端说明 */}
            <View style={styles.sectionDivider}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerIcon}>
                <FontAwesome6 name="pen-to-square" size={16} color={theme.accent} />
              </View>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.editHint}>
              <ThemedText variant="small" color={theme.textMuted}>
                点击「编辑」进入文本编辑界面
              </ThemedText>
            </View>

            {/* 输出端：已归档的文本文件 */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIcon, styles.sectionIconOutput]}>
                    <FontAwesome6 name="arrow-right-from-bracket" size={14} color={theme.success} />
                  </View>
                  <ThemedText variant="smallMedium" color={theme.textSecondary}>
                    输出端 · 已归档
                  </ThemedText>
                </View>
                <View style={[styles.sectionBadge, styles.sectionBadgeOutput]}>
                  <ThemedText variant="tiny" color={theme.success}>
                    {outputFiles.length} 已完成
                  </ThemedText>
                </View>
              </View>
              
              {outputFiles.length === 0 ? (
                <View style={styles.emptySection}>
                  <FontAwesome6 name="box-archive" size={24} color={theme.textMuted} />
                  <ThemedText variant="small" color={theme.textMuted}>
                    暂无归档文件
                  </ThemedText>
                </View>
              ) : (
                outputFiles.map(file => renderFileCard(file, true))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Dialogs */}
      <ConfirmDialog
        visible={errorDialog.visible}
        title="错误"
        message={errorDialog.message}
        confirmText="确定"
        onConfirm={() => setErrorDialog({ visible: false, message: '' })}
        onCancel={() => setErrorDialog({ visible: false, message: '' })}
      />
      
      <ConfirmDialog
        visible={deleteConfirm.visible}
        title="确认删除"
        message={`确定要删除「${deleteConfirm.fileName}」吗？删除后将无法恢复。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ visible: false, fileId: null, fileName: '' })}
      />
    </Screen>
  );
}
