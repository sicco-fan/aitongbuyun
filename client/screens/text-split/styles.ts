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
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    subtitle: {
      textAlign: 'center',
    },
    actionBar: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    extractBtn: {
      backgroundColor: theme.primary,
    },
    saveBtn: {
      backgroundColor: theme.success,
    },
    disabledBtn: {
      opacity: 0.5,
    },
    tipBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent + '15',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    editorSection: {
      marginBottom: Spacing.xl,
    },
    sectionLabel: {
      marginBottom: Spacing.sm,
    },
    textInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      fontSize: 16,
      color: theme.textPrimary,
      minHeight: 200,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    previewSection: {
      marginBottom: Spacing.xl,
    },
    sentenceItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.backgroundDefault,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    sentenceNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
      marginTop: 2,
    },
    sentenceText: {
      flex: 1,
      lineHeight: 22,
    },
  });
};
