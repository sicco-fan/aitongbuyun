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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing['3xl'],
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBtnDisabled: {
      opacity: 0.3,
    },
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    sentenceText: {
      lineHeight: 28,
      textAlign: 'center',
    },
    // 时间轴可视化
    timelineSection: {
      marginBottom: Spacing.lg,
    },
    timelineContainer: {
      height: 48,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.sm,
      overflow: 'hidden',
      position: 'relative',
    },
    timelineTrack: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    timelineBlock: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      borderRadius: 4,
    },
    selectionBlock: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      backgroundColor: theme.primary + '30',
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    playhead: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: theme.primary,
    },
    timelineTouchLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    timeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    timeLabel: {
      fontSize: 10,
    },
    // 滑块范围选择
    rangeSection: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    sliderRow: {
      marginBottom: Spacing.lg,
    },
    sliderLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    sliderDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    sliderWrapper: {
      height: 40,
      justifyContent: 'center',
    },
    slider: {
      width: '100%',
      height: 40,
    },
    durationInfo: {
      alignItems: 'center',
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    // 播放控制
    playControls: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    controlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    playSelectionBtn: {
      backgroundColor: theme.primary,
    },
    // 确认按钮
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.success,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
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
    backBtn: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
    },
  });
};
