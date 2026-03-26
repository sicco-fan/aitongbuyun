import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Text,
  TextInput,
  Modal,
  Alert,
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
import { Spacing } from '@/constants/theme';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface ShareItem {
  id: number;
  sentence_file_id: number;
  shared_by: string;
  title: string;
  description: string;
  download_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function MySharesScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 编辑弹窗
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedShare, setSelectedShare] = useState<ShareItem | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchShares = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/mine?user_id=${user.id}`
      );
      const result = await response.json();
      
      if (result.success) {
        setShares(result.shares || []);
      }
    } catch (error) {
      console.error('获取分享列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchShares();
      } else {
        setLoading(false);
      }
    }, [isAuthenticated, fetchShares])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchShares();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  // 编辑分享描述
  const handleEdit = (share: ShareItem) => {
    setSelectedShare(share);
    setEditDescription(share.description || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedShare || !user?.id) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/${selectedShare.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            description: editDescription.trim(),
          }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setEditModalVisible(false);
        fetchShares();
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

  // 取消分享
  const handleCancelShare = (share: ShareItem) => {
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
                `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/${share.id}`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: user?.id }),
                }
              );
              
              const result = await response.json();
              
              if (result.success) {
                Alert.alert('成功', '已取消分享');
                fetchShares();
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

  if (!isAuthenticated) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <FontAwesome6 name="share-nodes" size={32} color={theme.textMuted} />
          </View>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
            请先登录
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
            登录后可管理您的分享
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
              我的分享
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/share-market')}>
              <FontAwesome6 name="store" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            共分享了 {shares.length} 个句库
          </ThemedText>
        </ThemedView>

        {/* Empty State */}
        {shares.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="share-nodes" size={32} color={theme.textMuted} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
              暂无分享内容
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              在&quot;我的句库&quot;中分享您的优质句库
            </ThemedText>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => router.push('/my-files')}
            >
              <FontAwesome6 name="folder" size={16} color={theme.buttonPrimaryText} />
              <Text style={styles.createButtonText}>我的句库</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Share List */
          shares.map((share) => (
            <View
              key={share.id}
              style={styles.shareCard}
            >
              <View style={styles.shareHeader}>
                <View style={styles.shareIconContainer}>
                  <FontAwesome6 name="share-from-square" size={20} color={theme.success} />
                </View>
                <View style={styles.shareInfo}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.shareTitle}>
                    {share.title}
                  </ThemedText>
                  <View style={styles.shareMeta}>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="calendar" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {formatDate(share.created_at)}
                      </ThemedText>
                    </View>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="download" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {share.download_count} 次下载
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
              
              {share.description && (
                <ThemedText variant="small" color={theme.textSecondary} style={styles.shareDescription}>
                  {share.description}
                </ThemedText>
              )}
              
              <View style={styles.shareFooter}>
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <FontAwesome6 name="eye" size={12} color={theme.textMuted} />
                    <ThemedText variant="tiny" color={theme.textMuted}>
                      分享中
                    </ThemedText>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity 
                    style={[styles.cancelBtn, { backgroundColor: theme.primary + '15' }]}
                    onPress={() => handleEdit(share)}
                  >
                    <FontAwesome6 name="pen" size={12} color={theme.primary} />
                    <Text style={[styles.cancelBtnText, { color: theme.primary }]}>编辑</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => handleCancelShare(share)}
                  >
                    <FontAwesome6 name="xmark" size={12} color={theme.error} />
                    <Text style={styles.cancelBtnText}>取消分享</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.editModal}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <FontAwesome6 name="xmark" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h4" color={theme.textPrimary}>编辑分享</ThemedText>
            <View style={{ width: 20 }} />
          </View>
          
          <View style={styles.editContent}>
            <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.editLabel}>
              分享描述
            </ThemedText>
            <TextInput
              style={[styles.editInput, styles.editTextarea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="添加描述，让更多人了解这个句库..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>
          
          <View style={styles.editFooter}>
            <TouchableOpacity 
              style={[styles.editBtn, styles.editCancelBtn]}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={[styles.editBtnText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editBtn, styles.editConfirmBtn]}
              onPress={handleSaveEdit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <Text style={[styles.editBtnText, { color: theme.buttonPrimaryText }]}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
