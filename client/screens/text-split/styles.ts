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
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      gap: Spacing.xs,
    },
    extractBtn: {
      backgroundColor: theme.primary,
    },
    autoSplitBtn: {
      backgroundColor: theme.accent,
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
    previewSection: {
      marginBottom: Spacing.xl,
    },
    sectionLabel: {
      marginBottom: Spacing.md,
    },
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    sentenceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    sentenceNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sentenceActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    smallBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sentenceInput: {
      fontSize: 16,
      color: theme.textPrimary,
      lineHeight: 24,
      minHeight: 44,
      textAlignVertical: 'top',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    emptyText: {
      marginTop: Spacing.md,
    },
  });
};
