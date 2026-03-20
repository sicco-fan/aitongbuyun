import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
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

export default function AddMaterialScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<FileInfo | null>(null);
  const [uploading, setUploading] = useState(false);

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
      Alert.alert('错误', '选择文件失败');
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
      Alert.alert('提示', '请输入材料标题');
      return;
    }

    if (!file) {
      Alert.alert('提示', '请选择音频文件');
      return;
    }

    setUploading(true);

    try {
      // 创建 FormData
      const formData = new FormData();
      
      // 使用 createFormDataFile 创建跨平台兼容的文件对象
      const audioFile = await createFormDataFile(
        file.uri,
        file.name,
        file.mimeType || 'audio/mpeg'
      );
      formData.append('file', audioFile as any);
      formData.append('title', title);
      formData.append('description', description);

      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：POST /api/v1/materials
       * FormData 参数：file: File, title: string, description?: string
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('成功', '材料上传成功！', [
          { text: '开始学习', onPress: () => router.replace('/practice', { 
            materialId: data.material.id, 
            title: data.material.title 
          })},
        ]);
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      Alert.alert('错误', `上传失败：${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textPrimary} style={styles.uploadingText}>
            正在处理音频...
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            添加学习材料
          </ThemedText>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            上传音频文件，系统将自动识别并分句
          </ThemedText>
        </ThemedView>

        {/* Title Input */}
        <View style={styles.formGroup}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.label}>
            材料标题
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
            音频文件
          </ThemedText>
          
          {file ? (
            <View style={styles.fileInfo}>
              <FontAwesome6 name="file-audio" size={24} color={theme.primary} style={styles.fileIcon} />
              <View style={styles.fileDetails}>
                <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.fileName}>
                  {file.name}
                </ThemedText>
                <ThemedText variant="caption" color={theme.textMuted} style={styles.fileSize}>
                  {formatFileSize(file.size)}
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.removeFile} onPress={removeFile}>
                <FontAwesome6 name="xmark" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.filePicker} onPress={pickAudioFile}>
              <FontAwesome6 name="cloud-arrow-up" size={48} color={theme.textMuted} style={styles.filePickerIcon} />
              <ThemedText variant="body" color={theme.textPrimary} style={styles.filePickerText}>
                点击选择音频文件
              </ThemedText>
              <ThemedText variant="caption" color={theme.textMuted} style={styles.filePickerHint}>
                支持 MP3、WAV、M4A 等格式
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Supported Formats */}
        <View style={styles.supportedFormats}>
          <ThemedText variant="captionMedium" color={theme.textSecondary} style={styles.formatTitle}>
            支持的音频格式
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted} style={styles.formatList}>
            MP3、WAV、M4A、OGG、FLAC 等常见音频格式
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            最大文件大小：100MB
          </ThemedText>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.back()}
          >
            <ThemedText variant="smallMedium" color={theme.textPrimary}>
              取消
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit}
          >
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              上传
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
