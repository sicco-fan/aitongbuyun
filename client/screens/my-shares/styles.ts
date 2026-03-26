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
      marginLeft: Spacing.md,
    },
    subtitle: {
      marginTop: Spacing.xs,
    },
    shareCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    shareHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: Spacing.sm,
    },
    shareIconContainer: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.success + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    shareInfo: {
      flex: 1,
    },
    shareTitle: {
      marginBottom: Spacing.xs,
    },
    shareMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    metaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    shareDescription: {
      marginTop: Spacing.sm,
      lineHeight: 20,
    },
    shareFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cancelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.error + '15',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      gap: 4,
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.error,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['4xl'],
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyText: {
      marginBottom: Spacing.sm,
    },
    emptySubtext: {
      textAlign: 'center',
      paddingHorizontal: Spacing['2xl'],
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    createButtonText: {
      color: theme.buttonPrimaryText,
      fontSize: 15,
      fontWeight: '600',
    },
    editModal: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    editHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    editContent: {
      flex: 1,
      padding: Spacing.lg,
    },
    editLabel: {
      marginBottom: Spacing.sm,
    },
    editInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    editTextarea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    editFooter: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      flexDirection: 'row',
      gap: Spacing.md,
    },
    editBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    editCancelBtn: {
      backgroundColor: theme.backgroundTertiary,
    },
    editConfirmBtn: {
      backgroundColor: theme.primary,
    },
    editBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
};
