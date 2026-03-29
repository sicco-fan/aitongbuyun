import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing['4xl'],
    },
    header: {
      marginBottom: Spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionHeaderMargin: {
      marginTop: Spacing.lg,
    },
    // 卡片样式 - 极致紧凑版
    materialCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      padding: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    lastLearnedCard: {
      borderWidth: 1.5,
      borderColor: theme.success + '50',
    },
    lastLearnedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: BorderRadius.full,
      marginBottom: 4,
    },
    materialHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    materialIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    materialInfo: {
      flex: 1,
      marginLeft: 10,
      justifyContent: 'center',
    },
    materialTitle: {
      marginBottom: 1,
    },
    materialMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    materialArrow: {
      paddingLeft: 4,
    },
    progressSection: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    progressBar: {
      height: 4,
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
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    emptyIconContainer: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.accent + '12',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    emptyText: {
      marginBottom: 2,
    },
    emptySubtext: {
      textAlign: 'center',
    },
    // 继续学习卡片样式 - 极致紧凑
    continueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      padding: 10,
      marginBottom: 6,
      borderWidth: 1,
    },
    continueIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    continueInfo: {
      flex: 1,
      marginLeft: 10,
      justifyContent: 'center',
    },
    continueProgress: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.success + '20',
      marginRight: 4,
    },
    // 错题本卡片样式 - 极致紧凑
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      padding: 10,
      marginBottom: 6,
      borderWidth: 1,
    },
    errorIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorInfo: {
      flex: 1,
      marginLeft: 10,
      justifyContent: 'center',
    },
    errorBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      marginRight: 4,
    },
  });
};
