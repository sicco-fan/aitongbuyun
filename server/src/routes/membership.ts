import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

// 收费开始日期 - 在此日期前注册的用户永久免费
const EARLY_ADOPTER_CUTOFF = new Date('2026-04-15T00:00:00Z');

// 会员价格配置
export const MEMBERSHIP_PRICES = {
  monthly: { price: 9.9, days: 30, name: '月度会员' },
  yearly: { price: 68, days: 365, name: '年度会员' },
  lifetime: { price: 128, days: 36500, name: '终身会员' }, // 100年
};

/**
 * 检查用户会员状态
 */
export async function checkMembership(userId: string): Promise<{
  isMember: boolean;
  memberType: string;
  expireAt: string | null;
  isEarlyAdopter: boolean;
  daysLeft: number | null;
}> {
  const client = getSupabaseClient();
  
  const { data: user, error } = await client
    .from('users')
    .select('member_type, member_expire_at, is_early_adopter, created_at')
    .eq('id', userId)
    .maybeSingle();
  
  if (error || !user) {
    return {
      isMember: false,
      memberType: 'free',
      expireAt: null,
      isEarlyAdopter: false,
      daysLeft: null,
    };
  }
  
  // 检查是否是早期用户（收费前注册）
  const isEarlyAdopter = user.is_early_adopter || 
    (user.created_at && new Date(user.created_at) < EARLY_ADOPTER_CUTOFF);
  
  if (isEarlyAdopter) {
    return {
      isMember: true,
      memberType: 'early_adopter',
      expireAt: null,
      isEarlyAdopter: true,
      daysLeft: null, // 永久
    };
  }
  
  // 检查会员类型和过期时间
  if (user.member_type === 'free' || !user.member_type) {
    return {
      isMember: false,
      memberType: 'free',
      expireAt: null,
      isEarlyAdopter: false,
      daysLeft: null,
    };
  }
  
  // 检查是否过期
  const expireAt = user.member_expire_at;
  if (expireAt && new Date(expireAt) < new Date()) {
    return {
      isMember: false,
      memberType: 'expired',
      expireAt,
      isEarlyAdopter: false,
      daysLeft: 0,
    };
  }
  
  // 计算剩余天数
  let daysLeft = null;
  if (expireAt) {
    const diff = new Date(expireAt).getTime() - Date.now();
    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  
  return {
    isMember: true,
    memberType: user.member_type,
    expireAt,
    isEarlyAdopter: false,
    daysLeft,
  };
}

/**
 * 会员验证中间件
 * 用于保护需要会员权限的接口
 */
export const requireMembership = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = (req.query.user_id || req.body.user_id) as string;
    
    if (!userId) {
      return res.status(401).json({ 
        error: '请先登录',
        needLogin: true 
      });
    }
    
    const membership = await checkMembership(userId);
    
    if (!membership.isMember) {
      return res.status(403).json({ 
        error: '该功能需要会员权限',
        needMembership: true,
        membership,
      });
    }
    
    // 将会员信息附加到请求对象
    (req as any).membership = membership;
    next();
  } catch (error) {
    console.error('会员验证失败:', error);
    res.status(500).json({ error: '会员验证失败' });
  }
};

/**
 * GET /api/v1/membership/status
 * 获取会员状态
 * Query: user_id
 */
router.get('/status', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const membership = await checkMembership(user_id as string);
    
    res.json({ 
      success: true, 
      membership: {
        ...membership,
        earlyAdopterCutoff: EARLY_ADOPTER_CUTOFF.toISOString(),
        prices: MEMBERSHIP_PRICES,
      }
    });
  } catch (error) {
    console.error('获取会员状态失败:', error);
    res.status(500).json({ error: '获取会员状态失败' });
  }
});

/**
 * POST /api/v1/membership/order
 * 创建会员订单
 * Body: { user_id: string, order_type: 'monthly' | 'yearly' | 'lifetime' }
 */
router.post('/order', async (req, res) => {
  try {
    const { user_id, order_type } = req.body;
    
    if (!user_id || !order_type) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const priceConfig = MEMBERSHIP_PRICES[order_type as keyof typeof MEMBERSHIP_PRICES];
    if (!priceConfig) {
      return res.status(400).json({ error: '无效的会员类型' });
    }
    
    const client = getSupabaseClient();
    
    // 创建订单
    const { data: order, error } = await client
      .from('membership_orders')
      .insert({
        user_id,
        order_type,
        amount: priceConfig.price,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      order: {
        id: order.id,
        order_type,
        amount: priceConfig.price,
        name: priceConfig.name,
        status: 'pending',
        created_at: order.created_at,
      }
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

/**
 * POST /api/v1/membership/activate
 * 激活会员（支付成功后调用）
 * Body: { user_id: string, order_id: number }
 */
router.post('/activate', async (req, res) => {
  try {
    const { user_id, order_id } = req.body;
    
    if (!user_id || !order_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = getSupabaseClient();
    
    // 获取订单信息
    const { data: order, error: orderError } = await client
      .from('membership_orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', user_id)
      .maybeSingle();
    
    if (orderError) throw orderError;
    
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    if (order.status === 'paid') {
      return res.status(400).json({ error: '订单已激活' });
    }
    
    const priceConfig = MEMBERSHIP_PRICES[order.order_type as keyof typeof MEMBERSHIP_PRICES];
    if (!priceConfig) {
      return res.status(400).json({ error: '无效的会员类型' });
    }
    
    // 计算过期时间
    const expireAt = new Date(Date.now() + priceConfig.days * 24 * 60 * 60 * 1000);
    
    // 更新订单状态
    await client
      .from('membership_orders')
      .update({ 
        status: 'paid', 
        paid_at: new Date().toISOString() 
      })
      .eq('id', order_id);
    
    // 更新用户会员状态
    const { data: user, error: userError } = await client
      .from('users')
      .update({ 
        member_type: order.order_type, 
        member_expire_at: expireAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select()
      .single();
    
    if (userError) throw userError;
    
    res.json({ 
      success: true, 
      message: '会员激活成功',
      membership: {
        isMember: true,
        memberType: order.order_type,
        expireAt: expireAt.toISOString(),
        daysLeft: priceConfig.days,
      }
    });
  } catch (error) {
    console.error('激活会员失败:', error);
    res.status(500).json({ error: '激活会员失败' });
  }
});

/**
 * POST /api/v1/membership/activate-free
 * 免费激活会员（用于测试或特殊用户）
 * Body: { user_id: string, days: number }
 */
router.post('/activate-free', async (req, res) => {
  try {
    const { user_id, days = 30 } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 计算过期时间
    const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    // 更新用户会员状态
    const { error } = await client
      .from('users')
      .update({ 
        member_type: 'monthly', 
        member_expire_at: expireAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      message: `已激活 ${days} 天会员`,
      expireAt: expireAt.toISOString()
    });
  } catch (error) {
    console.error('激活会员失败:', error);
    res.status(500).json({ error: '激活会员失败' });
  }
});

/**
 * GET /api/v1/membership/orders
 * 获取用户的会员订单列表
 * Query: user_id
 */
router.get('/orders', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data: orders, error } = await client
      .from('membership_orders')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      orders: orders || []
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

export default router;
