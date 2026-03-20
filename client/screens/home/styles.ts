import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing['2xl'],
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    header: {
      marginBottom: Spacing['3xl'],
    },
    greeting: {
      marginBottom: Spacing.xs,
    },
    title: {
      marginBottom: Spacing.sm,
    },
    statsRow: {
      flexDirection: 'row',
      marginBottom: Spacing['2xl'],
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      marginRight: Spacing.md,
    },
    statCardLast: {
      marginRight: 0,
    },
    statValue: {
      marginBottom: Spacing.xs,
    },
    statLabel: {},
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    materialCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    materialTitle: {
      marginBottom: Spacing.xs,
    },
    materialMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    materialMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    materialMetaIcon: {
      marginRight: Spacing.xs,
    },
    progressContainer: {
      marginTop: Spacing.md,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    progressText: {
      marginTop: Spacing.xs,
    },
    deleteButton: {
      padding: Spacing.md,
      marginLeft: Spacing.md,
      backgroundColor: theme.error + '20',
      borderRadius: BorderRadius.lg,
      alignSelf: 'center',
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['6xl'],
    },
    emptyIcon: {
      marginBottom: Spacing.lg,
    },
    emptyText: {
      marginBottom: Spacing.sm,
    },
    emptySubtext: {
      textAlign: 'center',
    },
    addButton: {
      position: 'absolute',
      right: Spacing['2xl'],
      bottom: Spacing['2xl'],
      width: 56,
      height: 56,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  });
};
