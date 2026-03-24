import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// 后端服务地址
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Material {
  id: number;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  sentences_count: number;
  completed_count: number;
  full_text?: string;
  status?: string;
  created_at: string;
}

export default function AdminScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  
  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    material: Material | null;
  }>({ visible: false, material: null });
  
  // 编辑名称对话框状态
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    material: Material | null;
    title: string;
  }>({ visible: false, material: null, title: '' });
  
  // 成功提示
  const [successDialog, setSuccessDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const fetchMaterials = useCallback(async () => {
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：GET /api/v1/materials
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials`);
      const data = await response.json();
      
      if (data.materials) {
        setMaterials(data.materials);
      }
    } catch (error) {
      console.error('获取材料列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMaterials();
    }, [fetchMaterials])
  );

  const handleDeleteClick = (material: Material) => {
    setDeleteDialog({ visible: true, material });
  };

  const handleDeleteConfirm = async () => {
    const material = deleteDialog.material;
    if (!material) return;
    
    setDeleteDialog({ visible: false, material: null });
    
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：DELETE /api/v1/materials/:id
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${material.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setMaterials(prev => prev.filter(m => m.id !== material.id));
        setSuccessDialog({ visible: true, message: '材料已删除' });
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除材料失败:', error);
      setSuccessDialog({ visible: true, message: '删除失败，请重试' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ visible: false, material: null });
  };

  // 打开编辑名称对话框
  const handleEditClick = (material: Material) => {
    setEditModal({
      visible: true,
      material,
      title: material.title,
    });
  };

  // 保存名称修改
  const handleSaveTitle = async () => {
    if (!editModal.material || !editModal.title.trim()) return;
    
    const newTitle = editModal.title.trim();
    
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：PUT /api/v1/materials/:id
       * Body 参数：title: string
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${editModal.material.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      
      if (response.ok) {
        // 更新本地列表
        setMaterials(prev => prev.map(m => 
          m.id === editModal.material!.id ? { ...m, title: newTitle } : m
        ));
        setSuccessDialog({ visible: true, message: '名称已更新' });
      }
    } catch (error) {
      console.error('更新名称失败:', error);
      setSuccessDialog({ visible: true, message: '更新失败，请重试' });
    } finally {
      setEditModal({ visible: false, material: null, title: '' });
    }
  };

  const handleAddMaterial = () => {
    router.push('/add-material');
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 获取素材状态描述
  const getMaterialStatus = (material: Material) => {
    if (material.status === 'ready') {
      return { text: '已就绪', color: theme.success, icon: 'circle-check' };
    }
    if (!material.full_text) {
      return { text: '待提取文本', color: theme.textMuted, icon: 'file-circle-plus' };
    }
    if (!material.sentences_count || material.sentences_count === 0) {
      return { text: '待切分', color: theme.accent, icon: 'scissors' };
    }
    return { text: '编辑中', color: theme.primary, icon: 'pen-to-square' };
  };

  const filteredMaterials = materials.filter(m => 
    m.title.toLowerCase().includes(searchText.toLowerCase())
  );

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
              后台管理
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            上传素材、编辑时间轴、切分音频
          </ThemedText>
        </ThemedView>

        {/* Quick Actions */}
        <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
          <TouchableOpacity 
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accent,
              padding: Spacing.lg,
              borderRadius: BorderRadius.lg,
              gap: Spacing.sm,
            }}
            onPress={() => router.push('/sentence-workshop')}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="wand-magic-sparkles" size={20} color={theme.buttonPrimaryText} />
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
              句库制作
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.primary,
              padding: Spacing.lg,
              borderRadius: BorderRadius.lg,
              gap: Spacing.sm,
            }}
            onPress={handleAddMaterial}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="plus" size={20} color={theme.buttonPrimaryText} />
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
              上传新素材（旧）
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <FontAwesome6 name="magnifying-glass" size={16} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="搜索材料..."
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Materials List */}
        <View style={styles.materialsSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
            共 {filteredMaterials.length} 个材料
          </ThemedText>

          {filteredMaterials.map((material) => {
            const status = getMaterialStatus(material);
            return (
              <View key={material.id} style={styles.materialCard}>
                <View style={styles.materialHeader}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.materialTitle}>
                      {material.title}
                    </ThemedText>
                    {/* 编辑名称按钮 */}
                    <TouchableOpacity 
                      onPress={() => handleEditClick(material)}
                      style={{
                        padding: Spacing.xs,
                        backgroundColor: theme.backgroundTertiary,
                        borderRadius: BorderRadius.sm,
                      }}
                    >
                      <FontAwesome6 name="pen" size={12} color={theme.textMuted} />
                    </TouchableOpacity>
                    {/* 状态标签 */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: status.color + '20',
                      paddingHorizontal: Spacing.sm,
                      paddingVertical: 2,
                      borderRadius: BorderRadius.sm,
                      gap: 4,
                    }}>
                      <FontAwesome6 name={status.icon as any} size={10} color={status.color} />
                      <ThemedText variant="tiny" color={status.color}>{status.text}</ThemedText>
                    </View>
                  </View>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    {formatDuration(material.duration)}
                  </ThemedText>
                </View>
                
                <View style={styles.materialStats}>
                  <View style={styles.statRow}>
                    <FontAwesome6 name="list" size={12} color={theme.textMuted} />
                    <ThemedText variant="caption" color={theme.textMuted}>
                      {material.sentences_count || 0} 句
                    </ThemedText>
                  </View>
                  <View style={styles.statRow}>
                    <FontAwesome6 name="circle-check" size={12} color={theme.success} />
                    <ThemedText variant="caption" color={theme.success}>
                      {material.completed_count || 0} 完成
                    </ThemedText>
                  </View>
                  {/* 显示文本状态 */}
                  <View style={styles.statRow}>
                    <FontAwesome6 
                      name={material.full_text ? "file-lines" : "file-circle-plus"} 
                      size={12} 
                      color={material.full_text ? theme.success : theme.textMuted} 
                    />
                    <ThemedText variant="caption" color={material.full_text ? theme.success : theme.textMuted}>
                      {material.full_text ? '已有文本' : '待提取'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.materialActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.timelineButton]}
                    onPress={() => router.push('/timestamp-editor', { materialId: material.id, title: material.title })}
                  >
                    <FontAwesome6 name="sliders" size={14} color="#fff" />
                    <ThemedText variant="smallMedium" color="#fff">时间轴</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.textButton]}
                    onPress={() => router.push('/text-split', { materialId: material.id, title: material.title })}
                  >
                    <FontAwesome6 name="scissors" size={14} color={theme.accent} />
                    <ThemedText variant="smallMedium" color={theme.accent}>切分</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => router.push('/admin-sentences', { materialId: material.id, title: material.title })}
                  >
                    <FontAwesome6 name="pen-to-square" size={14} color={theme.primary} />
                    <ThemedText variant="smallMedium" color={theme.primary}>编辑</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteClick(material)}
                  >
                    <FontAwesome6 name="trash" size={14} color={theme.error} />
                    <ThemedText variant="smallMedium" color={theme.error}>删除</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
          )})}

          {filteredMaterials.length === 0 && (
            <View style={styles.emptyState}>
              <FontAwesome6 name="folder-open" size={48} color={theme.textMuted} />
              <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
                {searchText ? '没有找到匹配的材料' : '暂无学习材料'}
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* 编辑名称 Modal */}
      <Modal
        visible={editModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal({ visible: false, material: null, title: '' })}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
        }}>
          <View style={{
            backgroundColor: theme.backgroundDefault,
            borderRadius: BorderRadius.xl,
            padding: Spacing.xl,
            width: '100%',
            maxWidth: 400,
          }}>
            <ThemedText variant="h4" color={theme.textPrimary} style={{ marginBottom: Spacing.lg }}>
              编辑材料名称
            </ThemedText>
            <TextInput
              style={{
                backgroundColor: theme.backgroundTertiary,
                borderRadius: BorderRadius.lg,
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.md,
                fontSize: 16,
                color: theme.textPrimary,
                marginBottom: Spacing.lg,
              }}
              value={editModal.title}
              onChangeText={(text) => setEditModal(prev => ({ ...prev, title: text }))}
              placeholder="输入材料名称"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  backgroundColor: theme.backgroundTertiary,
                  alignItems: 'center',
                }}
                onPress={() => setEditModal({ visible: false, material: null, title: '' })}
              >
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  backgroundColor: theme.primary,
                  alignItems: 'center',
                }}
                onPress={handleSaveTitle}
              >
                <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>保存</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* 删除确认对话框 */}
      <ConfirmDialog
        visible={deleteDialog.visible}
        title="删除材料"
        message={`确定要删除「${deleteDialog.material?.title}」吗？\n此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        confirmStyle="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      
      {/* 成功提示对话框 */}
      <ConfirmDialog
        visible={successDialog.visible}
        title="提示"
        message={successDialog.message}
        confirmText="确定"
        onConfirm={() => setSuccessDialog({ visible: false, message: '' })}
        onCancel={() => setSuccessDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}
