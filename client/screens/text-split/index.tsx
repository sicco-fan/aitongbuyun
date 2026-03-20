import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

export default function TextSplitScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ materialId: number; title: string }>();
  
  const materialId = params.materialId;
  const title = params.title || '材料';
  
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullText, setFullText] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  
  // 提示对话框
  const [dialog, setDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // 获取材料详情
  const fetchMaterial = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：GET /api/v1/materials/:id
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const data = await response.json();
      
      if (data.material) {
        setFullText(data.material.full_text || '');
        
        // 如果已有句子，显示
        if (data.sentences && data.sentences.length > 0) {
          setSentences(data.sentences.map((s: any) => s.text));
        }
      }
    } catch (error) {
      console.error('获取材料失败:', error);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchMaterial();
  }, [fetchMaterial]);

  // 获取文本（调用 ASR）
  const handleExtractText = async () => {
    if (!materialId) return;
    
    setExtracting(true);
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：POST /api/v1/materials/:id/extract-text
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/extract-text`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.text) {
        setFullText(data.text);
        setDialog({ visible: true, message: `文本提取成功！共 ${data.text.length} 个字符` });
      } else {
        throw new Error(data.error || '提取失败');
      }
    } catch (error) {
      console.error('提取文本失败:', error);
      setDialog({ visible: true, message: `提取失败: ${(error as Error).message}` });
    } finally {
      setExtracting(false);
    }
  };

  // 保存句子
  const handleSave = async () => {
    if (!materialId || sentences.length === 0) {
      setDialog({ visible: true, message: '请先切分段落' });
      return;
    }
    
    setSaving(true);
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：POST /api/v1/materials/:id/save-sentences
       * Body 参数：sentences: string[]
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/save-sentences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDialog({ visible: true, message: `保存成功！共 ${data.count} 个句子` });
      } else {
        throw new Error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      setDialog({ visible: true, message: `保存失败: ${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  // 文本变化时，按换行符分割
  const handleTextChange = (text: string) => {
    setFullText(text);
    // 按换行符分割
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    setSentences(lines);
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
              文本切分
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            {title}
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 操作按钮区 */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.extractBtn]}
              onPress={handleExtractText}
              disabled={extracting}
            >
              {extracting ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <FontAwesome6 name="wand-magic-sparkles" size={16} color={theme.buttonPrimaryText} />
              )}
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                {extracting ? '提取中...' : '获取文本'}
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionBtn, styles.saveBtn, sentences.length === 0 && styles.disabledBtn]}
              onPress={handleSave}
              disabled={saving || sentences.length === 0}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <FontAwesome6 name="floppy-disk" size={16} color={theme.buttonPrimaryText} />
              )}
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                {saving ? '保存中...' : '保存段落'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* 提示 */}
          <View style={styles.tipBox}>
            <FontAwesome6 name="lightbulb" size={16} color={theme.accent} />
            <ThemedText variant="small" color={theme.textSecondary}>
              按 Enter 键换行来切分段落，每行将作为独立的句子
            </ThemedText>
          </View>

          {/* 文本编辑区 */}
          <View style={styles.editorSection}>
            <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionLabel}>
              文本内容
            </ThemedText>
            <TextInput
              style={styles.textInput}
              value={fullText}
              onChangeText={handleTextChange}
              placeholder="点击「获取文本」按钮提取音频文本，或直接粘贴文本..."
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* 句子预览 */}
          {sentences.length > 0 && (
            <View style={styles.previewSection}>
              <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionLabel}>
                切分预览 ({sentences.length} 个句子)
              </ThemedText>
              {sentences.map((sentence, index) => (
                <View key={index} style={styles.sentenceItem}>
                  <View style={styles.sentenceNumber}>
                    <ThemedText variant="caption" color={theme.buttonPrimaryText}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText variant="body" color={theme.textPrimary} style={styles.sentenceText}>
                    {sentence}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 提示对话框 */}
      <ConfirmDialog
        visible={dialog.visible}
        title="提示"
        message={dialog.message}
        confirmText="确定"
        onConfirm={() => setDialog({ visible: false, message: '' })}
        onCancel={() => setDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}
