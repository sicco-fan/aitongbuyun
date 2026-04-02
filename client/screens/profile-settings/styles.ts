import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing['4xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    headerTitle: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    // 头像区域
    avatarSection: {
      alignItems: 'center',
      marginBottom: Spacing['2xl'],
    },
    avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: theme.primary + '30',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.primary + '15',
    },
    avatarHint: {
      marginTop: Spacing.sm,
    },
    // 用户名区域
    usernameSection: {
      marginBottom: Spacing['2xl'],
    },
    sectionTitle: {
      marginBottom: Spacing.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
      paddingVertical: Spacing.sm,
    },
    // 布局选择区域
    layoutSection: {
      marginBottom: Spacing.xl,
    },
    layoutGrid: {
      gap: Spacing.md,
    },
    layoutCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 2,
      borderColor: theme.border,
    },
    layoutCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '08',
    },
    layoutCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    layoutIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm,
    },
    layoutName: {
      flex: 1,
    },
    layoutCheckmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    layoutDescription: {
      marginTop: Spacing.xs,
    },
    // 语音答题模式选择区域
    sectionSubtitle: {
      marginBottom: Spacing.md,
    },
    // 法律信息区域
    legalSection: {
      marginTop: Spacing.lg,
    },
    legalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.sm,
    },
    legalItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    // 保存按钮
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
  });
};
