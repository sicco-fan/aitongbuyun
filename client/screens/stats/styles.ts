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
    // 句库列表卡片（简洁版）
    fileListCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    fileItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    fileIconSmall: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileItemInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    fileItemRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    fileItemCount: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
};
