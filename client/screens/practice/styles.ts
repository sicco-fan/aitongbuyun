import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
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
    
    // Content wrapper - 键盘避让
    contentWrapper: {
      flex: 1,
    },
    
    // Sentence Section - 可滚动
    sentenceSection: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    sentenceScrollContent: {
      paddingVertical: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    
    // Sentence Card
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
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
      justifyContent: 'center',
    },
    wordWrapper: {
      marginBottom: Spacing.xs,
    },
    wordBox: {
      flexDirection: 'column',
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    char: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    hiddenChar: {
      opacity: 0.35,
    },
    errorChar: {
      // 错误字符由 color 控制，无需额外样式
    },
    wordHint: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      textAlign: 'center',
      marginTop: 2,
    },
    
    // Input Section - 紧跟句子区域
    inputSection: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundRoot,
    },
    inputWrapper: {
      width: '100%',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      width: '100%',
      backgroundColor: '#E8F5E9',
      borderRadius: BorderRadius.xl,
      borderWidth: 2,
      borderColor: '#A5D6A7',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      fontSize: 22,
      color: theme.textPrimary,
      fontWeight: '600',
      textAlign: 'center',
      paddingRight: 56, // 为语音按钮留空间
    },
    inputVoiceBtn: {
      position: 'absolute',
      right: 8,
      top: '50%',
      marginTop: -20,
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Navigation Buttons - 紧跟输入框
    navButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing['2xl'],
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundRoot,
    },
    navBtn: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBtnDisabled: {
      backgroundColor: theme.backgroundTertiary,
    },
    
    // Translation Card
    translationCard: {
      backgroundColor: theme.primary + '10',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
  });
};
