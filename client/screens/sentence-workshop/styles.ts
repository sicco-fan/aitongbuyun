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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    menuSection: {
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    menuIconContainer: {
      width: 52,
      height: 52,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuContent: {
      flex: 1,
    },
    menuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 4,
    },
    stepBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    infoSection: {
      marginBottom: Spacing.lg,
    },
    infoCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    infoNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
