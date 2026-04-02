import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { createStyles } from './styles';

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen backgroundColor={theme.backgroundRoot}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ThemedText variant="bodyMedium" color={theme.textSecondary} style={styles.updateDate}>
          更新日期：2024年1月1日
        </ThemedText>

        <ThemedText variant="h3" color={theme.textPrimary} style={styles.title}>
          隐私政策
        </ThemedText>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            引言
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            欢迎使用本英语学习应用（以下简称"本应用"）。本应用由个人开发者独立开发和运营。我非常重视您的隐私保护，本隐私政策旨在向您说明我如何收集、使用、存储和保护您的个人信息。请您在使用本应用前仔细阅读本政策。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            一、信息收集
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            为了提供完整的学习功能，我会收集以下信息：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 账户信息：用户名、头像（可选）
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 学习数据：学习进度、学习时长、错题记录
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 语音数据：用于语音识别功能（仅本地处理，不上传服务器）
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 设备信息：设备型号、操作系统版本（用于应用优化）
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            二、信息使用
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            我收集的信息将用于以下目的：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 提供个性化学习体验和进度跟踪
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 同步您的学习数据到云端，支持多设备使用
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 优化应用性能和用户体验
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 提供学习统计和分析报告
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            三、信息存储与安全
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            我采用行业标准的安全措施保护您的数据：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 数据传输采用 HTTPS 加密协议
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 服务器数据采用加密存储
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 严格限制数据访问权限
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            四、信息共享
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            我不会出售您的个人信息。仅在以下情况下可能共享您的数据：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 获得您的明确同意
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 法律法规要求的情形
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 与授权合作伙伴共享（如云服务提供商），并签署保密协议
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            五、用户权利
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            您对自己的个人信息享有以下权利：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 访问和获取您的个人数据
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 更正不准确的数据
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 删除您的账户和相关数据
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 撤回同意和退出服务
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            六、未成年人保护
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            我重视未成年人的隐私保护。如果您是18岁以下的未成年人，请在监护人陪同下使用本应用，并由监护人阅读本隐私政策。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            七、政策更新
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            我可能会不时更新本隐私政策。重大变更时，会在应用内以弹窗或公告形式通知您。继续使用本应用即表示您接受更新后的政策。
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
            八、联系我们
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
            如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我：
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
            • 电子邮箱：support@aidictation.com
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}
