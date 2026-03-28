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
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
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
    downloadAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      backgroundColor: `${theme.primary}15`,
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
    sentenceIndex: {
      marginBottom: 8,
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
    
    // 下载进度弹窗
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
      alignItems: 'center',
    },
    modalTitle: {
      marginBottom: Spacing.md,
    },
    modalSubtitle: {
      marginBottom: Spacing.lg,
    },
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
    },
    progressPercent: {
      fontWeight: '600',
    },
  });
};
