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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.textPrimary,
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
      backgroundColor: theme.accent + '15',
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
    downloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.sm,
      gap: 6,
    },
    downloadBtnText: {
      color: theme.buttonPrimaryText,
      fontSize: 14,
      fontWeight: '600',
    },
    downloadCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
    loadingMore: {
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    detailModal: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    detailContent: {
      flex: 1,
      padding: Spacing.lg,
    },
    detailTitle: {
      marginBottom: Spacing.sm,
    },
    detailMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    detailDescription: {
      marginBottom: Spacing.lg,
      lineHeight: 22,
    },
    sentencesSection: {
      marginTop: Spacing.md,
    },
    sectionTitle: {
      marginBottom: Spacing.md,
    },
    sentenceItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    sentenceIndex: {
      width: 28,
      color: theme.textMuted,
      fontSize: 13,
    },
    sentenceText: {
      flex: 1,
      lineHeight: 20,
    },
    detailFooter: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    downloadedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success + '15',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      gap: 6,
    },
    downloadedText: {
      color: theme.success,
      fontSize: 15,
      fontWeight: '600',
    },
  });
};
