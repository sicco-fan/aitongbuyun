import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['3xl'],
    },
    
    header: {
      marginBottom: Spacing.xl,
    },
    title: {
      marginBottom: Spacing.xs,
    },
    subtitle: {
      marginTop: Spacing.xs,
    },
    
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyText: {
      marginBottom: Spacing.sm,
    },
    
    wordCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
    },
    wordInfo: {
      flex: 1,
    },
    wordText: {
      marginBottom: Spacing.xs,
    },
    sentenceText: {
      fontStyle: 'italic',
    },
    wordMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    errorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: theme.error + '15',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    errorCount: {
      color: theme.error,
    },
    
    deleteBtn: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    clearAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.error + '10',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginTop: Spacing.xl,
    },
    clearAllText: {
      color: theme.error,
    },
    
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    wordCount: {
      color: theme.textMuted,
    },
  });
};
