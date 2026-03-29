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
      marginBottom: Spacing['2xl'],
    },
    greeting: {
      marginBottom: Spacing.xs,
      letterSpacing: 1,
    },
    title: {
      marginBottom: Spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    materialCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      // 柔和阴影
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    materialHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    materialIconContainer: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
    },
    materialInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    materialTitle: {
      marginBottom: Spacing.xs,
    },
    materialMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    metaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    materialArrow: {
      paddingLeft: Spacing.sm,
    },
    progressSection: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['6xl'],
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyText: {
      marginBottom: Spacing.sm,
    },
    emptySubtext: {
      textAlign: 'center',
    },
    // 继续学习卡片样式
    continueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
    },
    continueIconContainer: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    continueButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.success + '20',
      marginRight: Spacing.sm,
    },
    // 错题本卡片样式
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
    },
    errorIconContainer: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    errorBadge: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      marginRight: Spacing.sm,
    },
    courseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
    },
    courseIconContainer: {
      width: 52,
      height: 52,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    courseInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
  });
};
