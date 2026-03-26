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
      marginBottom: Spacing['2xl'],
    },
    // 用户信息
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    userDetails: {
      flex: 1,
      marginLeft: Spacing.lg,
    },
    logoutBtn: {
      padding: Spacing.md,
    },
    loginPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: {},
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: Spacing['2xl'],
    },
    statCard: {
      width: '48%',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      marginRight: '4%',
    },
    statCardEven: {
      marginRight: 0,
    },
    statIcon: {
      marginBottom: Spacing.md,
    },
    statValue: {
      marginBottom: Spacing.xs,
    },
    statLabel: {},
    sectionHeader: {
      marginBottom: Spacing.lg,
    },
    infoCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {},
    infoValue: {},
    adminCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    adminIcon: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    adminContent: {
      flex: 1,
    },
  });
};
