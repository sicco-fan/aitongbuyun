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
      paddingTop: Spacing.lg,
      paddingBottom: Spacing['3xl'],
    },
    
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      alignItems: 'center',
      flex: 1,
    },
    playIndicator: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Progress
    progressContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    
    // Sentence Card
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginTop: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      // 柔和阴影
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    sentenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    sentenceIconContainer: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
    },
    wordContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      alignItems: 'flex-end',
      lineHeight: 40,
    },
    wordWrapper: {
      marginBottom: Spacing.sm,
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
      opacity: 0.4,
    },
    
    // Input Section
    inputSection: {
      marginBottom: Spacing.lg,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    input: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: theme.borderLight,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      fontSize: 18,
      color: theme.textPrimary,
      // 凹陷效果
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    voiceBtn: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.xl,
      backgroundColor: theme.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    voiceBtnActive: {
      backgroundColor: theme.error,
      borderColor: theme.error,
    },
    
    // Controls
    controlsSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    playInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: theme.backgroundTertiary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    skipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
    },
  });
};
