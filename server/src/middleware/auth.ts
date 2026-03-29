/**
 * 权限中间件
 * 
 * 角色层级：
 * - admin: 管理员，拥有所有权限
 * - teacher: 教师，可管理课程、查看学习数据
 * - student: 学生（默认），只能学习
 */

import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 角色权限映射
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'course:create',
    'course:edit',
    'course:delete',
    'course:view',
    'user:manage',
    'user:view',
    'stats:view',
    'sentence:edit',
    'sentence:delete',
  ],
  teacher: [
    'course:create',
    'course:edit',
    'course:view',
    'stats:view',
    'sentence:edit',
  ],
  student: [
    'course:view',
  ],
};

// 检查用户是否有指定权限
function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['student'];
  return permissions.includes(permission);
}

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phone?: string;
        nickname?: string;
        username?: string;
        role: string;
      };
    }
  }
}

/**
 * 获取用户信息中间件
 * 从请求头或查询参数中获取 user_id，并查询用户信息
 */
export async function getUserMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string || req.query.user_id as string;
  
  if (!userId) {
    // 未提供用户ID，使用默认游客角色
    req.user = { id: 'guest', role: 'student' };
    return next();
  }
  
  try {
    const result = await pool.query(
      'SELECT id, phone, nickname, username, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length > 0) {
      req.user = {
        id: result.rows[0].id,
        phone: result.rows[0].phone,
        nickname: result.rows[0].nickname,
        username: result.rows[0].username,
        role: result.rows[0].role || 'student',
      };
    } else {
      req.user = { id: userId, role: 'student' };
    }
    
    next();
  } catch (error) {
    console.error('[权限] 获取用户信息失败:', error);
    req.user = { id: userId, role: 'student' };
    next();
  }
}

/**
 * 要求用户已登录（非游客）
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.id === 'guest') {
    return res.status(401).json({ error: '请先登录' });
  }
  next();
}

/**
 * 要求指定角色
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
}

/**
 * 要求指定权限
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }
    
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: '权限不足', required: permission });
    }
    
    next();
  };
}

/**
 * 要求管理员角色
 */
export const requireAdmin = requireRole('admin');

/**
 * 要求教师或管理员角色
 */
export const requireTeacher = requireRole('admin', 'teacher');

// 导出权限常量供其他模块使用
export const PERMISSIONS = {
  COURSE_CREATE: 'course:create',
  COURSE_EDIT: 'course:edit',
  COURSE_DELETE: 'course:delete',
  COURSE_VIEW: 'course:view',
  USER_MANAGE: 'user:manage',
  USER_VIEW: 'user:view',
  STATS_VIEW: 'stats:view',
  SENTENCE_EDIT: 'sentence:edit',
  SENTENCE_DELETE: 'sentence:delete',
};

export { hasPermission, ROLE_PERMISSIONS };
