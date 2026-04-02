import React, { useMemo } from 'react';
import { View, Image, Linking, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { createStyles } from './styles';
import { Link } from 'expo-router';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildVersion = Constants.expoConfig?.extra?.buildVersion || '1';

  const handleOpenEmail = () => {
    Linking.openURL('mailto:support@aidictation.com');
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot}>
      <View style={styles.container}>
        {/* 应用图标和名称 */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.appIcon}
          />
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.appName}>
            AI听写云
          </ThemedText>
          <ThemedText variant="bodyMedium" color={theme.textSecondary}>
            版本 {appVersion} ({buildVersion})
          </ThemedText>
        </View>

        {/* 应用介绍 */}
        <View style={styles.section}>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.description}>
            AI听写云是一款智能英语学习应用，通过语音识别技术帮助您提升英语口语和听力能力。
          </ThemedText>
        </View>

        {/* 主要功能 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            主要功能
          </ThemedText>
          <View style={styles.featureList}>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.featureItem}>
              • 智能语音识别，实时评估发音
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.featureItem}>
              • 多种AI音色，沉浸式学习体验
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.featureItem}>
              • 错题智能收集，针对性练习
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.featureItem}>
              • 学习数据统计，追踪进步轨迹
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.featureItem}>
              • 自定义句库，个性化学习内容
            </ThemedText>
          </View>
        </View>

        {/* 联系方式 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            联系我们
          </ThemedText>
          <TouchableOpacity style={styles.contactItem} onPress={handleOpenEmail}>
            <ThemedText variant="body" color={theme.primary}>
              📧 support@aidictation.com
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* 法律链接 */}
        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            法律信息
          </ThemedText>
          <View style={styles.linkList}>
            <Link href="/privacy-policy" asChild>
              <TouchableOpacity style={styles.linkItem}>
                <ThemedText variant="body" color={theme.primary}>
                  隐私政策
                </ThemedText>
              </TouchableOpacity>
            </Link>
            <Link href="/user-agreement" asChild>
              <TouchableOpacity style={styles.linkItem}>
                <ThemedText variant="body" color={theme.primary}>
                  用户协议
                </ThemedText>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* 版权信息 */}
        <View style={styles.footer}>
          <ThemedText variant="caption" color={theme.textMuted}>
            © 2024 AI听写云. All rights reserved.
          </ThemedText>
        </View>
      </View>
    </Screen>
  );
}
