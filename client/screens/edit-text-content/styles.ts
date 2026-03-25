import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,  // 减小，因为固定播放器在外面
      paddingBottom: Spacing['5xl'],
    },
    
    // 固定的音频播放器 - 始终在顶部
    stickyAudioPlayer: {
      backgroundColor: theme.backgroundDefault,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    audioPlayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    audioPlayerInfoCompact: {
      flex: 1,
    },
    playButtonSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seekButtonSmall: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xs,
    },
    progressBarCompact: {
      marginTop: Spacing.sm,
    },
    progressBarBgSmall: {
      width: '100%',
      height: 4,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.sm,
      overflow: 'hidden',
    },
    progressBarFillSmall: {
      height: '100%',
      borderRadius: BorderRadius.sm,
    },
    header: {
      marginBottom: Spacing.md,  // 减小
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
      marginBottom: Spacing.md,  // 减小
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,  // 减小
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
    
    // 音频播放器卡片 - 紧凑版
    audioPlayerCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,  // 减小 padding
      marginBottom: Spacing.sm,  // 减小底部间距
    },
    audioPlayerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,  // 减小间距
    },
    audioPlayerIcon: {
      width: 36,  // 减小尺寸
      height: 36,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    audioPlayerInfo: {
      flex: 1,
    },
    audioPlayerControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,  // 减小间距
      marginTop: Spacing.sm,
    },
    // 后退/前进按钮 - 更小
    seekButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 播放按钮 - 更小
    playButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 播放器提示 - 移除，节省空间
    playerHint: {
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    
    // 播放进度
    progressContainer: {
      marginBottom: Spacing.xs,
    },
    progressBarBg: {
      width: '100%',
      height: 6,  // 减小高度
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
      marginTop: 2,
    },
    
    // 提取按钮 - 更紧凑
    extractButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: theme.accent,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    
    // 文本编辑器 - 增大高度
    textEditor: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      height: 500,  // 增大高度
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
