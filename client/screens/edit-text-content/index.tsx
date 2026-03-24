import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
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
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface SentenceFile {
  id: number;
  title: string;
  original_audio_url: string;
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
  
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  
  const [successDialog, setSuccessDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // 加载文件列表
  const loadFileList = async () => {
    setLoading(true);
    try {
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
            {/* File Info */}
            <View style={styles.fileInfoCard}>
              <View style={styles.fileInfoHeader}>
                <FontAwesome6 name="file-audio" size={24} color={theme.primary} />
                <View style={styles.fileInfoContent}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    {file.title}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    状态: {file.status}
                  </ThemedText>
                </View>
              </View>
            </View>

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
                  <TouchableOpacity
                    key={item.id}
                    style={styles.fileItemCard}
                    onPress={() => loadFile(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.fileItemIcon}>
                      <FontAwesome6 name="file-audio" size={20} color={theme.primary} />
                    </View>
                    <View style={styles.fileItemContent}>
                      <ThemedText variant="bodyMedium" color={theme.textPrimary} numberOfLines={1}>
                        {item.title}
                      </ThemedText>
                      <View style={styles.fileItemMeta}>
                        <ThemedText variant="caption" color={theme.textMuted}>
                          {item.status === 'audio_ready' ? '待提取文本' : 
                           item.status === 'text_ready' ? '待剪辑语音' :
                           item.status === 'completed' ? '已完成' : item.status}
                        </ThemedText>
                        {item.text_content && (
                          <View style={styles.hasTextBadge}>
                            <FontAwesome6 name="check" size={10} color={theme.success} />
                            <ThemedText variant="tiny" color={theme.success}>
                              有文本
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>
                    <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
                  </TouchableOpacity>
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
    </Screen>
  );
}
