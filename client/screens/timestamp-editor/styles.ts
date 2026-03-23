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
      marginBottom: Spacing.md,
    },
    // 匹配信息
    matchInfo: {
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      paddingTop: Spacing.md,
    },
    matchLabels: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: Spacing.sm,
    },
    matchLabelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    matchDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    matchStatus: {
      alignItems: 'center',
    },
    matchSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    // 时间轴可视化
    timelineSection: {
      marginBottom: Spacing.lg,
    },
    timelineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    rematchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    timelineContainer: {
      height: 56,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
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
    selectionBlock: {
      position: 'absolute',
      top: 8,
      bottom: 8,
      backgroundColor: theme.primary + '25',
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    wordMarker: {
      position: 'absolute',
      top: -4,
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    startMarker: {
      left: 0,
      backgroundColor: theme.primary,
    },
    endMarker: {
      right: 0,
      backgroundColor: theme.success,
    },
    playhead: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: theme.error,
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
      fontSize: 11,
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
