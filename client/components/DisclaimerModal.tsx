import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLAIMER_ACCEPTED_KEY = 'disclaimer_accepted_v2';

interface DisclaimerModalProps {
  visible: boolean;
  onAccept: () => void;
}

export function DisclaimerModal({ visible, onAccept }: DisclaimerModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleAccept = () => {
    AsyncStorage.setItem(DISCLAIMER_ACCEPTED_KEY, 'true');
    onAccept();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.icon}>📖</Text>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.title}>
              欢迎使用句子背诵助手
            </ThemedText>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 软件功能介绍 */}
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.primary} style={styles.highlight}>
                软件功能介绍
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
                本应用是一款智能句子背诵工具，帮助您通过"听-读-背"的方式高效学习语言。
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
                📝 创建学习内容
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
                您可以通过以下两种方式创建学习材料：
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                <Text style={styles.bold}>方式一：上传文本文档</Text>
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                支持 PDF、TXT、Word 等格式。系统将自动识别文本并生成对应的 AI 语音，让您边听边学。
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                <Text style={styles.bold}>方式二：上传音视频</Text>
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                上传视频、音频文件，或提供在线音视频链接。系统将自动识别语音内容，您只需简单调整句子切分和时间轴，即可生成学习材料。
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
                🎯 学习方式
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • <Text style={styles.bold}>语音复述</Text>：按住屏幕，口头复述句子，AI 自动识别并判断正误
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • <Text style={styles.bold}>打字输入</Text>：通过键盘输入句子，正确即可点亮文本
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • <Text style={styles.bold}>循序渐进</Text>：从听到读，从读到背，逐步掌握每个句子
              </ThemedText>
            </View>

            {/* 版权免责声明 */}
            <View style={styles.divider} />
            
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.error} style={styles.highlight}>
                ⚠️ 版权免责声明
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
                本应用内置的预置句库（包括新概念英语等学习材料）仅用于功能演示和技术研究目的。
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
                用户须知
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                1. 预置内容仅供功能演示，本应用不拥有相关版权
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                2. 请在下载后 24 小时内自行删除预置内容
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                3. 如需长期使用，请购买正版教材
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                4. 用户未按规定删除所导致的侵权问题，由用户自行承担全部责任
              </ThemedText>
            </View>

            <View style={styles.warningBox}>
              <ThemedText variant="body" color={theme.error} style={styles.warningText}>
                点击"我已阅读并同意"即表示您已完全理解并接受以上声明。如果您不同意，请立即卸载本应用。
              </ThemedText>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.button} onPress={handleAccept}>
              <Text style={styles.buttonText}>我已阅读并同意</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// 检查是否已同意免责声明
export async function checkDisclaimerAccepted(): Promise<boolean> {
  try {
    const accepted = await AsyncStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
    return accepted === 'true';
  } catch {
    return false;
  }
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    container: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      width: '100%',
      maxWidth: 420,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    header: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    icon: {
      fontSize: 40,
      marginBottom: Spacing.sm,
    },
    title: {
      fontWeight: '600',
      textAlign: 'center',
    },
    content: {
      padding: Spacing.lg,
    },
    section: {
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    highlight: {
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    paragraph: {
      lineHeight: 22,
      marginBottom: Spacing.xs,
    },
    listItem: {
      lineHeight: 22,
      marginBottom: Spacing.xs,
      paddingLeft: Spacing.sm,
    },
    bold: {
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: Spacing.md,
    },
    warningBox: {
      backgroundColor: theme.error + '15',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginTop: Spacing.sm,
    },
    warningText: {
      lineHeight: 22,
      fontWeight: '500',
    },
    footer: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
