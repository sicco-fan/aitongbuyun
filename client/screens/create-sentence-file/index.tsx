import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { useSafeRouter } from '@/hooks/useSafeRouter';
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

// 支持的音频格式
const AUDIO_FORMATS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'aiff'];
const VIDEO_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', '3gp', 'wmv'];
const ALL_FORMATS = [...AUDIO_FORMATS, ...VIDEO_FORMATS];

interface FileInfo {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  file?: File; // Web 端使用
}

interface SentenceFile {
  id: number;
  title: string;
  description: string;
  original_audio_url: string;
  original_audio_signed_url: string;
  original_duration: number;
  text_content: string | null;
  status: string;
  sentences_count: number;
}

interface UploadedFile {
  id: number;
  title: string;
  description: string;
  original_audio_url: string;
  original_audio_signed_url: string;
  original_duration: number;
  status: string;
}

export default function CreateSentenceFileScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<FileInfo | null>(null);
  const [importMode, setImportMode] = useState<'upload' | 'link'>('upload');
  const [linkUrl, setLinkUrl] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // 上传成功后的文件信息
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  
  // 已创建的文件列表
  const [fileList, setFileList] = useState<SentenceFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  
  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playingFileId, setPlayingFileId] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
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

  // 页面获得焦点时加载文件列表
  useFocusEffect(
    useCallback(() => {
      loadFileList();
    }, [])
  );

  // 加载文件列表
  const loadFileList = async () => {
    setLoadingList(true);
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
      setLoadingList(false);
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  // 从相册选择（视频/图片）
  const pickFromGallery = async () => {
    if (Platform.OS === 'web') {
      // Web 端使用原生 input 元素
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ALL_FORMATS.map(f => `.${f}`).join(',') + ',audio/*,video/*';
      
      input.onchange = async (e: any) => {
        const selectedFile = e.target?.files?.[0];
        if (selectedFile) {
          setFile({
            uri: URL.createObjectURL(selectedFile),
            name: selectedFile.name,
            size: selectedFile.size,
            mimeType: selectedFile.type || 'application/octet-stream',
            file: selectedFile,
          });
        }
      };
      
      input.click();
      return;
    }

    // 移动端先请求权限
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setErrorDialog({ visible: true, message: '需要相册权限才能选择文件' });
      return;
    }

    // 从相册选择
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos', 'images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let fileName = asset.fileName;
      
      if (!fileName) {
        const uriParts = asset.uri.split('/');
        fileName = uriParts[uriParts.length - 1] || `file_${Date.now()}`;
      }
      
      const mimeType = asset.mimeType || 'application/octet-stream';
      
      setFile({
        uri: asset.uri,
        name: fileName,
        size: asset.fileSize || 0,
        mimeType,
      });
    }
  };

  // 从文件系统选择（支持所有文档类型）
  const pickFromFileSystem = async () => {
    if (Platform.OS === 'web') {
      // Web 端使用原生 input 元素，支持音频文件
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ALL_FORMATS.map(f => `.${f}`).join(',') + ',audio/*,video/*';
      
      input.onchange = async (e: any) => {
        const selectedFile = e.target?.files?.[0];
        if (selectedFile) {
          setFile({
            uri: URL.createObjectURL(selectedFile),
            name: selectedFile.name,
            size: selectedFile.size,
            mimeType: selectedFile.type || 'application/octet-stream',
            file: selectedFile,
          });
        }
      };
      
      input.click();
      return;
    }

    // 移动端使用 DocumentPicker
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/*',
          'video/*',
          ...AUDIO_FORMATS.map(f => `audio/${f}`),
          ...VIDEO_FORMATS.map(f => `video/${f}`),
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      console.error('文件选择失败:', error);
      setErrorDialog({ visible: true, message: '文件选择失败，请重试' });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorDialog({ visible: true, message: '请输入标题' });
      return;
    }

    if (importMode === 'upload' && !file) {
      setErrorDialog({ visible: true, message: '请选择音频或视频文件' });
      return;
    }

    if (importMode === 'link' && !linkUrl.trim()) {
      setErrorDialog({ visible: true, message: '请输入链接地址' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('准备上传...');

    console.log('===== 开始上传 =====');
    console.log('importMode:', importMode);
    console.log('file:', file ? { name: file.name, size: file.size, mimeType: file.mimeType } : null);
    console.log('title:', title);

    try {
      if (importMode === 'link') {
        // 链接导入
        setUploadStatus('正在从链接下载...');
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/from-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkUrl, title }),
        });
        
        const result = await response.json();
        
        if (result.success && result.file) {
          setUploadedFile(result.file);
          setUploadProgress(100);
          loadFileList(); // 刷新列表
        } else {
          throw new Error(result.error || '导入失败');
        }
      } else {
        // 文件上传
        const fileSizeMB = (file!.size / 1024 / 1024).toFixed(2);
        
        if (Platform.OS === 'web' && file!.file) {
          // Web 端上传
          setUploadStatus(`上传中... (${fileSizeMB} MB)`);
          
          const formData = new FormData();
          formData.append('file', file!.file);
          formData.append('title', title);
          if (description) {
            formData.append('description', description);
          }
          
          const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`, {
            method: 'POST',
            body: formData,
          });
          
          const result = await response.json();
          
          if (result.success && result.file) {
            setUploadProgress(100);
            setUploadedFile(result.file);
            loadFileList(); // 刷新列表
          } else {
            throw new Error(result.error || '上传失败');
          }
        } else {
          // 移动端上传 - 使用 FileSystem.uploadAsync
          const uploadUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`;
          console.log('移动端上传 URL:', uploadUrl);
          console.log('文件 URI:', file!.uri);
          
          const uploadResult = await (FileSystem as any).uploadAsync(
            uploadUrl,
            file!.uri,
            {
              httpMethod: 'POST',
              uploadType: 1, // MULTIPART (0 = BINARY_CONTENT, 1 = MULTIPART)
              fieldName: 'file',
              parameters: { title, description },
            }
          );
          
          console.log('上传结果:', uploadResult.body?.substring(0, 200));
          
          const result = JSON.parse(uploadResult.body);
          
          if (result.success && result.file) {
            setUploadProgress(100);
            setUploadedFile(result.file);
            loadFileList(); // 刷新列表
          } else {
            throw new Error(result.error || '上传失败');
          }
        }
      }
    } catch (error) {
      console.error('上传失败:', error);
      setErrorDialog({ visible: true, message: `上传失败：${(error as Error).message}` });
    } finally {
      setUploading(false);
    }
  };

  // 播放/暂停音频
  const togglePlayback = async (audioUrl: string, fileId: number) => {
    if (!audioUrl) return;

    try {
      // 设置音频模式
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // 如果当前正在播放这个文件
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
        // 播放新文件
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
        // Web 端：在新标签页打开，用户可以在新标签页中下载
        // 使用 window.open 而不是创建 <a> 标签，因为跨域资源的 download 属性无效
        window.open(audioUrl, '_blank');
      } else {
        // 移动端使用分享功能
        if (await Sharing.isAvailableAsync()) {
          // 先下载到本地
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
          // 分享不可用时，使用系统浏览器打开
          await Linking.openURL(audioUrl);
        }
      }
    } catch (error) {
      console.error('下载失败:', error);
      setErrorDialog({ visible: true, message: '下载失败，请重试' });
    }
  };

  // 继续下一步
  const handleContinue = () => {
    if (uploadedFile) {
      router.push('/edit-text-content', { fileId: uploadedFile.id });
    }
  };

  // 重新上传
  const handleReset = async () => {
    // 停止播放
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    
    setUploadedFile(null);
    setTitle('');
    setDescription('');
    setFile(null);
    setLinkUrl('');
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
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
        // 如果删除的是当前上传的文件
        if (uploadedFile && uploadedFile.id === fileId) {
          setUploadedFile(null);
          setTitle('');
          setDescription('');
          setFile(null);
          setLinkUrl('');
          setIsPlaying(false);
          setPlaybackPosition(0);
          setPlaybackDuration(0);
        }
        // 刷新列表
        loadFileList();
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 渲染文件列表项
  const renderFileItem = (item: SentenceFile) => {
    const audioUrl = item.original_audio_signed_url;
    const isCurrentPlaying = playingFileId === item.id && isPlaying;
    
    return (
      <View key={item.id} style={styles.fileListItem}>
        <View style={styles.fileListItemHeader}>
          <View style={styles.fileListItemIcon}>
            <FontAwesome6 name="music" size={16} color={theme.primary} />
          </View>
          <View style={styles.fileListItemInfo}>
            <ThemedText variant="smallMedium" color={theme.textPrimary} numberOfLines={1}>
              {item.title}
            </ThemedText>
            <View style={styles.fileListItemMeta}>
              {item.original_duration > 0 && (
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {formatDuration(item.original_duration)}
                </ThemedText>
              )}
              <ThemedText variant="tiny" color={theme.textMuted}>
                {item.status === 'audio_ready' ? '待提取文本' : 
                 item.status === 'text_ready' ? '待剪辑语音' :
                 item.status === 'completed' ? '已完成' : item.status}
              </ThemedText>
            </View>
          </View>
        </View>
        
        <View style={styles.fileListItemActions}>
          <TouchableOpacity 
            style={styles.fileListActionButton}
            onPress={() => togglePlayback(audioUrl, item.id)}
          >
            <FontAwesome6 
              name={isCurrentPlaying ? "pause" : "play"} 
              size={14} 
              color={theme.buttonPrimaryText} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.fileListActionButton}
            onPress={() => handleDownload(audioUrl, item.title)}
          >
            <FontAwesome6 name="download" size={14} color={theme.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.fileListActionButton, styles.fileListActionDelete]}
            onPress={() => setDeleteConfirm({ visible: true, fileId: item.id })}
          >
            <FontAwesome6 name="trash" size={14} color={theme.error} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.fileListEditButton}
            onPress={() => router.push('/edit-text-content', { fileId: item.id })}
          >
            <ThemedText variant="small" color={theme.primary}>
              编辑
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 如果已上传成功，显示音频播放器
  if (uploadedFile) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <ThemedView level="root" style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleReset}>
                <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
              <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
                文件已创建
              </ThemedText>
              <View style={{ width: 20 }} />
            </View>
          </ThemedView>

          {/* 成功提示 */}
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <FontAwesome6 name="circle-check" size={48} color={theme.success} />
            </View>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.successTitle}>
              创建成功
            </ThemedText>
            <ThemedText variant="body" color={theme.textMuted}>
              原始音频文件已生成，可以播放或下载
            </ThemedText>
          </View>

          {/* 文件信息 */}
          <View style={styles.audioCard}>
            <View style={styles.audioHeader}>
              <View style={styles.audioIconContainer}>
                <FontAwesome6 name="music" size={24} color={theme.primary} />
              </View>
              <View style={styles.audioInfo}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} numberOfLines={1}>
                  {uploadedFile.title}
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>
                  {uploadedFile.original_duration > 0 
                    ? `时长: ${formatDuration(uploadedFile.original_duration)}` 
                    : '时长未知'}
                </ThemedText>
              </View>
            </View>

            {/* 播放进度 */}
            {playbackDuration > 0 && (
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
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={stopPlayback}
                disabled={!isPlaying && playbackPosition === 0}
              >
                <FontAwesome6 
                  name="stop" 
                  size={20} 
                  color={(!isPlaying && playbackPosition === 0) ? theme.textMuted : theme.textPrimary} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.playButton} onPress={() => togglePlayback(uploadedFile.original_audio_signed_url, uploadedFile.id)}>
                <FontAwesome6 
                  name={isPlaying && playingFileId === uploadedFile.id ? "pause" : "play"} 
                  size={28} 
                  color={theme.buttonPrimaryText} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={() => handleDownload(uploadedFile.original_audio_signed_url, uploadedFile.title)}>
                <FontAwesome6 name="download" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 操作按钮 */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => setDeleteConfirm({ visible: true, fileId: uploadedFile.id })}
              disabled={deleting}
            >
              <FontAwesome6 name="trash" size={18} color={theme.error} />
              <ThemedText variant="bodyMedium" color={theme.error}>
                删除
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => handleDownload(uploadedFile.original_audio_signed_url, uploadedFile.title)}
            >
              <FontAwesome6 name="download" size={18} color={theme.primary} />
              <ThemedText variant="bodyMedium" color={theme.primary}>
                下载
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleContinue}
            >
              <FontAwesome6 name="arrow-right" size={18} color={theme.buttonPrimaryText} />
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                继续
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* 提示信息 */}
          <View style={styles.tipCard}>
            <FontAwesome6 name="circle-info" size={16} color={theme.textMuted} />
            <ThemedText variant="small" color={theme.textMuted}>
              点击「继续」进入文本编辑页面，可以提取文本或手动输入句子内容。
            </ThemedText>
          </View>
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

  // 正常的上传界面
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
              创建新句库文件
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            上传音频/视频文件或导入链接
          </ThemedText>
        </ThemedView>

        {/* Import Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, importMode === 'upload' && styles.modeButtonActive]}
            onPress={() => setImportMode('upload')}
          >
            <FontAwesome6 
              name="upload" 
              size={16} 
              color={importMode === 'upload' ? theme.buttonPrimaryText : theme.textMuted} 
            />
            <ThemedText 
              variant="smallMedium" 
              color={importMode === 'upload' ? theme.buttonPrimaryText : theme.textMuted}
            >
              上传文件
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, importMode === 'link' && styles.modeButtonActive]}
            onPress={() => setImportMode('link')}
          >
            <FontAwesome6 
              name="link" 
              size={16} 
              color={importMode === 'link' ? theme.buttonPrimaryText : theme.textMuted} 
            />
            <ThemedText 
              variant="smallMedium" 
              color={importMode === 'link' ? theme.buttonPrimaryText : theme.textMuted}
            >
              链接导入
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Title */}
          <View style={styles.formGroup}>
            <ThemedText variant="smallMedium" color={theme.textSecondary}>
              标题 <ThemedText color={theme.error}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="输入句库文件标题"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <ThemedText variant="smallMedium" color={theme.textSecondary}>
              描述
            </ThemedText>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="输入描述（可选）"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* File Upload or Link Input */}
          {importMode === 'upload' ? (
            <View style={styles.formGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>
                音频或视频文件 <ThemedText color={theme.error}>*</ThemedText>
              </ThemedText>
              
              {file ? (
                <View style={styles.fileInfo}>
                  <View style={styles.fileIcon}>
                    <FontAwesome6 
                      name={file.mimeType.startsWith('video') ? 'video' : 'music'} 
                      size={24} 
                      color={theme.primary} 
                    />
                  </View>
                  <View style={styles.fileDetails}>
                    <ThemedText variant="smallMedium" color={theme.textPrimary} numberOfLines={1}>
                      {file.name}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      {formatFileSize(file.size)}
                    </ThemedText>
                  </View>
                  <TouchableOpacity onPress={() => setFile(null)}>
                    <FontAwesome6 name="xmark" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadOptionsContainer}>
                  <TouchableOpacity style={styles.uploadOptionButton} onPress={pickFromGallery}>
                    <View style={styles.uploadOptionIcon}>
                      <FontAwesome6 name="images" size={28} color={theme.primary} />
                    </View>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                      从相册选择
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      视频、图片
                    </ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.uploadOptionButton} onPress={pickFromFileSystem}>
                    <View style={styles.uploadOptionIcon}>
                      <FontAwesome6 name="folder-open" size={28} color={theme.accent} />
                    </View>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                      从文件选择
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      音频、视频
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.formGroup}>
              <ThemedText variant="smallMedium" color={theme.textSecondary}>
                视频/音频链接 <ThemedText color={theme.error}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={styles.textInput}
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="粘贴视频或音频链接"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ThemedText variant="caption" color={theme.textMuted}>
                支持 B站、抖音、YouTube 等平台
              </ThemedText>
            </View>
          )}
        </View>

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${uploadProgress}%`, backgroundColor: theme.primary }
                ]} 
              />
            </View>
            <ThemedText variant="small" color={theme.textMuted}>
              {uploadStatus}
            </ThemedText>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={theme.buttonPrimaryText} />
          ) : (
            <>
              <FontAwesome6 name="check" size={18} color={theme.buttonPrimaryText} />
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                创建文件
              </ThemedText>
            </>
          )}
        </TouchableOpacity>

        {/* 已创建的文件列表 */}
        <View style={styles.fileListSection}>
          <View style={styles.fileListHeader}>
            <ThemedText variant="smallMedium" color={theme.textSecondary}>
              已创建的文件
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted}>
              {fileList.length} 个
            </ThemedText>
          </View>
          
          {loadingList ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : fileList.length === 0 ? (
            <View style={styles.emptyFileList}>
              <FontAwesome6 name="folder-open" size={32} color={theme.textMuted} />
              <ThemedText variant="small" color={theme.textMuted}>
                暂无文件
              </ThemedText>
            </View>
          ) : (
            fileList.map(renderFileItem)
          )}
        </View>
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
