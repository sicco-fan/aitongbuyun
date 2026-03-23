import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
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

interface Sentence {
  id: number;
  text: string;
  audio_url: string | null;
  start_time: number;
  end_time: number;
  is_completed: boolean;
}

interface Material {
  id: number;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  sentences_count: number;
  completed_count: number;
  status: string;
  created_at: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMaterials = useCallback(async () => {
    try {
      /**
       * 服务端文件：server/src/routes/materials.ts
       * 接口：GET /api/v1/materials
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials`);
      const data = await response.json();
      
      if (data.materials) {
        // 只显示已准备好的素材（每个句子都有音频）
        const readyMaterials = data.materials.filter((m: Material) => {
          // 检查是否有句子且每个句子都有audio_url
          return m.sentences_count > 0 && m.status === 'ready';
        });
        setMaterials(readyMaterials);
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

  const handleGoToAdmin = () => {
    router.push('/admin');
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
            啃句大师
          </ThemedText>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            开始学习
          </ThemedText>
        </ThemedView>

        {/* Admin Entry Button */}
        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.backgroundDefault,
            padding: Spacing.lg,
            borderRadius: BorderRadius.lg,
            marginBottom: Spacing.lg,
            borderWidth: 1,
            borderColor: theme.border,
          }}
          onPress={handleGoToAdmin}
          activeOpacity={0.7}
        >
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: Spacing.md,
          }}>
            <FontAwesome6 name="gear" size={18} color={theme.buttonPrimaryText} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              后台管理
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted}>
              上传素材、编辑时间轴、切分音频
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Materials List */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="h4" color={theme.textPrimary}>
            学习材料
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted}>
            {materials.length} 个可学习
          </ThemedText>
        </View>

        {materials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="headphones" size={48} color={theme.textMuted} style={styles.emptyIcon} />
            <ThemedText variant="body" color={theme.textPrimary} style={styles.emptyText}>
              暂无学习材料
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              请先进入后台管理添加素材
            </ThemedText>
            <TouchableOpacity 
              style={{
                marginTop: Spacing.lg,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                backgroundColor: theme.primary,
                borderRadius: BorderRadius.md,
              }}
              onPress={handleGoToAdmin}
            >
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                进入后台管理
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          materials.map((material) => (
            <TouchableOpacity
              key={material.id}
              style={styles.materialCard}
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
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
