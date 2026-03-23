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

// 后端服务地址 - 直接连接后端服务器，不经过 Metro 代理
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

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
  const [audioUrl, setAudioUrl] = useState<string>('');
  
  // 提示对话框
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  // 获取材料详情
  const fetchMaterial = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const data = await response.json();
      
      if (data.material) {
        setFullText(data.material.full_text || '');
        setAudioUrl(data.material.audio_url || '');
        
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

  // 自动按标点切分文本
  const autoSplitText = (text: string): string[] => {
    const result: string[] = [];
    
    // 先按句号、问号、感叹号分割（这些是强分割点）
    const strongSplits = text.split(/([。！？.!?]+)/);
    
    let currentSentence = '';
    
    for (let i = 0; i < strongSplits.length; i++) {
      const part = strongSplits[i];
      
      // 如果是标点符号
      if (/^[。！？.!?]+$/.test(part)) {
        currentSentence += part;
        if (currentSentence.trim()) {
          result.push(currentSentence.trim());
        }
        currentSentence = '';
      } else {
        // 文本部分，检查是否需要按逗号分割
        const commaSplits = part.split(/([，,]+)/);
        
        for (let j = 0; j < commaSplits.length; j++) {
          const commaPart = commaSplits[j];
          
          if (/^[，,]+$/.test(commaPart)) {
            // 逗号：如果当前句子已经比较长（超过15个字符），就在逗号处分割
            if (currentSentence.length >= 15) {
              currentSentence += commaPart;
              if (currentSentence.trim()) {
                result.push(currentSentence.trim());
              }
              currentSentence = '';
            } else {
              // 句子较短，继续累积
              currentSentence += commaPart;
            }
          } else {
            currentSentence += commaPart;
          }
        }
      }
    }
    
    // 处理最后剩余的内容
    if (currentSentence.trim()) {
      result.push(currentSentence.trim());
    }
    
    return result;
  };

  // 获取文本（调用 ASR）
  const handleExtractText = async () => {
    if (!materialId) return;
    
    setExtracting(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/extract-text`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.text) {
        setFullText(data.text);
        // 自动切分
        const autoSentences = autoSplitText(data.text);
        setSentences(autoSentences);
        setDialog({ 
          visible: true, 
          message: `文本提取成功！共 ${data.text.length} 个字符，自动切分为 ${autoSentences.length} 个句子。您可以手动调整后保存。`
        });
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

  // 重新自动切分
  const handleAutoSplit = () => {
    if (!fullText.trim()) {
      setDialog({ visible: true, message: '请先获取文本' });
      return;
    }
    const autoSentences = autoSplitText(fullText);
    setSentences(autoSentences);
    setDialog({ visible: true, message: `已重新切分为 ${autoSentences.length} 个句子` });
  };

  // 保存句子
  const handleSave = async () => {
    if (!materialId || sentences.length === 0) {
      setDialog({ visible: true, message: '请先切分段落' });
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/save-sentences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 保存成功后跳转到时间戳设置页面
        setDialog({ 
          visible: true, 
          message: `保存成功！共 ${data.count} 个句子。接下来请设置每个句子的时间戳。`,
          onConfirm: () => {
            router.replace('/timestamp-editor', { materialId, title });
          }
        });
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

  // 删除句子
  const handleDeleteSentence = (index: number) => {
    const newSentences = sentences.filter((_, i) => i !== index);
    setSentences(newSentences);
  };

  // 合并句子（与下一句合并）
  const handleMergeSentence = (index: number) => {
    if (index >= sentences.length - 1) return;
    const newSentences = [...sentences];
    newSentences[index] = newSentences[index] + ' ' + newSentences[index + 1];
    newSentences.splice(index + 1, 1);
    setSentences(newSentences);
  };

  // 拆分句子（按逗号拆分）
  const handleSplitSentence = (index: number) => {
    const sentence = sentences[index];
    const parts = sentence.split(/([，,]+)/);
    if (parts.length <= 1) {
      setDialog({ visible: true, message: '该句子没有逗号，无法拆分' });
      return;
    }
    
    const newSentences: string[] = [];
    let current = '';
    for (let i = 0; i < parts.length; i++) {
      current += parts[i];
      if (i % 2 === 0 && i > 0 && current.trim()) {
        newSentences.push(current.trim());
        current = '';
      }
    }
    if (current.trim()) {
      newSentences.push(current.trim());
    }
    
    const result = [...sentences.slice(0, index), ...newSentences, ...sentences.slice(index + 1)];
    setSentences(result);
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
              style={[styles.actionBtn, styles.autoSplitBtn]}
              onPress={handleAutoSplit}
              disabled={!fullText}
            >
              <FontAwesome6 name="scissors" size={16} color={theme.buttonPrimaryText} />
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                自动切分
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
                {saving ? '保存中...' : '保存'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* 提示 */}
          <View style={styles.tipBox}>
            <FontAwesome6 name="lightbulb" size={16} color={theme.accent} />
            <ThemedText variant="small" color={theme.textSecondary}>
              自动切分规则：句号/问号/感叹号必分割，逗号处按句子长度智能分割
            </ThemedText>
          </View>

          {/* 句子编辑区 */}
          {sentences.length > 0 ? (
            <View style={styles.previewSection}>
              <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionLabel}>
                句子列表 ({sentences.length} 个) - 可拖动调整顺序，点击按钮编辑
              </ThemedText>
              {sentences.map((sentence, index) => (
                <View key={index} style={styles.sentenceCard}>
                  <View style={styles.sentenceHeader}>
                    <View style={styles.sentenceNumber}>
                      <ThemedText variant="caption" color={theme.buttonPrimaryText}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <View style={styles.sentenceActions}>
                      <TouchableOpacity 
                        style={styles.smallBtn}
                        onPress={() => handleSplitSentence(index)}
                      >
                        <FontAwesome6 name="scissors" size={12} color={theme.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.smallBtn}
                        onPress={() => handleMergeSentence(index)}
                        disabled={index >= sentences.length - 1}
                      >
                        <FontAwesome6 name="link" size={12} color={theme.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.smallBtn}
                        onPress={() => handleDeleteSentence(index)}
                      >
                        <FontAwesome6 name="trash" size={12} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    style={styles.sentenceInput}
                    value={sentence}
                    onChangeText={(text) => {
                      const newSentences = [...sentences];
                      newSentences[index] = text;
                      setSentences(newSentences);
                    }}
                    multiline
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome6 name="file-lines" size={48} color={theme.textMuted} />
              <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
                点击「获取文本」开始
              </ThemedText>
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
        onConfirm={() => {
          setDialog({ visible: false, message: '' });
          dialog.onConfirm?.();
        }}
        onCancel={() => setDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}
