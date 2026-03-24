import React, { useState, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createStyles } from './styles';

export default function SentenceWorkshopScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const menuItems = [
    {
      id: 'create',
      title: '创建新句库文件',
      description: '上传音频/视频文件或导入链接，生成原始音频',
      icon: 'file-circle-plus',
      color: theme.primary,
      route: '/create-sentence-file',
    },
    {
      id: 'text',
      title: '置入句子文本文件',
      description: '从原始音频提取文本，可编辑并保存',
      icon: 'file-lines',
      color: theme.accent,
      route: '/edit-text-content',
    },
    {
      id: 'audio',
      title: '剪辑制作句子语音',
      description: '按文本切分句子，手动分配时间戳',
      icon: 'scissors',
      color: theme.success,
      route: '/edit-sentence-audio',
    },
  ];

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
              句库制作
            </ThemedText>
            <View style={{ width: 20 }} />
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            分步制作学习句库
          </ThemedText>
        </ThemedView>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
                <FontAwesome6 name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuHeader}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    {item.title}
                  </ThemedText>
                  <View style={[styles.stepBadge, { backgroundColor: item.color }]}>
                    <ThemedText variant="tiny" color="#fff">{index + 1}</ThemedText>
                  </View>
                </View>
                <ThemedText variant="caption" color={theme.textMuted}>
                  {item.description}
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>
            制作流程说明
          </ThemedText>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <View style={[styles.infoNumber, { backgroundColor: theme.primary }]}>
                <ThemedText variant="tiny" color="#fff">1</ThemedText>
              </View>
              <ThemedText variant="small" color={theme.textMuted}>
                上传音频/视频文件或导入链接
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.infoNumber, { backgroundColor: theme.accent }]}>
                <ThemedText variant="tiny" color="#fff">2</ThemedText>
              </View>
              <ThemedText variant="small" color={theme.textMuted}>
                提取文本并编辑，按空行分句
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.infoNumber, { backgroundColor: theme.success }]}>
                <ThemedText variant="tiny" color="#fff">3</ThemedText>
              </View>
              <ThemedText variant="small" color={theme.textMuted}>
                为每个句子分配音频时间戳
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
