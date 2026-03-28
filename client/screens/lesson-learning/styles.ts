import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['5xl'],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Spacing['4xl'],
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      position: 'absolute',
      left: 0,
      top: 0,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 2,
      marginBottom: Spacing.xl,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 2,
    },
    audioButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.primary}15`,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    inputSection: {
      marginBottom: Spacing.lg,
    },
    input: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      fontSize: 16,
      color: theme.textPrimary,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    inputCorrect: {
      borderWidth: 2,
      borderColor: theme.success,
    },
    inputWrong: {
      borderWidth: 2,
      borderColor: theme.error,
    },
    chineseCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    primaryBtn: {
      backgroundColor: theme.primary,
    },
    secondaryBtn: {
      backgroundColor: theme.backgroundTertiary,
    },
    backButton: {
      marginTop: Spacing.xl,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.primary,
    },
  });
};
