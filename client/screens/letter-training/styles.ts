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
    title: {
      marginBottom: Spacing.sm,
    },
    subtitle: {
      lineHeight: 22,
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
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    progressText: {
      color: theme.primary,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 4,
    },
    
    // 当前字母卡片
    currentLetterCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing['2xl'],
      marginBottom: Spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    currentLetter: {
      fontSize: 80,
      fontWeight: '700',
      color: theme.primary,
      marginBottom: Spacing.md,
    },
    currentLetterHint: {
      color: theme.textMuted,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    recordingCount: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    recordingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.border,
    },
    recordingDotActive: {
      backgroundColor: theme.success,
    },
    
    // 录音按钮
    recordButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    recordButtonActive: {
      backgroundColor: theme.error,
    },
    recordButtonText: {
      color: theme.buttonPrimaryText,
      fontSize: 14,
      fontWeight: '600',
    },
    
    // 字母网格
    letterGrid: {
      marginBottom: Spacing.xl,
    },
    letterGridTitle: {
      marginBottom: Spacing.md,
    },
    letterRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    letterCell: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    letterCellCurrent: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '20',
    },
    letterCellComplete: {
      backgroundColor: theme.success + '20',
      borderColor: theme.success,
    },
    letterCellText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    letterCellTextComplete: {
      color: theme.success,
    },
    letterCellTextCurrent: {
      color: theme.primary,
    },
    
    // 底部按钮
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    button: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.primary,
    },
    secondaryButton: {
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonText: {
      fontWeight: '600',
    },
    
    // 状态提示
    statusMessage: {
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.lg,
      alignItems: 'center',
    },
    statusSuccess: {
      backgroundColor: theme.success + '20',
    },
    statusError: {
      backgroundColor: theme.error + '20',
    },
    statusMessageText: {
      textAlign: 'center',
    },
    
    // 完成界面
    completedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['6xl'],
    },
    completedIcon: {
      marginBottom: Spacing['2xl'],
    },
    completedTitle: {
      marginBottom: Spacing.md,
    },
    completedSubtitle: {
      textAlign: 'center',
      marginBottom: Spacing['2xl'],
      paddingHorizontal: Spacing.xl,
    },
  });
};
