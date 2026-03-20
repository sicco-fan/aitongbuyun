import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing['2xl'],
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    header: {
      marginBottom: Spacing['3xl'],
    },
    title: {},
    subtitle: {
      marginTop: Spacing.sm,
    },
    formGroup: {
      marginBottom: Spacing['2xl'],
    },
    label: {
      marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      fontSize: 16,
      color: theme.textPrimary,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    filePicker: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      padding: Spacing['2xl'],
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 150,
    },
    filePickerIcon: {
      marginBottom: Spacing.md,
    },
    filePickerText: {
      textAlign: 'center',
    },
    filePickerHint: {
      marginTop: Spacing.sm,
    },
    fileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
    },
    fileIcon: {
      marginRight: Spacing.md,
    },
    fileDetails: {
      flex: 1,
    },
    fileName: {
      marginBottom: Spacing.xs,
    },
    fileSize: {},
    removeFile: {
      padding: Spacing.sm,
    },
    supportedFormats: {
      marginTop: Spacing.lg,
      padding: Spacing.lg,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
    },
    formatTitle: {
      marginBottom: Spacing.sm,
    },
    formatList: {},
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing['3xl'],
    },
    button: {
      flex: 1,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
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
    uploadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['6xl'],
    },
    uploadingText: {
      marginTop: Spacing.lg,
    },
    uploadingHint: {
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
  });
};
