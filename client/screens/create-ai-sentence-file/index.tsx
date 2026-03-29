import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore - react-native-sse 类型定义不完整
import RNSSE from 'react-native-sse';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { createFormDataFile } from '@/utils';
import { Spacing, BorderRadius } from '@/constants/theme';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function CreateAISentenceFileScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<'idle' | 'uploading' | 'importing'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importProgress, setImportProgress] = useState('');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const sseRef = useRef<any>(null);

  // 选择并上传文件
  const handlePickFile = useCallback(async (fileType: 'pdf' | 'word' | 'txt') => {
    try {
      const mimeTypes = {
        pdf: 'application/pdf',
        word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes[fileType],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      console.log('[创建AI句库] 选择的文件:', file.name, file.uri);

      // 上传文件
      setImporting(true);
      setImportPhase('uploading');
      setUploadProgress(0);

      const formData = new FormData();
      const fileData = await createFormDataFile(file.uri, file.name, mimeTypes[fileType]);
      formData.append('file', fileData as any);

      const uploadUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/upload`;
      const uploadData = await new Promise<{ url?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          xhrRef.current = null;
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error('解析响应失败'));
            }
          } else {
            reject(new Error(`上传失败: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          xhrRef.current = null;
          reject(new Error('网络错误'));
        });

        xhr.addEventListener('abort', () => {
          xhrRef.current = null;
          reject(new Error('已取消'));
        });

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
      });

      if (!uploadData.url) {
        throw new Error(uploadData.error || '文件上传失败');
      }

      console.log('[创建AI句库] 文件上传成功:', uploadData.url);

      // 调用导入 API
      setImportPhase('importing');
      setImportProgress('正在初始化导入...');

      const sseUrl = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/import-text`;
      
      await new Promise<void>((resolve, reject) => {
        const sse = new RNSSE(sseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            file_url: uploadData.url,
            file_type: fileType,
          }),
        });
        
        sseRef.current = sse;

        sse.addEventListener('message', (event) => {
          if (!event.data || event.data === '[DONE]') {
            sse.close();
            sseRef.current = null;
            resolve();
            return;
          }

          try {
            const data = JSON.parse(event.data);
            console.log('[创建AI句库] SSE 消息:', data);

            if (data.type === 'progress') {
              setImportProgress(data.message);
              if (data.percent !== undefined) {
                setUploadProgress(data.percent);
              }
            } else if (data.type === 'complete') {
              setImportProgress(data.message);
              setUploadProgress(100);
              Alert.alert('创建成功', data.message, [
                { text: '去学习', onPress: () => router.replace('/(tabs)') },
                { text: '继续创建', onPress: () => {
                  setImporting(false);
                  setImportPhase('idle');
                  setUploadProgress(0);
                  setImportProgress('');
                }}
              ]);
            } else if (data.type === 'error') {
              sse.close();
              sseRef.current = null;
              reject(new Error(data.message));
            }
          } catch (e) {
            console.error('[创建AI句库] 解析 SSE 消息失败:', e);
          }
        });

        sse.addEventListener('error', (event) => {
          console.error('[创建AI句库] SSE 错误:', event);
          sse.close();
          sseRef.current = null;
          reject(new Error('导入过程发生错误'));
        });
      });

    } catch (error: any) {
      console.error('[创建AI句库] 失败:', error);
      if (error.message !== '已取消') {
        Alert.alert('创建失败', error.message || '请稍后重试');
      }
    } finally {
      setImporting(false);
      setImportPhase('idle');
      setUploadProgress(0);
      setImportProgress('');
      xhrRef.current = null;
      sseRef.current = null;
    }
  }, [router]);

  // 取消上传
  const handleCancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

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
              创建 AI 句库
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
        </ThemedView>

        {/* 说明卡片 */}
        <View style={styles.infoCard}>
          <View style={[styles.infoIcon, { backgroundColor: theme.primary + '15' }]}>
            <FontAwesome6 name="wand-magic-sparkles" size={32} color={theme.primary} />
          </View>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoTitle}>
            AI 自动配音，快速创建句库
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.infoDesc}>
            上传 PDF、Word 或 TXT 文档，系统将自动提取文本内容，划分句子，并为每个句子生成 AI 语音。您可以直接开始听力练习。
          </ThemedText>
        </View>

        {/* 上传进度或上传选项 */}
        {importing ? (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText variant="body" color={theme.textPrimary} style={{ marginLeft: 8 }}>
                {importPhase === 'uploading' ? `上传中 ${uploadProgress}%` : '正在导入...'}
              </ThemedText>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%`, backgroundColor: theme.primary }]} />
            </View>
            
            {importPhase === 'importing' && (
              <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 8 }}>
                {importProgress || '正在解析文件并生成语音...'}
              </ThemedText>
            )}

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelUpload}
            >
              <ThemedText variant="small" color={theme.error}>取消</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* PDF 导入 */}
            <TouchableOpacity 
              style={styles.importOption}
              onPress={() => handlePickFile('pdf')}
              activeOpacity={0.7}
            >
              <View style={[styles.importOptionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <FontAwesome6 name="file-pdf" size={28} color="#EF4444" />
              </View>
              <View style={styles.importOptionContent}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                  PDF 文件
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>
                  自动提取文本，识别句子结构
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Word 导入 */}
            <TouchableOpacity 
              style={styles.importOption}
              onPress={() => handlePickFile('word')}
              activeOpacity={0.7}
            >
              <View style={[styles.importOptionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <FontAwesome6 name="file-word" size={28} color="#3B82F6" />
              </View>
              <View style={styles.importOptionContent}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                  Word 文档 (.docx)
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>
                  自动提取文本内容
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>

            {/* TXT 导入 */}
            <TouchableOpacity 
              style={styles.importOption}
              onPress={() => handlePickFile('txt')}
              activeOpacity={0.7}
            >
              <View style={[styles.importOptionIcon, { backgroundColor: 'rgba(107, 114, 128, 0.1)' }]}>
                <FontAwesome6 name="file-lines" size={28} color="#6B7280" />
              </View>
              <View style={styles.importOptionContent}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                  纯文本文件 (.txt)
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>
                  UTF-8 编码格式
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </>
        )}

        {/* 格式说明 */}
        <View style={styles.formatSection}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.formatTitle}>
            文本格式要求
          </ThemedText>
          
          <View style={styles.formatExample}>
            <ThemedText variant="small" color={theme.textMuted} style={{ marginBottom: 4 }}>
              格式示范：
            </ThemedText>
            <View style={[styles.formatExampleCode, { backgroundColor: theme.backgroundTertiary }]}>
              <ThemedText variant="small" color={theme.textPrimary}>
                {'Lesson 1\n'}
                {'A private conversation\n'}
                {'私人谈话\n'}
                {'Last week I went to the theatre.\n'}
                {'上周我去看戏。\n'}
                {'I had a very good seat.\n'}
                {'我的座位很好。'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.formatTips}>
            <View style={styles.formatTipItem}>
              <FontAwesome6 name="check-circle" size={14} color={theme.success} />
              <ThemedText variant="small" color={theme.textSecondary} style={{ marginLeft: 6 }}>
                一行英文，下一行中文翻译
              </ThemedText>
            </View>
            <View style={styles.formatTipItem}>
              <FontAwesome6 name="check-circle" size={14} color={theme.success} />
              <ThemedText variant="small" color={theme.textSecondary} style={{ marginLeft: 6 }}>
                以 "Lesson X" 开头划分课时
              </ThemedText>
            </View>
            <View style={styles.formatTipItem}>
              <FontAwesome6 name="times-circle" size={14} color={theme.error} />
              <ThemedText variant="small" color={theme.textSecondary} style={{ marginLeft: 6 }}>
                不支持英文和中文写同一行
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
