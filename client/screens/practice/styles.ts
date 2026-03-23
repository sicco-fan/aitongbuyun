import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing['2xl'],
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    header: {
      marginBottom: Spacing['2xl'],
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    progressBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      marginRight: Spacing.md,
    },
    headerNav: {
      flexDirection: 'row',
      marginLeft: Spacing.lg,
      gap: Spacing.sm,
    },
    headerNavBtn: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // 音频控制区
    audioSection: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
      padding: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    playButton: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playButtonDisabled: {
      backgroundColor: theme.textMuted,
    },
    playCount: {},
    
    // 翻译显示区
    translationBox: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.primary,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      alignItems: 'flex-end',
    },
    translationText: {
      textAlign: 'right',
      marginTop: Spacing.xs,
    },
    
    // 句子显示区
    sentenceSection: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.xl,
      marginBottom: Spacing['2xl'],
      minHeight: 120,
    },
    sentenceLabel: {
      marginBottom: Spacing.md,
    },
    sentenceHeader: {
      marginBottom: Spacing.md,
    },
    wordsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    wordSlot: {
      minWidth: 60,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 36,
    },
    wordCorrect: {
      backgroundColor: '#10B98120',
      borderColor: theme.success,
    },
    wordHidden: {
      borderColor: theme.borderLight,
      backgroundColor: theme.backgroundTertiary,
    },
    wordError: {
      backgroundColor: '#EF444420',
      borderColor: theme.error,
    },
    wordHint: {
      backgroundColor: '#F59E0B20',
      borderColor: '#F59E0B',
    },
    wordText: {},
    wordTextCorrect: {},
    wordTextHint: {
      color: '#F59E0B',
    },
    wordTextHidden: {
      color: theme.textMuted,
    },
    wordIndex: {
      fontSize: 10,
      color: theme.textMuted,
    },
    
    // 输入区
    inputSection: {
      marginBottom: Spacing.xl,
    },
    inputLabel: {
      marginBottom: Spacing.md,
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 18,
      color: theme.textPrimary,
    },
    voiceButton: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    voiceButtonActive: {
      backgroundColor: theme.error,
    },
    
    // 反馈区
    feedbackSection: {
      marginBottom: Spacing.xl,
      minHeight: 50,
    },
    feedbackCorrect: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10B98120',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.success,
    },
    feedbackCorrectText: {
      marginLeft: Spacing.sm,
      color: theme.success,
    },
    feedbackIncorrect: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#EF444420',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.error,
    },
    feedbackIncorrectText: {
      marginLeft: Spacing.sm,
      color: theme.error,
    },
    
    // 提示区
    hintSection: {
      marginBottom: Spacing.xl,
    },
    hintButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F59E0B20',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    hintButtonText: {
      marginLeft: Spacing.sm,
      color: '#F59E0B',
    },
    hintContent: {
      marginTop: Spacing.md,
      padding: Spacing.lg,
      backgroundColor: '#F59E0B10',
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    
    // 按钮区
    buttonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.lg,
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
    buttonDisabled: {
      opacity: 0.5,
    },
    
    // 导航按钮区（句子切换）
    navButtonRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    navButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.xl,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.xl,
    },
    navButtonPrev: {
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 2,
      borderColor: theme.border,
    },
    navButtonNext: {
      backgroundColor: theme.primary,
    },
    
    // 完成界面
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
    
    // 统计信息
    statsBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: Spacing.lg,
    },
    statBarItem: {
      alignItems: 'center',
    },
    statBarValue: {
      marginBottom: Spacing.xs,
    },
    statBarLabel: {},
  });
};
