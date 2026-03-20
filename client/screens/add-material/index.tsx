import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { createFormDataFile } from '@/utils';

interface FileInfo {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

// Web 端兼容的 Alert
const showAlert = (title: string, message: string, buttons?: { text: string; onPress?: () => void }[]) => {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed && buttons && buttons.length > 1) {
      // 用户点击确定
      buttons[1]?.onPress?.();
    } else if (!confirmed && buttons && buttons.length > 0) {
      // 用户点击取消
      buttons[0]?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
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
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
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
      if (Platform.OS === 'web') {
        alert('选择文件失败');
      } else {
        Alert.alert('错误', '选择文件失败');
      }
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
      if (Platform.OS === 'web') {
        alert('请输入材料标题');
      } else {
        Alert.alert('提示', '请输入材料标题');
      }
      return;
    }

    if (!file) {
      if (Platform.OS === 'web') {
        alert('请选择音频或视频文件');
      } else {
        Alert.alert('提示', '请选择音频或视频文件');
      }
      return;
    }

    setUploading(true);
    setUploadStatus('准备上传...');

    try {
      // 创建 FormData
      const formData = new FormData();
      
      setUploadStatus('处理文件中...');
      
      // 使用 createFormDataFile 创建跨平台兼容的文件对象
      const audioFile = await createFormDataFile(
        file.uri,
        file.name,
        file.mimeType || 'audio/mpeg'
      );
      formData.append('file', audioFile as any);
      formData.append('title', title);
      formData.append('description', description);

      setUploadStatus('上传中...');
      
      // 对于文件上传，使用本地后端 URL 以避免代理服务器的请求大小限制
      // 开发环境直接连接本地后端，生产环境使用配置的 URL
      const isDev = __DEV__;
      const baseUrl = isDev ? 'http://localhost:9091' : EXPO_PUBLIC_BACKEND_BASE_URL;
      const url = `${baseUrl}/api/v1/materials`;
      console.log('上传 URL:', url);
      console.log('文件信息:', { name: file.name, size: file.size, type: file.mimeType });
      console.log('开发模式:', isDev);
      
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：POST /api/v1/materials
       * FormData 参数：file: File, title: string, description?: string
       */
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      console.log('响应状态:', response.status, response.statusText);
      
      // 先获取响应文本，再尝试解析 JSON
      const responseText = await response.text();
      console.log('响应内容:', responseText.substring(0, 500));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`服务器返回非 JSON 格式: ${responseText.substring(0, 200)}`);
      }

      if (response.ok && data.success) {
        setUploadStatus('上传成功！');
        setUploadSuccess(true);
        
        // 显示成功提示
        if (Platform.OS === 'web') {
          const goToPractice = window.confirm(
            '材料上传成功！\n\n点击"确定"开始学习，点击"取消"返回首页'
          );
          if (goToPractice) {
            router.replace('/practice', { 
              materialId: data.material.id, 
              title: data.material.title 
            });
          } else {
            router.replace('/');
          }
        } else {
          Alert.alert('成功', '材料上传成功！', [
            { text: '返回首页', onPress: () => router.replace('/') },
            { text: '开始学习', onPress: () => router.replace('/practice', { 
              materialId: data.material.id, 
              title: data.material.title 
            })},
          ]);
        }
      } else {
        throw new Error(data.error || data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      const errorMsg = `上传失败：${(error as Error).message}`;
      setUploadStatus('');
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('错误', errorMsg);
      }
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
          <ThemedText variant="small" color={theme.textMuted} style={styles.uploadingHint}>
            正在识别音频内容并分句，请稍候
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
                支持 MP3、WAV、M4A、MP4 等格式
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
            音频：MP3、WAV、M4A、OGG、FLAC
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            视频：MP4、MOV、AVI 等（自动提取音频）
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            最大文件大小：500MB
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
    </Screen>
  );
}
