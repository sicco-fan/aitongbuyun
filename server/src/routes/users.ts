/**
 * 用户管理路由
 * 仅管理员可访问
 */

import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { getUserMiddleware, requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 应用中间件
router.use(getUserMiddleware);

/**
 * GET /api/v1/users
 * 获取用户列表（仅管理员）
 * Query 参数：page?: number, limit?: number, role?: string, search?: string
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;
    const search = req.query.search as string;
    
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    let whereClause = '1=1';
    const params: any[] = [];
    
    if (role) {
      params.push(role);
      whereClause += ` AND role = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (phone ILIKE $${params.length} OR nickname ILIKE $${params.length} OR username ILIKE $${params.length})`;
    }
    
    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    
    // 查询用户列表
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT id, phone, nickname, username, role, avatar_url, created_at, updated_at 
       FROM users 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    
    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[用户管理] 获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

/**
 * GET /api/v1/users/me
 * 获取当前用户信息
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, phone, nickname, username, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('[用户管理] 获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * GET /api/v1/users/:id
 * 获取指定用户信息（仅管理员）
 */
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT id, phone, nickname, username, role, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('[用户管理] 获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/v1/users/:id/role
 * 修改用户角色（仅管理员）
 * Body 参数：role: 'admin' | 'teacher' | 'student'
 */
router.put('/:id/role', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // 验证角色值
    const validRoles = ['admin', 'teacher', 'student'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: '无效的角色值', validRoles });
    }
    
    // 不允许修改自己的角色（防止管理员把自己降级）
    if (id === req.user!.id) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }
    
    // 检查用户是否存在
    const checkResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 更新角色
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, phone, nickname, username, role',
      [role, id]
    );
    
    console.log(`[用户管理] 用户 ${req.user!.id} 将用户 ${id} 的角色从 ${checkResult.rows[0].role} 改为 ${role}`);
    
    res.json({ 
      success: true, 
      user: result.rows[0],
      message: `角色已更新为 ${role}` 
    });
  } catch (error) {
    console.error('[用户管理] 修改用户角色失败:', error);
    res.status(500).json({ error: '修改用户角色失败' });
  }
});

/**
 * PUT /api/v1/users/:id
 * 更新用户信息（管理员可修改任何用户，普通用户只能修改自己）
 * Body 参数：nickname?: string, username?: string, avatar_url?: string
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nickname, username, avatar_url } = req.body;
    
    // 权限检查：只能修改自己，除非是管理员
    if (id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: '只能修改自己的信息' });
    }
    
    // 构建更新字段
    const updates: string[] = [];
    const params: any[] = [];
    
    if (nickname !== undefined) {
      params.push(nickname);
      updates.push(`nickname = $${params.length}`);
    }
    
    if (username !== undefined) {
      params.push(username);
      updates.push(`username = $${params.length}`);
    }
    
    if (avatar_url !== undefined) {
      params.push(avatar_url);
      updates.push(`avatar_url = $${params.length}`);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }
    
    updates.push('updated_at = NOW()');
    params.push(id);
    
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, phone, nickname, username, role, avatar_url`,
      params
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('[用户管理] 更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

/**
 * GET /api/v1/users/stats/overview
 * 获取用户统计概览（仅管理员）
 */
router.get('/stats/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    // 总用户数
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM users');
    
    // 按角色统计
    const roleResult = await pool.query(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC'
    );
    
    // 今日新增
    const todayResult = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE"
    );
    
    // 本周新增
    const weekResult = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"
    );
    
    res.json({
      total: parseInt(totalResult.rows[0].total),
      byRole: roleResult.rows.reduce((acc, row) => {
        acc[row.role || 'student'] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      todayNew: parseInt(todayResult.rows[0].count),
      weekNew: parseInt(weekResult.rows[0].count),
    });
  } catch (error) {
    console.error('[用户管理] 获取用户统计失败:', error);
    res.status(500).json({ error: '获取用户统计失败' });
  }
});

export default router;
