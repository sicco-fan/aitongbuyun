import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    header: {
      marginBottom: Spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    // 说明卡片
    infoCard: {
      alignItems: 'center',
      paddingVertical: Spacing['2xl'],
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    infoIcon: {
      width: 72,
      height: 72,
      borderRadius: BorderRadius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    infoTitle: {
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    infoDesc: {
      textAlign: 'center',
      lineHeight: 22,
    },
    // 上传选项
    importOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    importOptionIcon: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    importOptionContent: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    // 进度卡片
    progressCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: BorderRadius.full,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      marginTop: Spacing.lg,
    },
    // 格式说明
    formatSection: {
      marginTop: Spacing.xl,
    },
    formatTitle: {
      marginBottom: Spacing.md,
    },
    formatExample: {
      marginBottom: Spacing.md,
    },
    formatExampleCode: {
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    formatTips: {
      gap: Spacing.sm,
    },
    formatTipItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });
};
