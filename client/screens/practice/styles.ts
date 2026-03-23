import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['3xl'],
    },
    
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
    },
    headerControls: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    smallControlBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    smallControlBtnActive: {
      backgroundColor: theme.primary + '15',
    },
    
    // Progress
    progressContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
    },
    progressBar: {
      height: 3,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    
    // Audio Settings Panel (弹出面板)
    audioSettingsPanel: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    settingIcon: {
      width: 20,
    },
    settingLabel: {
      width: 35,
      textAlign: 'center',
    },
    sliderContainer: {
      flex: 1,
      height: 24,
      position: 'relative',
      justifyContent: 'center',
    },
    sliderTrack: {
      height: 4,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'visible',
    },
    sliderFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    sliderThumb: {
      position: 'absolute',
      top: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.primary,
      marginLeft: -6,
    },
    sliderTouchArea: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
    },
    sliderTouchPoint: {
      flex: 1,
      height: '100%',
    },
    currentSpeedBadge: {
      minWidth: 40,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Sentence Card
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    wordContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      alignItems: 'flex-end',
    },
    wordWrapper: {
      marginBottom: Spacing.xs,
    },
    wordBox: {
      flexDirection: 'row',
    },
    char: {
      fontSize: 26,
      fontWeight: '600',
      letterSpacing: 1,
    },
    hiddenChar: {
      opacity: 0.35,
    },
    errorChar: {
      // 错误字符由 color 控制，无需额外样式
    },
    
    // Input Section
    inputSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    input: {
      flex: 1,
      backgroundColor: theme.primary + '08',
      borderRadius: BorderRadius.xl,
      borderWidth: 2,
      borderColor: theme.primary + '40',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      fontSize: 20,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    voiceBtn: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.xl,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    voiceBtnActive: {
      backgroundColor: theme.error,
      borderColor: theme.error,
    },
    
    // Translation Card
    translationCard: {
      backgroundColor: theme.primary + '10',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
    
    // Navigation Buttons
    navButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
    },
    navBtn: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBtnDisabled: {
      backgroundColor: theme.backgroundTertiary,
    },
  });
};
