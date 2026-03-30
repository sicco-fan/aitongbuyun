import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Spacing['3xl'],
    },
    
    // 统计卡片区域
    statsSection: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
    },
    
    statsCard: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    
    statsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    
    statsTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    
    badgeContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    
    statsNumbers: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    
    statItem: {
      alignItems: 'center',
    },
    
    statValue: {
      marginTop: Spacing.xs,
    },
    
    statLabel: {
      marginTop: Spacing.xs,
    },
    
    // 进度条
    progressSection: {
      marginTop: Spacing.lg,
    },
    
    progressLabel: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    
    progressBar: {
      height: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    
    progressFill: {
      height: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: BorderRadius.full,
    },
    
    // 筛选标签
    filterSection: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    
    filterTabs: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    
    filterTab: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
    },
    
    filterTabActive: {
      backgroundColor: theme.primary,
    },
    
    // 列表区域
    listSection: {
      paddingHorizontal: Spacing.lg,
    },
    
    listHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    
    // 录音项
    recordingItem: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    
    recordingItemFavorite: {
      borderColor: theme.accent,
      borderWidth: 2,
    },
    
    recordingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.sm,
    },
    
    sentenceText: {
      flex: 1,
      marginRight: Spacing.md,
    },
    
    recordingActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    actionBtnFavorite: {
      backgroundColor: theme.accent + '20',
    },
    
    actionBtnFavoriteActive: {
      backgroundColor: theme.accent,
    },
    
    actionBtnShare: {
      backgroundColor: theme.primary + '20',
    },
    
    actionBtnShareActive: {
      backgroundColor: theme.primary,
    },
    
    actionBtnDelete: {
      backgroundColor: theme.error + '20',
    },
    
    recordingMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      marginTop: Spacing.sm,
    },
    
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    
    // 播放按钮
    playButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary + '15',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    
    // 空状态
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    
    emptyIcon: {
      marginBottom: Spacing.lg,
    },
    
    // 加载更多
    loadMoreBtn: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    
    // 加载中
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
  });
};
