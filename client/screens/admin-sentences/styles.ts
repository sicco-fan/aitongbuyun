import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing["2xl"],
      paddingBottom: Spacing["5xl"],
    },
    header: {
      marginBottom: Spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    sentencesSection: {
      gap: Spacing.md,
    },
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    sentenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    sentenceIndex: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sentenceDuration: {
      backgroundColor: theme.primary + '15',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
    },
    sentenceText: {
      marginBottom: Spacing.md,
      lineHeight: 24,
    },
    sentenceActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      paddingTop: Spacing.md,
    },
    sentenceActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: Platform.OS === 'web' ? 400 : '90%',
      maxWidth: 400,
    },
    modalTitle: {
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    formGroup: {
      marginBottom: Spacing.md,
    },
    formRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    textInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginTop: Spacing.xs,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    modalButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.backgroundTertiary,
    },
    saveButton: {
      backgroundColor: theme.primary,
    },
    infoBox: {
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    previewBox: {
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
    },
  });
};
