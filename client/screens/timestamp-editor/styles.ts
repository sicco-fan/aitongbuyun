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
    },
    headerCenter: {
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing['3xl'],
    },
    backBtn: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
    },
    
    // 句子区域
    sentenceSection: {
      marginBottom: Spacing.xl,
    },
    sentenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
      gap: Spacing.lg,
    },
    sentenceNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sentenceNavBtnDisabled: {
      opacity: 0.3,
    },
    sentenceNumber: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    sentenceText: {
      textAlign: 'center',
      lineHeight: 32,
    },
    
    // 波形区域
    waveformSection: {
      marginBottom: Spacing.xl,
    },
    timeDisplay: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    timeBox: {
      alignItems: 'center',
    },
    durationBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    waveformContainer: {
      height: 120,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      position: 'relative',
      overflow: 'hidden',
    },
    waveformTrack: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    waveformBar: {
      flex: 1,
      marginHorizontal: 1,
      borderRadius: 2,
    },
    selectionOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: theme.primary + '30',
    },
    maskOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: theme.backgroundRoot + 'aa',
    },
    playhead: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: theme.error,
    },
    handle: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    handleStart: {
      backgroundColor: theme.primary + '20',
    },
    handleEnd: {
      backgroundColor: theme.success + '20',
    },
    handleBar: {
      width: 4,
      height: '60%',
      borderRadius: 2,
    },
    waveformTouchLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    timeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    timeLabel: {
      fontSize: 11,
    },
    
    // 操作按钮
    actionSection: {
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.textSecondary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.success,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    
    // 提示
    tipBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent + '15',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    
    // 句子列表
    listSection: {
      gap: Spacing.sm,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    listItemActive: {
      backgroundColor: theme.primary + '10',
      borderColor: theme.primary,
      borderWidth: 2,
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
    listItemContent: {
      flex: 1,
    },
  });
};
