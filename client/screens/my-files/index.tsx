import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Text,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface SentenceFile {
  id: number;
  title: string;
  description: string;
  original_duration: number;
  source_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  sentences_count: number;
  ready_sentences_count: number;
  is_shared: boolean;
  share_info: { id: number; download_count: number } | null;
}

export default function MyFilesScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [files, setFiles] = useState<SentenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SentenceFile | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/my-files?user_id=${user.id}`
      );
      const result = await response.json();
      
      if (result.success) {
        setFiles(result.files || []);
      }
    } catch (error) {
      console.error('获取句库列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchFiles();
      } else {
        setLoading(false);
      }
    }, [isAuthenticated, fetchFiles])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFiles();
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 编辑句库
  const handleEdit = (file: SentenceFile) => {
    setSelectedFile(file);
    setEditTitle(file.title);
    setEditDescription(file.description || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFile || !user?.id) return;
    
    if (!editTitle.trim()) {
      Alert.alert('提示', '请输入标题');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/my-files/${selectedFile.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            title: editTitle.trim(),
            description: editDescription.trim(),
          }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setEditModalVisible(false);
        fetchFiles();
      } else {
        Alert.alert('错误', result.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除句库
  const handleDelete = (file: SentenceFile) => {
    Alert.alert(
      '确认删除',
      `确定要删除「${file.title}」吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/my-files/${file.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: user?.id }),
                }
              );
              
              const result = await response.json();
              
              if (result.success) {
                fetchFiles();
              } else {
                Alert.alert('错误', result.error || '删除失败');
              }
            } catch (error) {
              console.error('删除失败:', error);
              Alert.alert('错误', '网络错误，请稍后重试');
            }
          },
        },
      ]
    );
  };

  // 分享句库
  const handleShare = (file: SentenceFile) => {
    setSelectedFile(file);
    setShareDescription(file.description || '');
    setShareModalVisible(true);
  };

  const handleConfirmShare = async () => {
    if (!selectedFile || !user?.id) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence_file_id: selectedFile.id,
            shared_by: user.id,
            description: shareDescription.trim(),
          }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setShareModalVisible(false);
        Alert.alert('成功', '句库已分享到市场');
        fetchFiles();
      } else {
        Alert.alert('错误', result.error || '分享失败');
      }
    } catch (error) {
      console.error('分享失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 取消分享
  const handleCancelShare = (file: SentenceFile) => {
    if (!file.share_info) return;
    
    Alert.alert(
      '取消分享',
      '确定要取消分享吗？其他用户将无法在市场中看到此句库。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/${file.share_info?.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: user?.id }),
                }
              );
              
              const result = await response.json();
              
              if (result.success) {
                Alert.alert('成功', '已取消分享');
                fetchFiles();
              } else {
                Alert.alert('错误', result.error || '操作失败');
              }
            } catch (error) {
              console.error('取消分享失败:', error);
              Alert.alert('错误', '网络错误，请稍后重试');
            }
          },
        },
      ]
    );
  };

  // 学习句库
  const handleLearn = (file: SentenceFile) => {
    if (file.ready_sentences_count > 0) {
      router.push('/sentence-practice', { fileId: file.id, title: file.title });
    } else {
      Alert.alert('提示', '此句库暂无可学习的句子，请先在句库制作中完成时间戳编辑');
    }
  };

  if (!isAuthenticated) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <FontAwesome6 name="folder-open" size={32} color={theme.textMuted} />
          </View>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
            请先登录
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
            登录后可管理您的句库
          </ThemedText>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => router.push('/login')}
          >
            <FontAwesome6 name="right-to-bracket" size={16} color={theme.buttonPrimaryText} />
            <Text style={styles.createButtonText}>去登录</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
              我的句库
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            共 {files.length} 个句库
          </ThemedText>
        </ThemedView>

        {/* Empty State */}
        {files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="folder-open" size={32} color={theme.textMuted} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
              暂无句库
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              在句库制作中创建您的第一个句库
            </ThemedText>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => router.push('/sentence-workshop')}
            >
              <FontAwesome6 name="plus" size={16} color={theme.buttonPrimaryText} />
              <Text style={styles.createButtonText}>创建句库</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* File List */
          files.map((file) => (
            <TouchableOpacity
              key={file.id}
              style={styles.fileCard}
              onPress={() => handleLearn(file)}
              activeOpacity={0.7}
            >
              <View style={styles.fileHeader}>
                <View style={styles.fileIconContainer}>
                  <FontAwesome6 name="book-open" size={20} color={theme.primary} />
                </View>
                <View style={styles.fileInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.fileTitle}>
                      {file.title}
                    </ThemedText>
                    {file.is_shared && (
                      <View style={styles.shareBadge}>
                        <FontAwesome6 name="share-nodes" size={10} color={theme.success} />
                        <Text style={styles.shareBadgeText}>
                          {file.share_info?.download_count || 0} 次下载
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.fileMeta}>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="clock" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {formatDuration(file.original_duration)}
                      </ThemedText>
                    </View>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="list" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {file.ready_sentences_count}/{file.sentences_count} 句可学
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
              
              <View style={styles.fileActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => handleEdit(file)}
                >
                  <FontAwesome6 name="pen" size={12} color={theme.primary} />
                  <Text style={[styles.actionBtnText, { color: theme.primary }]}>编辑</Text>
                </TouchableOpacity>
                
                {file.is_shared ? (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: theme.textMuted + '15' }]}
                    onPress={() => handleCancelShare(file)}
                  >
                    <FontAwesome6 name="xmark" size={12} color={theme.textMuted} />
                    <Text style={[styles.actionBtnText, { color: theme.textMuted }]}>取消分享</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.shareBtn]}
                    onPress={() => handleShare(file)}
                  >
                    <FontAwesome6 name="share" size={12} color={theme.accent} />
                    <Text style={[styles.actionBtnText, { color: theme.accent }]}>分享</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(file)}
                >
                  <FontAwesome6 name="trash" size={12} color={theme.error} />
                  <Text style={[styles.actionBtnText, { color: theme.error }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              编辑句库
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="标题"
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="描述（可选）"
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleSaveEdit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: theme.buttonPrimaryText }]}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal visible={shareModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              分享到市场
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={{ marginBottom: 16 }}>
              分享后，其他用户可以在市场中看到并下载此句库
            </ThemedText>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={shareDescription}
              onChangeText={setShareDescription}
              placeholder="添加描述，让更多人了解这个句库..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleConfirmShare}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: theme.buttonPrimaryText }]}>确认分享</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
