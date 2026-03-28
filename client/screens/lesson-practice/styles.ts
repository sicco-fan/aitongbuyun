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
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    backButtonText: {
      fontSize: 15,
      color: theme.primary,
      marginLeft: Spacing.sm,
    },
    voiceSection: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: Spacing.md,
    },
    voiceSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
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
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    sentenceIndex: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: Spacing.sm,
    },
    englishText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.textPrimary,
      lineHeight: 24,
      marginBottom: Spacing.sm,
    },
    chineseText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    audioButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.primary}15`,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
    },
    audioButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
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
    startButton: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
      alignItems: 'center',
      marginTop: Spacing.lg,
      marginBottom: Spacing['2xl'],
    },
    startButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.buttonPrimaryText,
    },
    progressInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    progressText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 2,
    },
  });
};
