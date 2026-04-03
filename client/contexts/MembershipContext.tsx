import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

// 会员价格配置
export const MEMBERSHIP_PRICES = {
  monthly: { price: 9.9, days: 30, name: '月度会员' },
  yearly: { price: 68, days: 365, name: '年度会员' },
  lifetime: { price: 128, days: 36500, name: '终身会员' },
};

// 会员状态接口
export interface MembershipStatus {
  isMember: boolean;
  memberType: string;
  expireAt: string | null;
  isEarlyAdopter: boolean;
  daysLeft: number | null;
}

interface MembershipContextType {
  membership: MembershipStatus | null;
  isLoading: boolean;
  
  // 刷新会员状态
  refreshMembership: () => Promise<void>;
  
  // 检查会员权限
  checkAccess: () => Promise<boolean>;
  
  // 创建订单
  createOrder: (orderType: 'monthly' | 'yearly' | 'lifetime') => Promise<{ success: boolean; orderId?: number; error?: string }>;
  
  // 激活会员（测试用）
  activateFreeMembership: (days?: number) => Promise<{ success: boolean; error?: string }>;
}

const MembershipContext = createContext<MembershipContextType | undefined>(undefined);

export const MembershipProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 从本地存储获取用户ID
  const getUserId = useCallback(async () => {
    try {
      return await AsyncStorage.getItem('auth_user_id');
    } catch {
      return null;
    }
  }, []);
  
  // 刷新会员状态
  const refreshMembership = useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        setMembership({
          isMember: false,
          memberType: 'free',
          expireAt: null,
          isEarlyAdopter: false,
          daysLeft: null,
        });
        return;
      }
      
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/membership/status?user_id=${userId}`
      );
      const result = await response.json();
      
      if (result.success) {
        setMembership(result.membership);
      }
    } catch (error) {
      console.error('获取会员状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getUserId]);
  
  // 初始化时获取会员状态
  useEffect(() => {
    refreshMembership();
  }, [refreshMembership]);
  
  // 检查会员权限
  const checkAccess = useCallback(async (): Promise<boolean> => {
    if (membership?.isMember) {
      return true;
    }
    
    // 重新检查状态
    await refreshMembership();
    return membership?.isMember || false;
  }, [membership, refreshMembership]);
  
  // 创建订单
  const createOrder = useCallback(async (orderType: 'monthly' | 'yearly' | 'lifetime') => {
    try {
      const userId = await getUserId();
      if (!userId) {
        return { success: false, error: '请先登录' };
      }
      
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/membership/order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, order_type: orderType }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        return { success: true, orderId: result.order.id };
      } else {
        return { success: false, error: result.error || '创建订单失败' };
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      return { success: false, error: '网络错误' };
    }
  }, [getUserId]);
  
  // 激活免费会员（测试用）
  const activateFreeMembership = useCallback(async (days = 30) => {
    try {
      const userId = await getUserId();
      if (!userId) {
        return { success: false, error: '请先登录' };
      }
      
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/membership/activate-free`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, days }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        await refreshMembership();
        return { success: true };
      } else {
        return { success: false, error: result.error || '激活失败' };
      }
    } catch (error) {
      console.error('激活会员失败:', error);
      return { success: false, error: '网络错误' };
    }
  }, [getUserId, refreshMembership]);
  
  return (
    <MembershipContext.Provider
      value={{
        membership,
        isLoading,
        refreshMembership,
        checkAccess,
        createOrder,
        activateFreeMembership,
      }}
    >
      {children}
    </MembershipContext.Provider>
  );
};

export const useMembership = () => {
  const context = useContext(MembershipContext);
  if (context === undefined) {
    throw new Error('useMembership must be used within a MembershipProvider');
  }
  return context;
};
