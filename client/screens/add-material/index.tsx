import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface FileInfo {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

// 生成本地 ID
const generateUploadId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

export default function AddMaterialScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<FileInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // 上传成功对话框状态
  const [successDialog, setSuccessDialog] = useState<{
    visible: boolean;
    materialId: number;
    title: string;
  }>({ visible: false, materialId: 0, title: '' });
  
  // 错误对话框状态
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const pickAudioFile = async () => {
    try {
      // 支持所有常见的音视频格式
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          // 音频格式
          'audio/*',
          'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
          'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac',
          'audio/ogg', 'audio/vorbis', 'audio/flac', 'audio/x-flac',
          'audio/wma', 'audio/x-ms-wma',
          'audio/aiff', 'audio/x-aiff',
          // 视频格式
          'video/*',
          'video/mp4', 'video/x-m4v',
          'video/quicktime', 'video/x-quicktime',
          'video/x-msvideo', 'video/avi',
          'video/x-matroska', 'video/mkv',
          'video/webm',
          'video/x-flv', 'video/flv',
          'video/3gpp', 'video/3gpp2',
          'video/x-mng',
          'video/ogg',
          'video/x-ms-wmv', 'video/wmv',
          // 通用
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
        });
        
        // 自动填充标题（如果没有填写）
        if (!title) {
          const nameWithoutExt = asset.name.replace(/\.[^/.]+$/, '');
          setTitle(nameWithoutExt);
        }
      }
    } catch (error) {
      console.error('选择文件失败:', error);
      setErrorDialog({ visible: true, message: '选择文件失败，请重试' });
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '未知大小';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorDialog({ visible: true, message: '请输入材料标题' });
      return;
    }

    if (!file) {
      setErrorDialog({ visible: true, message: '请选择音频或视频文件' });
      return;
    }

    setUploading(true);
    setUploadStatus('准备上传...');
    setUploadProgress(0);

    try {
      const baseUrl = EXPO_PUBLIC_BACKEND_BASE_URL || '';
      const uploadId = generateUploadId();
      const CHUNK_SIZE = 512 * 1024; // 512KB 每块，确保小于代理限制
      
      // 获取文件数据
      const response = await fetch(file.uri);
      const fileData = await response.arrayBuffer();

      const totalSize = fileData.byteLength;
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      
      console.log('文件信息:', { name: file.name, size: totalSize, chunks: totalChunks });

      // 分块上传
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunk = fileData.slice(start, end);
        
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(progress);
        setUploadStatus(`上传中 ${progress}% (${i + 1}/${totalChunks} 块)`);

        const formData = new FormData();
        const chunkBlob = new Blob([chunk], { type: file.mimeType || 'application/octet-stream' });
        formData.append('chunk', chunkBlob, `chunk_${i}`);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('uploadId', uploadId);
        formData.append('fileName', file.name);
        formData.append('contentType', file.mimeType || 'application/octet-stream');

        /**
         * 服务端文件：server/src/routes/materials.ts
         * 接口：POST /api/v1/materials/chunk
         * FormData 参数：chunk: File, chunkIndex: number, totalChunks: number, uploadId: string, fileName: string, contentType: string
         */
        const chunkResponse = await fetch(`${baseUrl}/api/v1/materials/chunk`, {
          method: 'POST',
          body: formData,
        });

        if (!chunkResponse.ok) {
          const errorText = await chunkResponse.text();
          throw new Error(`上传块 ${i + 1} 失败: ${errorText.substring(0, 100)}`);
        }

        console.log(`块 ${i + 1}/${totalChunks} 上传成功`);
      }

      setUploadStatus('处理中，正在识别语音...');

      // 完成上传
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：POST /api/v1/materials/complete
       * Body 参数：uploadId: string, title: string, description?: string
       */
      const completeResponse = await fetch(`${baseUrl}/api/v1/materials/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          title,
          description,
        }),
      });

      const responseText = await completeResponse.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`服务器返回非 JSON 格式: ${responseText.substring(0, 200)}`);
      }

      if (completeResponse.ok && data.success) {
        setUploadStatus('上传成功！');
        setUploadSuccess(true);
        // 显示成功确认对话框
        setSuccessDialog({
          visible: true,
          materialId: data.material.id,
          title: data.material.title,
        });
      } else {
        throw new Error(data.error || data.message || '处理失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      setUploadStatus('');
      setErrorDialog({ visible: true, message: `上传失败：${(error as Error).message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (uploading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        {/* Header with back button */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="h3" color={theme.textPrimary}>
            添加学习材料
          </ThemedText>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textPrimary} style={styles.uploadingText}>
            {uploadStatus || '正在处理音频...'}
          </ThemedText>
          
          {/* 进度条 */}
          {uploadProgress > 0 && (
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${uploadProgress}%` }
                ]} 
              />
            </View>
          )}
          
          <ThemedText variant="small" color={theme.textMuted} style={styles.uploadingHint}>
            {uploadProgress > 0 && uploadProgress < 100 
              ? '正在上传文件，请勿关闭页面...' 
              : '正在识别音频内容并分句，请稍候'}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      {/* Header with back button */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <ThemedText variant="h3" color={theme.textPrimary}>
          添加学习材料
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Message */}
        {uploadSuccess && (
          <View style={styles.successBanner}>
            <FontAwesome6 name="circle-check" size={20} color={theme.success} />
            <ThemedText variant="smallMedium" color={theme.success} style={styles.successText}>
              上传成功！
            </ThemedText>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <FontAwesome6 name="lightbulb" size={20} color={theme.accent} style={styles.infoIcon} />
          <ThemedText variant="small" color={theme.textSecondary}>
            上传音频或视频文件，系统将自动识别语音内容并分割成句子，方便逐句练习。
          </ThemedText>
        </View>

        {/* Title Input */}
        <View style={styles.formGroup}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.label}>
            材料标题 <ThemedText variant="small" color={theme.error}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="例如：BBC 新闻听力"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        {/* Description Input */}
        <View style={styles.formGroup}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.label}>
            描述（可选）
          </ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="添加一些关于这个材料的描述..."
            placeholderTextColor={theme.textMuted}
            multiline
          />
        </View>

        {/* File Picker */}
        <View style={styles.formGroup}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.label}>
            音频或视频文件 <ThemedText variant="small" color={theme.error}>*</ThemedText>
          </ThemedText>
          
          {file ? (
            <View style={styles.fileInfo}>
              <View style={styles.fileIconContainer}>
                <FontAwesome6 
                  name={file.mimeType?.startsWith('video') ? 'file-video' : 'file-audio'} 
                  size={24} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.fileDetails}>
                <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.fileName}>
                  {file.name}
                </ThemedText>
                <ThemedText variant="caption" color={theme.textMuted} style={styles.fileSize}>
                  {formatFileSize(file.size)}
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.removeFile} onPress={removeFile}>
                <FontAwesome6 name="xmark" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.filePicker} onPress={pickAudioFile}>
              <View style={styles.filePickerIconContainer}>
                <FontAwesome6 name="cloud-arrow-up" size={40} color={theme.primary} />
              </View>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.filePickerText}>
                点击选择音频或视频文件
              </ThemedText>
              <ThemedText variant="caption" color={theme.textMuted} style={styles.filePickerHint}>
                支持 MP3、WAV、MP4、MKV 等多种格式
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Supported Formats */}
        <View style={styles.supportedFormats}>
          <ThemedText variant="captionMedium" color={theme.textSecondary} style={styles.formatTitle}>
            支持的音视频格式
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            音频：MP3、WAV、M4A、AAC、OGG、FLAC、WMA、AIFF
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            视频：MP4、MOV、AVI、MKV、WebM、FLV、3GP、WMV
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            最大文件大小：500MB（视频将自动提取音频）
          </ThemedText>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!title.trim() || !file) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!title.trim() || !file}
        >
          <FontAwesome6 name="upload" size={18} color={theme.buttonPrimaryText} style={styles.buttonIcon} />
          <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
            上传并处理
          </ThemedText>
        </TouchableOpacity>

        {/* Hint */}
        <ThemedText variant="caption" color={theme.textMuted} style={styles.submitHint}>
          上传后系统将自动识别语音内容并分割成句子
        </ThemedText>
      </ScrollView>

      {/* 错误确认对话框 */}
      <ConfirmDialog
        visible={errorDialog.visible}
        title="提示"
        message={errorDialog.message}
        confirmText="确定"
        cancelText=""
        onConfirm={() => setErrorDialog({ visible: false, message: '' })}
        onCancel={() => setErrorDialog({ visible: false, message: '' })}
      />

      {/* 上传成功确认对话框 */}
      <ConfirmDialog
        visible={successDialog.visible}
        title="上传成功"
        message="材料已上传成功！语音识别完成后即可开始学习。"
        confirmText="开始学习"
        cancelText="返回首页"
        onConfirm={() => {
          setSuccessDialog({ visible: false, materialId: 0, title: '' });
          router.replace('/practice', { 
            materialId: successDialog.materialId, 
            title: successDialog.title 
          });
        }}
        onCancel={() => {
          setSuccessDialog({ visible: false, materialId: 0, title: '' });
          router.replace('/');
        }}
      />
    </Screen>
  );
}
