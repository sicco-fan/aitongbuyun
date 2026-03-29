/**
 * 权限管理 Hook
 * 
 * 角色定义：
 * - admin: 管理员，拥有所有权限
 * - teacher: 教师，可管理课程
 * - student: 学生（默认），只能学习
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface PermissionUser {
  id: string;
  phone?: string;
  nickname?: string;
  username?: string;
  role: UserRole;
  avatar_url?: string;
  created_at?: string;
}

interface PermissionContextType {
  // 当前用户信息
  currentUser: PermissionUser | null;
  isLoading: boolean;
  
  // 角色判断
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  
  // 权限判断
  canManageUsers: boolean;
  canManageCourses: boolean;
  canViewStats: boolean;
  canEditSentences: boolean;
  
  // 刷新用户信息
  refreshUser: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [currentUser, setCurrentUser] = useState<PermissionUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchUserInfo = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setCurrentUser(null);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/me?user_id=${user.id}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      } else {
        // 如果获取失败，使用默认角色
        setCurrentUser({
          id: user.id,
          role: 'student',
        });
      }
    } catch (error) {
      console.error('[权限] 获取用户信息失败:', error);
      setCurrentUser({
        id: user.id,
        role: 'student',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);
  
  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);
  
  // 角色判断
  const isAdmin = currentUser?.role === 'admin';
  const isTeacher = currentUser?.role === 'teacher' || isAdmin;
  const isStudent = !isAdmin && !isTeacher;
  
  // 权限判断
  const canManageUsers = isAdmin;
  const canManageCourses = isTeacher;
  const canViewStats = isTeacher;
  const canEditSentences = isTeacher;
  
  return (
    <PermissionContext.Provider
      value={{
        currentUser,
        isLoading,
        isAdmin,
        isTeacher,
        isStudent,
        canManageUsers,
        canManageCourses,
        canViewStats,
        canEditSentences,
        refreshUser: fetchUserInfo,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
}

/**
 * 权限守卫组件
 * 用于包裹需要特定权限的组件
 */
interface RequirePermissionProps {
  permission: 'admin' | 'teacher' | 'canManageUsers' | 'canManageCourses' | 'canViewStats' | 'canEditSentences';
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { isAdmin, isTeacher, canManageUsers, canManageCourses, canViewStats, canEditSentences } = usePermission();
  
  const hasPermission = {
    admin: isAdmin,
    teacher: isTeacher,
    canManageUsers,
    canManageCourses,
    canViewStats,
    canEditSentences,
  }[permission];
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
