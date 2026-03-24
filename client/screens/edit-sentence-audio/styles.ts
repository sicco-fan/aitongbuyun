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
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['3xl'],
      gap: Spacing.md,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['3xl'],
      gap: Spacing.md,
    },
    createButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    fileInfoCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    fileInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    fileInfoContent: {
      flex: 1,
    },
    playerSection: {
      marginBottom: Spacing.xl,
    },
    currentTimeDisplay: {
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    instructions: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    instructionList: {
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    instructionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sentencesSection: {
      marginBottom: Spacing.xl,
    },
    sentencesList: {
      marginTop: Spacing.md,
      gap: Spacing.md,
    },
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    sentenceCardSelected: {
      borderColor: theme.primary,
    },
    sentenceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    sentenceNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sentenceText: {
      lineHeight: 24,
      marginBottom: Spacing.md,
    },
    timeEditor: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    timeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: Spacing.sm,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.sm,
    },
    timeInput: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      fontSize: 14,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    audioStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    actionButtons: {
      gap: Spacing.md,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.success,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
    },
    generateButtonDisabled: {
      opacity: 0.6,
    },
  });
};
