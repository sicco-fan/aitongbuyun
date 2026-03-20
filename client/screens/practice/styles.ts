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
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    progressBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginRight: Spacing.md,
    },
    progressBadgeText: {},
    sentenceCounter: {},
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing['2xl'],
      marginBottom: Spacing['2xl'],
    },
    audioControl: {
      alignItems: 'center',
      marginBottom: Spacing['2xl'],
    },
    playButton: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    playButtonDisabled: {
      backgroundColor: theme.textMuted,
      shadowOpacity: 0,
    },
    playCount: {
      marginTop: Spacing.md,
    },
    inputSection: {
      marginBottom: Spacing['2xl'],
    },
    inputLabel: {
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.lg,
      fontSize: 16,
      color: theme.textPrimary,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    resultSection: {
      marginBottom: Spacing['2xl'],
    },
    resultCard: {
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    resultSuccess: {
      backgroundColor: '#10B98120',
      borderWidth: 1,
      borderColor: theme.success,
    },
    resultError: {
      backgroundColor: '#EF444420',
      borderWidth: 1,
      borderColor: theme.error,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    resultIcon: {
      marginRight: Spacing.sm,
    },
    resultTitle: {},
    resultText: {},
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    button: {
      flex: 1,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.primary,
    },
    secondaryButton: {
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    hintButton: {
      backgroundColor: '#F59E0B20',
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    buttonText: {},
    hintText: {
      marginTop: Spacing.lg,
      padding: Spacing.lg,
      backgroundColor: '#F59E0B10',
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    completedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['6xl'],
    },
    completedIcon: {
      marginBottom: Spacing['2xl'],
    },
    completedTitle: {
      marginBottom: Spacing.md,
    },
    completedSubtitle: {
      textAlign: 'center',
      marginBottom: Spacing['2xl'],
    },
    statsRow: {
      flexDirection: 'row',
      marginBottom: Spacing['2xl'],
    },
    statItem: {
      alignItems: 'center',
      marginHorizontal: Spacing['2xl'],
    },
    statValue: {
      marginBottom: Spacing.xs,
    },
    hiddenAnswer: {
      backgroundColor: theme.backgroundTertiary,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginTop: Spacing.md,
    },
  });
};
