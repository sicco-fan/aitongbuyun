import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing['5xl'],
    },
    
    // 打卡卡片
    checkInCard: {
      backgroundColor: theme.primary + '10',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.primary + '20',
    },
    checkInHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    checkInLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkInIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkInInfo: {
      marginLeft: Spacing.md,
    },
    streakNumber: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.primary,
    },
    streakLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    checkInButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    checkInButtonDisabled: {
      backgroundColor: theme.success,
    },
    checkInButtonText: {
      color: theme.buttonPrimaryText,
      fontSize: 14,
      fontWeight: '600',
    },
    
    // 日历
    calendarContainer: {
      marginTop: Spacing.md,
    },
    calendarWeekDays: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: Spacing.sm,
    },
    weekDayText: {
      fontSize: 11,
      color: theme.textMuted,
      width: 32,
      textAlign: 'center',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    },
    calendarDay: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 2,
      borderRadius: 16,
    },
    calendarDayChecked: {
      backgroundColor: theme.primary,
    },
    calendarDayToday: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    calendarDayText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    calendarDayTextChecked: {
      color: theme.buttonPrimaryText,
      fontWeight: '600',
    },
    
    // 排行榜
    rankingSection: {
      marginBottom: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: 3,
    },
    tab: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.md,
    },
    tabActive: {
      backgroundColor: theme.backgroundDefault,
    },
    tabText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    tabTextActive: {
      color: theme.textPrimary,
      fontWeight: '600',
    },
    rankingCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rankingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    rankingItemLast: {
      borderBottomWidth: 0,
    },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    rankBadge1: {
      backgroundColor: '#FFD700',
    },
    rankBadge2: {
      backgroundColor: '#C0C0C0',
    },
    rankBadge3: {
      backgroundColor: '#CD7F32',
    },
    rankBadgeOther: {
      backgroundColor: theme.backgroundTertiary,
    },
    rankText: {
      fontSize: 12,
      fontWeight: '700',
    },
    rankTextOther: {
      color: theme.textMuted,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundTertiary,
    },
    rankingUserInfo: {
      flex: 1,
      marginLeft: Spacing.sm,
    },
    rankingValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    
    // 话题
    topicsScroll: {
      marginBottom: Spacing.md,
    },
    topicTag: {
      backgroundColor: theme.primary + '15',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      marginRight: Spacing.sm,
    },
    topicTagActive: {
      backgroundColor: theme.primary,
    },
    topicTagText: {
      fontSize: 13,
      color: theme.primary,
    },
    topicTagTextActive: {
      color: theme.buttonPrimaryText,
    },
    
    // 动态
    postCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    postAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.backgroundTertiary,
    },
    postUserInfo: {
      flex: 1,
      marginLeft: Spacing.sm,
    },
    postNickname: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    postTime: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 2,
    },
    postContent: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.textPrimary,
    },
    postTopic: {
      fontSize: 12,
      color: theme.primary,
      marginTop: Spacing.sm,
    },
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    actionText: {
      fontSize: 12,
      color: theme.textMuted,
      marginLeft: 4,
    },
    actionTextLiked: {
      color: theme.error,
    },
    
    // 评论
    commentInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginTop: Spacing.md,
    },
    commentTextInput: {
      flex: 1,
      fontSize: 14,
      color: theme.textPrimary,
      marginLeft: Spacing.sm,
    },
    
    // 空状态
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: Spacing['2xl'],
    },
    emptyText: {
      fontSize: 14,
      color: theme.textMuted,
      marginTop: Spacing.md,
    },
    
    // 模态框
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.backgroundDefault,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    modalClose: {
      fontSize: 20,
      color: theme.textMuted,
    },
    modalBody: {
      padding: Spacing.lg,
    },
  });
};
