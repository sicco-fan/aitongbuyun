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
      paddingHorizontal: Spacing.md,
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
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    sentenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    sentenceIconContainer: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '12',
      justifyContent: 'center',
      alignItems: 'center',
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
      fontSize: 24,
      fontWeight: '600',
      letterSpacing: 1,
    },
    hiddenChar: {
      opacity: 0.4,
    },
    
    // Audio Controls
    audioControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginBottom: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    playBtn: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    playBtnActive: {
      backgroundColor: theme.primary,
    },
    loopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.backgroundTertiary,
    },
    loopBtnActive: {
      backgroundColor: theme.primary + '15',
    },
    playCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.backgroundTertiary,
    },
    
    // Input Section
    inputSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    input: {
      flex: 1,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.xl,
      borderWidth: 2,
      borderColor: theme.borderLight,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      fontSize: 18,
      color: theme.textPrimary,
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
    
    // Skip Button
    skipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.backgroundTertiary,
    },
  });
};
