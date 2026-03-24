import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
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
  original_audio_url: string;
  original_audio_signed_url?: string;
  original_duration?: number;
  text_content: string | null;
  status: string;
  created_at: string;
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
  
  const [fileList, setFileList] = useState<SentenceFile[]>([]);
  const [file, setFile] = useState<SentenceFile | null>(null);
  const [textContent, setTextContent] = useState('');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  
  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // 当前播放的文件ID（用于列表页）
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; fileId: number | null }>({
    visible: false,
    fileId: null,
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

  // 加载文件列表
  const loadFileList = async () => {
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const result = await response.json();
      
      if (result.files) {
        setFileList(result.files);
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 如果有fileId参数，直接加载该文件
  useEffect(() => {
    if (params.fileId) {
      loadFile(params.fileId);
    } else {
      // 没有fileId时加载文件列表
      loadFileList();
    }
  }, [params.fileId]);

  // 加载指定文件
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
    if (!file) {
      setErrorDialog({ visible: true, message: '请先选择句库文件' });
      return;
    }
    
    setExtracting(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：POST /api/v1/sentence-files/:id/extract-text
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/extract-text`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success && result.text_content) {
        setTextContent(result.text_content);
        parseSentences(result.text_content);
        setSuccessDialog({ visible: true, message: '文本提取成功' });
      } else {
        throw new Error(result.error || '提取失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `提取失败：${(error as Error).message}` });
    } finally {
      setExtracting(false);
    }
  };

  // 解析句子（按空行分割）
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

  // 保存文本内容
  const handleSave = async () => {
    if (!file) {
      setErrorDialog({ visible: true, message: '请先选择句库文件' });
      return;
    }
    
    setSaving(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：PATCH /api/v1/sentence-files/:id
       * Path 参数：id: number
       * Body 参数：text_content: string, sentences?: Array<{ text: string, order: number }>
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_content: textContent,
          sentences: sentences.map(s => ({ text: s.text, order: s.order })),
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccessDialog({ visible: true, message: '文本保存成功，可以进入下一步' });
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `保存失败：${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  // 文本内容变化时重新解析句子
  const handleTextChange = (text: string) => {
    setTextContent(text);
    parseSentences(text);
  };

  // ===== 音频播放功能 =====
  
  // 播放/暂停音频
  const togglePlayback = async (audioUrl: string, fileId?: number) => {
    if (!audioUrl) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      if (soundRef.current) {
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
        if (fileId) setPlayingFileId(fileId);
      }
    } catch (error) {
      console.error('播放失败:', error);
      setErrorDialog({ visible: true, message: '音频播放失败' });
    }
  };

  // 停止播放
  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.setPositionAsync(0);
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlayingFileId(null);
    }
  };

  // 下载音频
  const handleDownload = async (audioUrl: string, fileName: string) => {
    if (!audioUrl) return;

    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `${fileName}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        if (await Sharing.isAvailableAsync()) {
          const cacheDir = (FileSystem as any).cacheDirectory || '';
          const downloadPath = `${cacheDir}${fileName}.mp3`;
          const downloadResult = await (FileSystem as any).downloadAsync(
            audioUrl,
            downloadPath
          );
          
          if (downloadResult.uri) {
            await Sharing.shareAsync(downloadResult.uri);
          }
        } else {
          await WebBrowser.openBrowserAsync(audioUrl);
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
      // 停止播放
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：DELETE /api/v1/sentence-files/:id
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${fileId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 如果在详情页删除，返回列表页
        if (file && file.id === fileId) {
          setFile(null);
          setTextContent('');
          setSentences([]);
          loadFileList();
        } else {
          // 刷新列表
          loadFileList();
        }
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `删除失败：${(error as Error).message}` });
    } finally {
      setDeleting(false);
      setDeleteConfirm({ visible: false, fileId: null });
    }
  };

  // 格式化时长
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 渲染句子项
  const renderSentenceItem = ({ item, index }: { item: Sentence; index: number }) => (
    <View style={styles.sentenceItem}>
      <View style={styles.sentenceNumber}>
        <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
          {item.order}
        </ThemedText>
      </View>
      <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
        {item.text}
      </ThemedText>
    </View>
  );

  // 渲染音频播放器卡片
  const renderAudioPlayer = (audioFile: SentenceFile, compact: boolean = false) => {
    const audioUrl = audioFile.original_audio_signed_url;
    
    return (
      <View style={compact ? styles.audioCardCompact : styles.audioCard}>
        <View style={styles.audioHeader}>
          <View style={styles.audioIconContainer}>
            <FontAwesome6 name="music" size={compact ? 20 : 24} color={theme.primary} />
          </View>
          <View style={styles.audioInfo}>
            <ThemedText variant={compact ? "smallMedium" : "bodyMedium"} color={theme.textPrimary} numberOfLines={1}>
              {audioFile.title}
            </ThemedText>
            {audioFile.original_duration ? (
              <ThemedText variant="caption" color={theme.textMuted}>
                {formatDuration(audioFile.original_duration)}
              </ThemedText>
            ) : null}
          </View>
        </View>

        {/* 播放进度 - 仅详情页显示 */}
        {!compact && playbackDuration > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${(playbackPosition / playbackDuration) * 100}%`,
                    backgroundColor: theme.primary 
                  }
                ]} 
              />
            </View>
            <View style={styles.timeRow}>
              <ThemedText variant="caption" color={theme.textMuted}>
                {formatDuration(playbackPosition)}
              </ThemedText>
              <ThemedText variant="caption" color={theme.textMuted}>
                {formatDuration(playbackDuration)}
              </ThemedText>
            </View>
          </View>
        )}

        {/* 播放控制 */}
        <View style={styles.playbackControls}>
          {!compact && (
            <TouchableOpacity 
              style={styles.controlButtonSmall} 
              onPress={stopPlayback}
              disabled={!isPlaying && playbackPosition === 0}
            >
              <FontAwesome6 
                name="stop" 
                size={16} 
                color={(!isPlaying && playbackPosition === 0) ? theme.textMuted : theme.textPrimary} 
              />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={compact ? styles.playButtonCompact : styles.playButton} 
            onPress={() => togglePlayback(audioUrl!, audioFile.id)}
          >
            <FontAwesome6 
              name={isPlaying && (playingFileId === audioFile.id || file?.id === audioFile.id) ? "pause" : "play"} 
              size={compact ? 20 : 28} 
              color={theme.buttonPrimaryText} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButtonSmall} 
            onPress={() => handleDownload(audioUrl!, audioFile.title)}
          >
            <FontAwesome6 name="download" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButtonSmall} 
            onPress={() => setDeleteConfirm({ visible: true, fileId: audioFile.id })}
          >
            <FontAwesome6 name="trash" size={16} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => {
              if (file) {
                setFile(null);
                setTextContent('');
                setSentences([]);
                loadFileList();
              } else {
                router.back();
              }
            }}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
              置入句子文本
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            从音频提取文本，按空行分句
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
            {/* 音频播放器 */}
            {file.original_audio_signed_url && renderAudioPlayer(file)}

            {/* Extract Button */}
            <TouchableOpacity
              style={styles.extractButton}
              onPress={handleExtractText}
              disabled={extracting}
            >
              {extracting ? (
                <ActivityIndicator color={theme.buttonPrimaryText} />
              ) : (
                <>
                  <FontAwesome6 name="wand-magic-sparkles" size={20} color={theme.buttonPrimaryText} />
                  <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                    从音频提取文本
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            {/* Text Editor */}
            <View style={styles.editorSection}>
              <View style={styles.editorHeader}>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>
                  文本内容
                </ThemedText>
                <ThemedText variant="caption" color={theme.textMuted}>
                  {sentences.length} 个句子
                </ThemedText>
              </View>
              <TextInput
                style={styles.textEditor}
                value={textContent}
                onChangeText={handleTextChange}
                placeholder="输入或粘贴文本内容，空行分隔句子"
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Sentences Preview */}
            {sentences.length > 0 && (
              <View style={styles.previewSection}>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>
                  句子预览
                </ThemedText>
                <View style={styles.sentencesList}>
                  {sentences.slice(0, 5).map((item, index) => (
                    <React.Fragment key={item.id}>
                      {renderSentenceItem({ item, index })}
                    </React.Fragment>
                  ))}
                  {sentences.length > 5 && (
                    <ThemedText variant="small" color={theme.textMuted} style={styles.moreText}>
                      ... 还有 {sentences.length - 5} 个句子
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

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
                      保存文本
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
              
              {sentences.length > 0 && (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={() => router.push('/edit-sentence-audio', { fileId: file.id })}
                >
                  <ThemedText variant="bodyMedium" color={theme.primary}>
                    下一步：剪辑语音
                  </ThemedText>
                  <FontAwesome6 name="arrow-right" size={16} color={theme.primary} />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            {/* 文件列表 */}
            <View style={styles.fileListSection}>
              <View style={styles.fileListHeader}>
                <ThemedText variant="smallMedium" color={theme.textSecondary}>
                  已上传的文件
                </ThemedText>
                <TouchableOpacity onPress={() => router.push('/create-sentence-file')}>
                  <ThemedText variant="smallMedium" color={theme.primary}>
                    + 新建
                  </ThemedText>
                </TouchableOpacity>
              </View>
              
              {fileList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <FontAwesome6 name="folder-open" size={48} color={theme.textMuted} />
                  <ThemedText variant="body" color={theme.textMuted}>
                    暂无文件，请先上传
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => router.push('/create-sentence-file')}
                  >
                    <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                      上传文件
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                fileList.map((item) => (
                  <View key={item.id} style={styles.fileItemWrapper}>
                    {/* 音频播放器 - 紧凑版 */}
                    {item.original_audio_signed_url && renderAudioPlayer(item, true)}
                    
                    {/* 操作按钮 */}
                    <View style={styles.fileItemActions}>
                      <TouchableOpacity
                        style={styles.fileItemActionButton}
                        onPress={() => loadFile(item.id)}
                      >
                        <FontAwesome6 name="pen-to-square" size={14} color={theme.primary} />
                        <ThemedText variant="small" color={theme.primary}>
                          编辑文本
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
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

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        visible={deleteConfirm.visible}
        title="确认删除"
        message="确定要删除这个文件吗？删除后将无法恢复。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ visible: false, fileId: null })}
      />
    </Screen>
  );
}
