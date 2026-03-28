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
      fontSize: 28,
      fontWeight: '800',
      color: theme.textPrimary,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    courseCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    courseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    courseIcon: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.lg,
      backgroundColor: `${theme.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    courseInfo: {
      flex: 1,
    },
    courseTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    courseMeta: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    courseStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 2,
    },
    lessonCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    lessonNumber: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${theme.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    lessonNumberText: {
      fontSize: 16,
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
    voiceSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    voiceChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    voiceChipSelected: {
      backgroundColor: `${theme.primary}15`,
      borderColor: theme.primary,
    },
    voiceChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    voiceChipTextSelected: {
      color: theme.primary,
    },
    startButton: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    startButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.buttonPrimaryText,
    },
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: `${theme.success}15`,
      marginLeft: Spacing.sm,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.success,
    },
  });
};
