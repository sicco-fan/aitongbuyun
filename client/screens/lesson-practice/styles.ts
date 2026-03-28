import { StyleSheet, Dimensions } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

const { width } = Dimensions.get('window');

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['5xl'],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Spacing['4xl'],
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButtonText: {
      marginLeft: 8,
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    title: {
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      textAlign: 'center',
    },
    
    // 音色选择区域
    voiceSection: {
      marginBottom: Spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      marginBottom: 0,
    },
    generateAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
    },
    voiceList: {
      gap: Spacing.sm,
    },
    voiceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    voiceCardSelected: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    voiceCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    voiceInfo: {
      flex: 1,
    },
    voiceName: {
      fontWeight: '600',
      marginBottom: 4,
    },
    notGeneratedBadge: {
      marginLeft: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.backgroundTertiary,
    },
    voiceStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cachedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    downloadingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    downloadButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${theme.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cacheProgressBar: {
      height: 3,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 1.5,
      marginTop: Spacing.sm,
      overflow: 'hidden',
    },
    cacheProgressFill: {
      height: '100%',
      borderRadius: 1.5,
    },
    
    // 统计信息
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      marginBottom: 4,
    },
    statLabel: {
      textAlign: 'center',
    },
    
    // 句子卡片
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sentenceCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sentenceIndex: {
      marginBottom: 0,
    },
    editButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: `${theme.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    englishText: {
      lineHeight: 24,
      marginBottom: 8,
    },
    chineseText: {
      lineHeight: 20,
    },
    
    // 开始按钮
    startButton: {
      flexDirection: 'row',
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.md,
    },
    startButtonText: {
      fontWeight: '600',
    },
    
    // 弹窗通用
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: width - 64,
      maxWidth: 400,
    },
    modalTitle: {
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    modalSubtitle: {
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    
    // 下载进度
    progressBar: {
      width: '100%',
      height: 8,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: Spacing.md,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 4,
    },
    progressText: {
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    progressPercent: {
      fontWeight: '600',
      textAlign: 'center',
    },
    
    // 生成音频弹窗
    voiceSelectList: {
      marginBottom: Spacing.md,
    },
    voiceSelectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      backgroundColor: theme.backgroundTertiary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    voiceSelectItemSelected: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}10`,
    },
    voiceSelectCheckbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.border,
      marginRight: Spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
    },
    selectAllButton: {
      alignSelf: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
    },
    generateProgress: {
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    generateProgressBar: {
      width: '100%',
      height: 12,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: Spacing.md,
    },
    generateProgressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 6,
    },
    generateProgressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: Spacing.sm,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.backgroundTertiary,
      alignItems: 'center',
    },
    confirmButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
      alignItems: 'center',
    },
    
    // 编辑弹窗
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    editField: {
      marginBottom: Spacing.md,
    },
    editLabel: {
      marginBottom: Spacing.sm,
    },
    editInput: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 16,
      textAlignVertical: 'top',
      minHeight: 60,
    },
  });
};
