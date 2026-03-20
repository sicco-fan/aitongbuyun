import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
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
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    progressRow: {
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    sentenceNav: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    navBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBtnDisabled: {
      opacity: 0.3,
    },
    sentenceContent: {
      flex: 1,
      paddingHorizontal: Spacing.md,
    },
    sentenceText: {
      lineHeight: 28,
      textAlign: 'center',
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    timeBox: {
      alignItems: 'center',
    },
    playerSection: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    progressBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    timeLabel: {
      fontSize: 12,
      width: 60,
      textAlign: 'center',
    },
    sliderContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    slider: {
      width: '100%',
      height: 40,
    },
    playControls: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.lg,
    },
    playBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playSentenceBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    timestampButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    timestampBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    startBtn: {
      backgroundColor: theme.primary,
    },
    endBtn: {
      backgroundColor: theme.success,
    },
    listSection: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    listItemActive: {
      backgroundColor: theme.primary + '15',
      borderColor: theme.primary,
    },
    listItemNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    listItemText: {
      flex: 1,
      marginHorizontal: Spacing.sm,
    },
    backBtn: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
    },
  });
};
