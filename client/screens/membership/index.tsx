import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useMembership, MEMBERSHIP_PRICES } from '@/contexts/MembershipContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function MembershipScreen() {
  const { theme, isDark } = useTheme();
  const router = useSafeRouter();
  const { user } = useAuth();
  const { membership, isLoading, refreshMembership, activateFreeMembership } = useMembership();
  const [activating, setActivating] = useState(false);
  
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const handleFreeActivate = async (days: number) => {
    if (!user?.id) {
      Alert.alert('提示', '请先登录');
      return;
    }
    
    setActivating(true);
    const result = await activateFreeMembership(days);
    setActivating(false);
    
    if (result.success) {
      Alert.alert('成功', `已激活 ${days} 天会员`);
    } else {
      Alert.alert('错误', result.error || '激活失败');
    }
  };
  
  const getMemberTypeText = (type: string) => {
    switch (type) {
      case 'monthly': return '月度会员';
      case 'yearly': return '年度会员';
      case 'lifetime': return '终身会员';
      case 'early_adopter': return '早期用户（永久免费）';
      case 'expired': return '已过期';
      default: return '免费用户';
    }
  };
  
  if (isLoading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }
  
  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="h3" color={theme.textPrimary}>会员中心</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        
        {/* Membership Status Card */}
        <View style={[
          styles.statusCard,
          membership?.isMember 
            ? { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }
            : { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight }
        ]}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusIcon,
              membership?.isMember 
                ? { backgroundColor: theme.primary + '20' }
                : { backgroundColor: theme.textMuted + '20' }
            ]}>
              <FontAwesome6 
                name={membership?.isMember ? "crown" : "user"} 
                size={24} 
                color={membership?.isMember ? theme.primary : theme.textMuted} 
              />
            </View>
            <View style={styles.statusInfo}>
              <ThemedText variant="h4" color={theme.textPrimary}>
                {getMemberTypeText(membership?.memberType || 'free')}
              </ThemedText>
              {membership?.isEarlyAdopter && (
                <ThemedText variant="small" color={theme.success}>
                  感谢您作为早期用户的支持！
                </ThemedText>
              )}
              {membership?.expireAt && !membership.isEarlyAdopter && (
                <ThemedText variant="small" color={theme.textSecondary}>
                  有效期至 {new Date(membership.expireAt).toLocaleDateString()}
                </ThemedText>
              )}
              {membership?.daysLeft && !membership.isEarlyAdopter && (
                <ThemedText variant="small" color={theme.primary}>
                  剩余 {membership.daysLeft} 天
                </ThemedText>
              )}
            </View>
          </View>
          
          {!membership?.isMember && (
            <View style={styles.statusFooter}>
              <ThemedText variant="small" color={theme.textMuted}>
                开通会员，解锁全部高级功能
              </ThemedText>
            </View>
          )}
        </View>
        
        {/* Benefits */}
        <View style={styles.section}>
          <ThemedText variant="h4" color={theme.textPrimary} style={styles.sectionTitle}>
            会员权益
          </ThemedText>
          <View style={styles.benefitsGrid}>
            {[
              { icon: 'headphones', title: '高级音色', desc: '解锁全部AI音色' },
              { icon: 'book-open', title: '无限句库', desc: '无限制创建句库' },
              { icon: 'cloud', title: '云端同步', desc: '数据永不丢失' },
              { icon: 'star', title: '社区特权', desc: '优先推荐展示' },
              { icon: 'bolt', title: '新功能', desc: '优先体验新功能' },
              { icon: 'headset', title: '专属客服', desc: '一对一问题解答' },
            ].map((item, index) => (
              <View key={index} style={[styles.benefitCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={[styles.benefitIcon, { backgroundColor: theme.primary + '15' }]}>
                  <FontAwesome6 name={item.icon} size={18} color={theme.primary} />
                </View>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={{ marginTop: 8 }}>
                  {item.title}
                </ThemedText>
                <ThemedText variant="tiny" color={theme.textMuted}>
                  {item.desc}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
        
        {/* Price Plans */}
        {!membership?.isMember && (
          <View style={styles.section}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.sectionTitle}>
              开通会员
            </ThemedText>
            {Object.entries(MEMBERSHIP_PRICES).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[styles.planCard, { backgroundColor: theme.backgroundDefault }]}
                onPress={() => handleFreeActivate(value.days)}
                disabled={activating}
              >
                <View style={styles.planInfo}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                    {value.name}
                  </ThemedText>
                  <ThemedText variant="small" color={theme.textMuted}>
                    {value.days}天有效期
                  </ThemedText>
                </View>
                <View style={styles.planPrice}>
                  <ThemedText variant="h3" color={theme.primary}>¥{value.price}</ThemedText>
                </View>
                {activating ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
                )}
              </TouchableOpacity>
            ))}
            <ThemedText variant="tiny" color={theme.textMuted} style={styles.note}>
              * 当前为测试阶段，点击即可免费激活会员
            </ThemedText>
          </View>
        )}
        
        {/* Early Adopter Info */}
        <View style={[styles.infoBox, { backgroundColor: theme.accent + '10', borderColor: theme.accent + '30' }]}>
          <FontAwesome6 name="info-circle" size={16} color={theme.accent} />
          <ThemedText variant="small" color={theme.textSecondary} style={{ flex: 1, marginLeft: 8 }}>
            在 2025年5月1日 前注册的用户将永久享受会员权益，感谢早期用户的支持！
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme: any) {
  return {
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xl,
    },
    backBtn: {
      padding: Spacing.sm,
    },
    statusCard: {
      borderRadius: BorderRadius.lg,
      borderWidth: 1.5,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusInfo: {
      marginLeft: Spacing.lg,
      flex: 1,
    },
    statusFooter: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      marginBottom: Spacing.md,
    },
    benefitsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    benefitCard: {
      width: '48%',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    benefitIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    planInfo: {
      flex: 1,
    },
    planPrice: {
      marginRight: Spacing.md,
    },
    note: {
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
    },
  };
}
