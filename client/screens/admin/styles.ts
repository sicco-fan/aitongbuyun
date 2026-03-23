import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing["2xl"],
      paddingBottom: Spacing["5xl"],
    },
    header: {
      marginBottom: Spacing.xl,
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
    searchSection: {
      marginBottom: Spacing.lg,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      height: 48,
    },
    searchIcon: {
      marginRight: Spacing.md,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
    },
    materialsSection: {
      gap: Spacing.md,
    },
    sectionTitle: {
      marginBottom: Spacing.sm,
    },
    materialCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    materialHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.md,
    },
    materialTitle: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    materialStats: {
      flexDirection: 'row',
      gap: Spacing.lg,
      marginBottom: Spacing.md,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    materialActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      gap: Spacing.xs,
    },
    timelineButton: {
      backgroundColor: theme.primary,
    },
    textButton: {
      backgroundColor: theme.accent + '15',
    },
    editButton: {
      backgroundColor: theme.primary + '15',
    },
    deleteButton: {
      backgroundColor: theme.error + '15',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing["3xl"],
    },
    emptyText: {
      marginTop: Spacing.md,
    },
  });
};
