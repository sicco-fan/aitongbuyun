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
    subtitle: {
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['3xl'],
    },
    
    // Section 样式
    section: {
      marginBottom: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sectionIcon: {
      width: 24,
      height: 24,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionIconInput: {
      backgroundColor: theme.primary + '15',
    },
    sectionIconEdit: {
      backgroundColor: theme.accent + '15',
    },
    sectionIconOutput: {
      backgroundColor: theme.success + '15',
    },
    sectionBadge: {
      backgroundColor: theme.primary + '15',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    sectionBadgeOutput: {
      backgroundColor: theme.success + '15',
    },
    emptySection: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.sm,
    },
    
    // 文件卡片
    fileCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    fileCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fileCardIcon: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    fileCardIconOutput: {
      backgroundColor: theme.success + '15',
    },
    fileCardInfo: {
      flex: 1,
    },
    fileCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: 2,
    },
    fileCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    fileCardActionButton: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileCardActionSecondary: {
      backgroundColor: theme.backgroundTertiary,
    },
    fileCardActionDelete: {
      backgroundColor: theme.error + '15',
    },
    fileCardMainButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.xs,
    },
    
    // 分割线
    sectionDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.borderLight,
    },
    dividerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: Spacing.md,
    },
    editHint: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    
    // ===== 编辑端样式 =====
    
    // 音频播放器卡片
    audioPlayerCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    audioPlayerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    audioPlayerIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    audioPlayerInfo: {
      flex: 1,
    },
    audioPlayerControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xl,
      marginTop: Spacing.md,
    },
    // 后退/前进按钮
    seekButton: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 大播放按钮
    playButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      // 添加阴影让按钮更明显
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    // 播放器提示
    playerHint: {
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    
    // 播放进度 - 更高的进度条，方便点击
    progressContainer: {
      marginBottom: Spacing.sm,
    },
    progressBarBg: {
      width: '100%',
      height: 8,  // 增加高度，方便点击
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: BorderRadius.md,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
    },
    
    // 提取按钮
    extractButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.accent,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    
    // 文本编辑器 - 固定高度避免测量错误
    textEditor: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      height: 400,  // 使用固定高度，避免 minHeight 导致的测量错误
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: Spacing.sm,
    },
    
    // 段落统计
    paragraphStats: {
      paddingHorizontal: Spacing.sm,
      marginBottom: Spacing.md,
    },
    
    // 句子预览
    sentencesPreview: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    sentencePreviewItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
    },
    sentenceNumber: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    moreSentences: {
      textAlign: 'center',
      paddingVertical: Spacing.xs,
    },
    
    // 保存按钮
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    
    // 输出端提示
    outputHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.lg,
    },
  });
};
