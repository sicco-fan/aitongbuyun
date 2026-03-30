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
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    lessonCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    lastLearnedCard: {
      borderWidth: 2,
      borderColor: theme.success + '40',
    },
    lessonNumber: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${theme.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    lessonNumberText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.primary,
    },
    lessonInfo: {
      flex: 1,
    },
    lessonTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    lessonSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    lessonMeta: {
      fontSize: 12,
      color: theme.textMuted,
    },
    lastLearnedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginTop: Spacing.xs,
    },
    arrowIcon: {
      marginLeft: Spacing.sm,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Spacing['4xl'],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Spacing['4xl'],
    },
    emptyText: {
      fontSize: 16,
      color: theme.textMuted,
      marginTop: Spacing.md,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    backButtonText: {
      fontSize: 15,
      color: theme.primary,
      marginLeft: Spacing.sm,
    },
    // 学习监控按钮
    monitorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    monitorIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    monitorInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
  });
};
