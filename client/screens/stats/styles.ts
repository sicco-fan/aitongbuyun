import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['5xl'],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    emptyText: {
      marginTop: Spacing.lg,
    },
    sectionHeader: {
      marginBottom: Spacing.md,
      marginTop: Spacing.lg,
    },
    // 今日卡片
    todayCards: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    statCard: {
      flex: 1,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
    },
    statValue: {
      color: '#FFF',
      fontSize: 20,
      fontWeight: '700',
      marginTop: Spacing.sm,
    },
    statLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      marginTop: Spacing.xs,
    },
    // 总览卡片
    overviewCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.lg,
    },
    overviewRow: {
      flexDirection: 'row',
      paddingVertical: Spacing.md,
    },
    overviewItem: {
      flex: 1,
      alignItems: 'center',
    },
    overviewValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    overviewLabel: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    overviewDivider: {
      width: 1,
      backgroundColor: theme.borderLight,
    },
    // 空卡片
    emptyCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing['2xl'],
      alignItems: 'center',
    },
    // 句库卡片
    fileCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    fileCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fileIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    fileCardStats: {
      flexDirection: 'row',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    fileStatItem: {
      flex: 1,
      alignItems: 'center',
    },
    fileStatValue: {
      fontSize: 16,
      fontWeight: '700',
    },
    fileStatLabel: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
  });
};
