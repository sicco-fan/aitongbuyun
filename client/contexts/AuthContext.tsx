import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// 后端服务地址
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

// 存储 key
const STORAGE_KEYS = {
  USER_ID: 'auth_user_id',
  USER_DATA: 'auth_user_data',
  DEVICE_ID: 'device_id',
};

// 用户信息接口
interface User {
  id: string;
  phone?: string;
  nickname?: string;
  username?: string;
  device_id?: string;
  is_guest?: boolean;
  role?: 'admin' | 'teacher' | 'student' | 'user';
  avatar_url?: string;
}

// 认证上下文类型
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  deviceId: string | null;
  
  // 游客登录
  guestLogin: () => Promise<{ success: boolean; error?: string }>;
  
  // 手机号验证码登录
  sendCode: (phone: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  loginWithCode: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  
  // 更新用户信息
  updateNickname: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  
  // 登出
  logout: () => Promise<void>;
  
  // 刷新用户信息
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // 初始化 - 从存储中恢复用户状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 获取或创建设备ID
        let storedDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
        if (!storedDeviceId) {
          storedDeviceId = Crypto.randomUUID();
          await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, storedDeviceId);
        }
        setDeviceId(storedDeviceId);

        // 获取已存储的用户信息
        const storedUserId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        if (storedUserId) {
          // 从服务器获取最新用户信息
          const response = await fetch(
            `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/me?user_id=${storedUserId}`
          );
          const result = await response.json();
          
          if (result.success && result.user) {
            setUser(result.user);
            await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.user));
          } else {
            // 用户不存在，清除存储
            await AsyncStorage.multiRemove([STORAGE_KEYS.USER_ID, STORAGE_KEYS.USER_DATA]);
          }
        }
      } catch (error) {
        console.error('初始化认证失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 游客登录
  const guestLogin = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!deviceId) {
      return { success: false, error: '设备ID未初始化' };
    }

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      
      const result = await response.json();
      
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, result.user.id);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.user));
        return { success: true };
      }
      
      return { success: false, error: result.error || '游客登录失败' };
    } catch (error) {
      console.error('游客登录失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }, [deviceId]);

  // 发送验证码
  const sendCode = useCallback(async (phone: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        return { success: true, code: result.code };
      }
      
      return { success: false, error: result.error || '发送验证码失败' };
    } catch (error) {
      console.error('发送验证码失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }, []);

  // 验证码登录
  const loginWithCode = useCallback(async (phone: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      
      const result = await response.json();
      
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, result.user.id);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.user));
        return { success: true };
      }
      
      return { success: false, error: result.error || '登录失败' };
    } catch (error) {
      console.error('登录失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }, []);

  // 更新昵称
  const updateNickname = useCallback(async (nickname: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) {
      return { success: false, error: '未登录' };
    }

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, nickname }),
      });
      
      const result = await response.json();
      
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.user));
        return { success: true };
      }
      
      return { success: false, error: result.error || '更新失败' };
    } catch (error) {
      console.error('更新昵称失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }, [user?.id]);

  // 登出
  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.USER_ID, STORAGE_KEYS.USER_DATA]);
    setUser(null);
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/me?user_id=${user.id}`
      );
      const result = await response.json();
      
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.user));
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  }, [user?.id]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    deviceId,
    guestLogin,
    sendCode,
    loginWithCode,
    updateNickname,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
