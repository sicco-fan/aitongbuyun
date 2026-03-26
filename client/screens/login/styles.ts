import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing['3xl'],
    },
    header: {
      marginBottom: Spacing['3xl'],
    },
    subtitle: {
      marginTop: Spacing.sm,
    },
    inputGroup: {
      marginBottom: Spacing.lg,
    },
    input: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginTop: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: Spacing.md,
    },
    codeInput: {
      flex: 1,
    },
    codeBtn: {
      backgroundColor: theme.primary + '20',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      minWidth: 100,
      alignItems: 'center',
    },
    codeBtnDisabled: {
      opacity: 0.5,
    },
    codeBtnText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    loginBtn: {
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    loginBtnDisabled: {
      opacity: 0.7,
    },
    loginBtnText: {
      color: theme.buttonPrimaryText,
      fontSize: 16,
      fontWeight: '600',
    },
    guestBtn: {
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    guestBtnText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    agreement: {
      color: theme.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: Spacing['3xl'],
    },
  });
};
