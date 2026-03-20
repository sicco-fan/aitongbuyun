import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing } from '@/constants/theme';

interface Material {
  id: number;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  sentences_count: number;
  completed_count: number;
  created_at: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, totalSentences: 0 });

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
        // 计算统计数据
        const total = data.materials.length;
        const completed = data.materials.filter((m: Material) => 
          m.completed_count === m.sentences_count && m.sentences_count > 0
        ).length;
        const totalSentences = data.materials.reduce((sum: number, m: Material) => 
          sum + m.sentences_count, 0
        );
        setStats({ total, completed, totalSentences });
      }
    } catch (error) {
      console.error('获取材料列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMaterials();
    }, [fetchMaterials])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMaterials();
  };

  const handleMaterialPress = (material: Material) => {
    router.push('/practice', { materialId: material.id, title: material.title });
  };

  const handleDeleteMaterial = async (material: Material) => {
    // Web 端使用 confirm，移动端使用 Alert
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`确定要删除「${material.title}」吗？\n此操作将删除该材料及其所有句子数据，且不可恢复。`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '删除材料',
            `确定要删除「${material.title}」吗？\n此操作将删除该材料及其所有句子数据，且不可恢复。`,
            [
              { text: '取消', style: 'cancel', onPress: () => resolve(false) },
              { text: '删除', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${material.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setMaterials(prev => prev.filter(m => m.id !== material.id));
        if (Platform.OS === 'web') {
          alert('材料已删除');
        } else {
          Alert.alert('成功', '材料已删除');
        }
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除材料失败:', error);
      if (Platform.OS === 'web') {
        alert('删除材料失败');
      } else {
        Alert.alert('错误', '删除材料失败');
      }
    }
  };

  const handleAddMaterial = () => {
    router.push('/add-material');
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgress = (material: Material) => {
    if (material.sentences_count === 0) return 0;
    return (material.completed_count / material.sentences_count) * 100;
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <ThemedText variant="caption" color={theme.textMuted} style={styles.greeting}>
            听力训练
          </ThemedText>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            今日学习
          </ThemedText>
        </ThemedView>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ThemedText variant="h2" color={theme.textPrimary} style={styles.statValue}>
              {stats.total}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              学习材料
            </ThemedText>
          </View>
          <View style={[styles.statCard, styles.statCardLast]}>
            <ThemedText variant="h2" color={theme.primary} style={styles.statValue}>
              {stats.completed}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              已完成
            </ThemedText>
          </View>
        </View>

        {/* Materials List */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="h4" color={theme.textPrimary}>
            学习材料
          </ThemedText>
        </View>

        {materials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="headphones" size={48} color={theme.textMuted} style={styles.emptyIcon} />
            <ThemedText variant="body" color={theme.textPrimary} style={styles.emptyText}>
              暂无学习材料
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              点击右下角按钮添加你的第一个音频材料
            </ThemedText>
          </View>
        ) : (
          materials.map((material) => (
            <View
              key={material.id}
              style={styles.materialCard}
            >
              <TouchableOpacity 
                style={{ flex: 1 }}
                onPress={() => handleMaterialPress(material)}
                activeOpacity={0.7}
              >
                <ThemedText variant="title" color={theme.textPrimary} style={styles.materialTitle}>
                  {material.title}
                </ThemedText>
                {material.description ? (
                  <ThemedText variant="small" color={theme.textMuted} numberOfLines={2}>
                    {material.description}
                  </ThemedText>
                ) : null}
                
                <View style={styles.materialMeta}>
                  <View style={styles.materialMetaItem}>
                    <FontAwesome6 name="clock" size={12} color={theme.textMuted} style={styles.materialMetaIcon} />
                    <ThemedText variant="caption" color={theme.textMuted}>
                      {formatDuration(material.duration)}
                    </ThemedText>
                  </View>
                  <View style={styles.materialMetaItem}>
                    <FontAwesome6 name="list" size={12} color={theme.textMuted} style={styles.materialMetaIcon} />
                    <ThemedText variant="caption" color={theme.textMuted}>
                      {material.sentences_count} 句
                    </ThemedText>
                  </View>
                </View>

                {material.sentences_count > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[styles.progressFill, { width: `${getProgress(material)}%` }]} 
                      />
                    </View>
                    <ThemedText variant="tiny" color={theme.textMuted} style={styles.progressText}>
                      {material.completed_count}/{material.sentences_count} 已完成 ({Math.round(getProgress(material))}%)
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* 删除按钮 */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteMaterial(material)}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="trash" size={18} color={theme.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddMaterial} activeOpacity={0.8}>
        <FontAwesome6 name="plus" size={24} color={theme.buttonPrimaryText} />
      </TouchableOpacity>
    </Screen>
  );
}
