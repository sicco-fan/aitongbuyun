import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Spacing['3xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.backgroundDefault,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
      alignItems: 'center',
    },
    headerControls: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    smallControlBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundDefault,
      justifyContent: 'center',
      alignItems: 'center',
    },
    smallControlBtnActive: {
      backgroundColor: theme.primary + '20',
    },
    progressContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 2,
    },
    sentenceCard: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      padding: Spacing.xl,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
    },
    wordContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    wordWrapper: {
      marginHorizontal: 2,
    },
    wordBox: {
      flexDirection: 'row',
    },
    char: {
      fontFamily: 'System',
    },
    hiddenChar: {
      color: theme.textMuted,
    },
    errorChar: {
      color: theme.error,
    },
    inputSection: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.xl,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: theme.border,
      paddingHorizontal: Spacing.lg,
    },
    input: {
      flex: 1,
      fontSize: 18,
      paddingVertical: Spacing.lg,
      color: theme.textPrimary,
    },
    inputVoiceBtn: {
      padding: Spacing.md,
    },
    translationCard: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      padding: Spacing.lg,
      backgroundColor: theme.accent + '15',
      borderRadius: BorderRadius.lg,
    },
    navButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xl,
      paddingVertical: Spacing.lg,
      paddingBottom: Spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    navBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBtnDisabled: {
      opacity: 0.3,
    },
    audioSettingsPanel: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.xs,
    },
    settingIcon: {
      width: 24,
    },
    settingLabel: {
      width: 40,
    },
    sliderContainer: {
      flex: 1,
      position: 'relative',
      height: 24,
      marginHorizontal: Spacing.sm,
    },
    sliderTrack: {
      position: 'absolute',
      top: 10,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
    },
    sliderFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      height: 4,
      backgroundColor: theme.primary,
      borderRadius: 2,
    },
    sliderThumb: {
      position: 'absolute',
      top: 6,
      width: 12,
      height: 12,
      backgroundColor: theme.primary,
      borderRadius: 6,
      marginLeft: -6,
    },
    sliderTouchArea: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
    },
    sliderTouchPoint: {
      flex: 1,
      height: '100%',
    },
    currentSpeedBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      minWidth: 48,
      alignItems: 'center',
    },
  });
};
