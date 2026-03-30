import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    header: {
      marginBottom: Spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    // 说明卡片
    infoCard: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    infoIcon: {
      width: 72,
      height: 72,
      borderRadius: BorderRadius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    infoTitle: {
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    infoDesc: {
      textAlign: 'center',
      lineHeight: 22,
    },
    // 表单区域
    formSection: {
      marginBottom: Spacing.xl,
    },
    formTitle: {
      marginBottom: Spacing.md,
    },
    inputGroup: {
      marginBottom: Spacing.md,
    },
    textInput: {
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    // 上传区域
    uploadSection: {
      marginBottom: Spacing.xl,
    },
    // 上传选项
    importOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    importOptionIcon: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    importOptionContent: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    // 进度卡片
    progressCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: BorderRadius.full,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      marginTop: Spacing.lg,
    },
    // 格式说明
    formatSection: {
      marginTop: Spacing.md,
    },
    formatTitle: {
      marginBottom: Spacing.md,
    },
    formatExample: {
      marginBottom: Spacing.md,
    },
    formatExampleCode: {
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    formatTips: {
      gap: Spacing.sm,
    },
    formatTipItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // 已有课程列表
    existingCoursesSection: {
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    existingCoursesList: {
      maxHeight: 150,
      borderWidth: 1,
      borderColor: theme.borderLight,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
    },
    existingCourseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    existingCourseItemLast: {
      borderBottomWidth: 0,
    },
    courseNumberBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    // 冲突警告
    conflictWarning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: '#FEF3C7',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginTop: Spacing.sm,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    conflictWarningText: {
      flex: 1,
      marginLeft: Spacing.sm,
    },
    conflictWarningTitle: {
      fontWeight: '600',
      marginBottom: 2,
    },
    conflictWarningDesc: {
      fontSize: 12,
      lineHeight: 18,
      color: '#92400E',
    },
    // 推荐编号
    suggestedNumber: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '10',
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      marginTop: Spacing.xs,
    },
    suggestedNumberText: {
      marginLeft: Spacing.xs,
      color: theme.primary,
    },
  });
};
