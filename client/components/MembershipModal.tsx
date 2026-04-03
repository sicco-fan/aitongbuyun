import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useMembership, MEMBERSHIP_PRICES } from '@/contexts/MembershipContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';

interface MembershipModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MembershipModal({ visible, onClose }: MembershipModalProps) {
  const { theme } = useTheme();
  const { membership, createOrder, activateFreeMembership } = useMembership();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [loading, setLoading] = useState(false);
  
  const styles = useMemo(() => createModalStyles(theme), [theme]);
  
  const handlePurchase = async () => {
    setLoading(true);
    
    try {
      // 先创建订单
      const result = await createOrder(selectedPlan);
      
      if (result.success && result.orderId) {
        // TODO: 这里接入实际支付（微信/支付宝/苹果内购）
        // 目前是测试模式，直接激活
        Alert.alert(
          '开发中',
          '支付功能正在接入中，目前可免费体验会员功能',
          [
            { text: '取消', style: 'cancel' },
            { 
              text: '免费体验', 
              onPress: async () => {
                const days = selectedPlan === 'monthly' ? 30 : selectedPlan === 'yearly' ? 365 : 36500;
                const activateResult = await activateFreeMembership(days);
                if (activateResult.success) {
                  Alert.alert('成功', '会员已激活');
                  onClose();
                } else {
                  Alert.alert('错误', activateResult.error || '激活失败');
                }
              }
            },
          ]
        );
      } else {
        Alert.alert('错误', result.error || '创建订单失败');
      }
    } catch (error) {
      console.error('购买失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>开通会员</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome6 name="xmark" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Benefits */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.benefitSection}>
              <Text style={styles.sectionTitle}>会员专属权益</Text>
              {[
                { icon: 'headphones', text: '解锁全部高级音色' },
                { icon: 'book-open', text: '无限句库创建' },
                { icon: 'cloud', text: '学习数据云同步' },
                { icon: 'star', text: '优先社区推荐' },
                { icon: 'bolt', text: '优先新功能体验' },
              ].map((item, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={[styles.benefitIcon, { backgroundColor: theme.primary + '15' }]}>
                    <FontAwesome6 name={item.icon} size={14} color={theme.primary} />
                  </View>
                  <Text style={styles.benefitText}>{item.text}</Text>
                </View>
              ))}
            </View>
            
            {/* Plans */}
            <View style={styles.planSection}>
              <Text style={styles.sectionTitle}>选择套餐</Text>
              {Object.entries(MEMBERSHIP_PRICES).map(([key, value]) => {
                const isSelected = selectedPlan === key;
                const isRecommended = key === 'yearly';
                
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.planCard,
                      { borderColor: isSelected ? theme.primary : theme.borderLight },
                      isRecommended && styles.recommendedCard,
                    ]}
                    onPress={() => setSelectedPlan(key as any)}
                    activeOpacity={0.7}
                  >
                    {isRecommended && (
                      <View style={[styles.recommendedBadge, { backgroundColor: theme.accent }]}>
                        <Text style={styles.recommendedText}>推荐</Text>
                      </View>
                    )}
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>{value.name}</Text>
                      <Text style={styles.planDays}>{value.days}天有效期</Text>
                    </View>
                    <View style={styles.planPrice}>
                      <Text style={styles.priceSymbol}>¥</Text>
                      <Text style={styles.priceValue}>{value.price}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkIcon, { backgroundColor: theme.primary }]}>
                        <FontAwesome6 name="check" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Early Adopter Notice */}
            {membership?.isEarlyAdopter && (
              <View style={[styles.earlyAdopterBox, { backgroundColor: theme.success + '10', borderColor: theme.success + '30' }]}>
                <FontAwesome6 name="gift" size={16} color={theme.success} />
                <Text style={[styles.earlyAdopterText, { color: theme.success }]}>
                  您是早期用户，永久享受会员权益
                </Text>
              </View>
            )}
          </ScrollView>
          
          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.purchaseBtn, { backgroundColor: theme.primary }]}
              onPress={handlePurchase}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.purchaseBtnText}>立即开通</Text>
                  <Text style={styles.purchaseBtnPrice}>
                    ¥{MEMBERSHIP_PRICES[selectedPlan].price}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              开通即表示同意《会员服务协议》
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createModalStyles(theme: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.backgroundDefault,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
      position: 'relative',
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    closeBtn: {
      position: 'absolute',
      right: Spacing.lg,
      padding: Spacing.sm,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    benefitSection: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: Spacing.md,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    benefitIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    benefitText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    planSection: {
      marginBottom: Spacing.lg,
    },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1.5,
      marginBottom: Spacing.sm,
      position: 'relative',
    },
    recommendedCard: {
      borderWidth: 2,
    },
    recommendedBadge: {
      position: 'absolute',
      top: -10,
      right: Spacing.md,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    recommendedText: {
      fontSize: 11,
      color: '#fff',
      fontWeight: '600',
    },
    planInfo: {
      flex: 1,
    },
    planName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    planDays: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    planPrice: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    priceSymbol: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '500',
    },
    priceValue: {
      fontSize: 24,
      color: theme.primary,
      fontWeight: '700',
    },
    checkIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: Spacing.sm,
    },
    earlyAdopterBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    earlyAdopterText: {
      fontSize: 13,
      fontWeight: '500',
    },
    footer: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    purchaseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
    },
    purchaseBtnText: {
      fontSize: 16,
      color: '#fff',
      fontWeight: '600',
    },
    purchaseBtnPrice: {
      fontSize: 18,
      color: '#fff',
      fontWeight: '700',
    },
    disclaimer: {
      textAlign: 'center',
      fontSize: 11,
      color: theme.textMuted,
      marginTop: Spacing.sm,
    },
  });
}
