import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    // Header Bar
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.backgroundRoot,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholder: {
      width: 44,
    },
    
    // Scroll Content
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['5xl'],
    },
    
    // Success Banner
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    successText: {
      flex: 1,
    },
    
    // Info Section
    infoSection: {
      flexDirection: 'row',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      gap: Spacing.md,
    },
    infoIcon: {
      marginTop: 2,
    },
    
    // Form
    formGroup: {
      marginBottom: Spacing.xl,
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
    
    // File Picker
    filePicker: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: theme.primary,
      borderStyle: 'dashed',
      padding: Spacing['2xl'],
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 160,
    },
    filePickerIconContainer: {
      width: 72,
      height: 72,
      borderRadius: BorderRadius.full,
      backgroundColor: `${theme.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    filePickerText: {
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    filePickerHint: {
      textAlign: 'center',
    },
    
    // File Info
    fileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.primary,
      padding: Spacing.lg,
    },
    fileIconContainer: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.lg,
      backgroundColor: `${theme.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
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
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Supported Formats
    supportedFormats: {
      marginTop: Spacing.md,
      padding: Spacing.lg,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
    },
    formatTitle: {
      marginBottom: Spacing.sm,
    },
    
    // Submit Button
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
      marginTop: Spacing['2xl'],
    },
    submitButtonDisabled: {
      backgroundColor: theme.textMuted,
      opacity: 0.6,
    },
    buttonIcon: {
      marginRight: Spacing.sm,
    },
    submitHint: {
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    
    // Uploading State
    uploadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['6xl'],
      paddingHorizontal: Spacing.xl,
    },
    uploadingText: {
      marginTop: Spacing.lg,
      textAlign: 'center',
    },
    uploadingHint: {
      marginTop: Spacing.sm,
      textAlign: 'center',
      paddingHorizontal: Spacing['2xl'],
    },
    // Progress Bar
    progressBarContainer: {
      width: '80%',
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      marginTop: Spacing.lg,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    progressText: {
      marginTop: Spacing.sm,
      fontSize: 12,
      color: theme.textMuted,
    },
  });
};
