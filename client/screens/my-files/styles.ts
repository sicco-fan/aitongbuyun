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
    fileCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    fileHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: Spacing.sm,
    },
    fileIconContainer: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    fileInfo: {
      flex: 1,
    },
    fileTitle: {
      marginBottom: Spacing.xs,
    },
    fileMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    metaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    fileActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      gap: 4,
    },
    editBtn: {
      backgroundColor: theme.primary + '15',
    },
    shareBtn: {
      backgroundColor: theme.accent + '15',
    },
    deleteBtn: {
      backgroundColor: theme.error + '15',
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '500',
    },
    shareBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success + '15',
      paddingVertical: 2,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
      gap: 4,
    },
    shareBadgeText: {
      fontSize: 11,
      color: theme.success,
    },
    presetBadge: {
      paddingVertical: 2,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
    },
    presetBadgeText: {
      fontSize: 11,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      width: '85%',
      maxWidth: 400,
    },
    modalTitle: {
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    modalInput: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    modalTextarea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    cancelBtn: {
      backgroundColor: theme.backgroundTertiary,
    },
    confirmBtn: {
      backgroundColor: theme.primary,
    },
    modalBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
};
