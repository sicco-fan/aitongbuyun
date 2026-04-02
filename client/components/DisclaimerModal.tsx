import React, { useState, useMemo } from 'react';
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

const DISCLAIMER_ACCEPTED_KEY = 'disclaimer_accepted_v1';

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
            <Text style={styles.icon}>⚠️</Text>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.title}>
              重要声明
            </ThemedText>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.error} style={styles.highlight}>
                版权免责声明
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
                1. 预置内容仅供学习研究使用，不拥有相关版权
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                2. 请在下载后24小时内自行删除相关内容
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                3. 如需长期使用，请购买正版教材
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                4. 用户未在规定时间内删除所导致的侵权问题，由用户自行承担全部责任
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.sectionTitle}>
                免责条款
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.paragraph}>
                本应用开发者不对以下情况承担任何法律责任：
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • 用户未在24小时内删除预置内容
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • 用户将预置内容用于商业用途
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • 用户二次传播或分享预置内容
              </ThemedText>
              <ThemedText variant="body" color={theme.textSecondary} style={styles.listItem}>
                • 其他因用户违规使用导致的法律纠纷
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
      maxWidth: 400,
      maxHeight: '85%',
      overflow: 'hidden',
    },
    header: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    icon: {
      fontSize: 40,
      marginBottom: Spacing.sm,
    },
    title: {
      fontWeight: '600',
    },
    content: {
      padding: Spacing.lg,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
    highlight: {
      fontWeight: '600',
      marginBottom: Spacing.sm,
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
