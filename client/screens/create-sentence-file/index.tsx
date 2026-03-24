import React, { useState, useMemo, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeRouter } from '@/hooks/useSafeRouter';
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
  
  const [successDialog, setSuccessDialog] = useState<{ visible: boolean; fileId: number }>({
    visible: false,
    fileId: 0,
  });
  
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const progressAnim = useRef(new Animated.Value(0)).current;

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
          setSuccessDialog({ visible: true, fileId: result.file.id });
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
            setSuccessDialog({ visible: true, fileId: result.file.id });
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
            setSuccessDialog({ visible: true, fileId: result.file.id });
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

  const handleSuccessConfirm = () => {
    setSuccessDialog({ visible: false, fileId: 0 });
    // 跳转到文本编辑页面
    router.push('/edit-text-content', { fileId: successDialog.fileId });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
      </ScrollView>

      {/* Success Dialog */}
      <ConfirmDialog
        visible={successDialog.visible}
        title="创建成功"
        message="句库文件已创建，现在可以提取文本内容"
        confirmText="继续编辑"
        onConfirm={handleSuccessConfirm}
        onCancel={() => setSuccessDialog({ visible: false, fileId: 0 })}
      />

      {/* Error Dialog */}
      <ConfirmDialog
        visible={errorDialog.visible}
        title="错误"
        message={errorDialog.message}
        confirmText="确定"
        onConfirm={() => setErrorDialog({ visible: false, message: '' })}
        onCancel={() => setErrorDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}
