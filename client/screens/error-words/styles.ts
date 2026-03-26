import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['5xl'],
    },
    header: {
      marginBottom: Spacing.xl,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    statValue: {
      marginBottom: Spacing.xs,
    },
    statLabel: {
      // label styles
    },
    wordCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    wordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    wordText: {
      // word text styles
    },
    errorBadge: {
      backgroundColor: theme.error + '15',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    errorBadgeText: {
      color: theme.error,
    },
    sentenceContainer: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    sentenceText: {
      lineHeight: 24,
    },
    sentenceHint: {
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      gap: Spacing.xs,
    },
    practiceBtn: {
      backgroundColor: theme.primary + '15',
    },
    practiceBtnText: {
      color: theme.primary,
    },
    clearBtn: {
      backgroundColor: theme.backgroundTertiary,
    },
    clearBtnText: {
      color: theme.textMuted,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['5xl'],
    },
    emptyIcon: {
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      marginBottom: Spacing.sm,
    },
    emptyDesc: {
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    filterBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
    },
    filterBtnActive: {
      backgroundColor: theme.primary + '15',
    },
    filterBtnText: {
      color: theme.textSecondary,
    },
    filterBtnTextActive: {
      color: theme.primary,
    },
  });
};
