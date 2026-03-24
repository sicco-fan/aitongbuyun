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
    subtitle: {
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    modeButtonActive: {
      backgroundColor: theme.primary,
    },
    formSection: {
      gap: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    formGroup: {
      gap: Spacing.sm,
    },
    textInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    uploadButton: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing['2xl'],
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.border,
    },
    fileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    fileIcon: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileDetails: {
      flex: 1,
    },
    progressSection: {
      marginBottom: Spacing.lg,
      alignItems: 'center',
    },
    progressBar: {
      width: '100%',
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.sm,
      overflow: 'hidden',
      marginBottom: Spacing.sm,
    },
    progressFill: {
      height: '100%',
      borderRadius: BorderRadius.sm,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
  });
};
