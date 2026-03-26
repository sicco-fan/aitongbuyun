import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

// 验证码有效期（分钟）
const CODE_EXPIRE_MINUTES = 5;

// 开发模式固定验证码
const DEV_CODE = '123456';

/**
 * 生成随机验证码
 */
function generateCode(): string {
  // 开发阶段使用固定验证码
  if (process.env.NODE_ENV === 'development') {
    return DEV_CODE;
  }
  // 生产环境生成随机6位数字
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/v1/auth/send-code
 * 发送验证码
 * Body: { phone: string }
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: '请输入手机号' });
    }
    
    // 验证手机号格式（中国大陆）
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' });
    }
    
    const client = getSupabaseClient();
    
    // 使该手机号之前的验证码失效
    await client
      .from('verification_codes')
      .update({ used: true })
      .eq('phone', phone)
      .eq('used', false);
    
    // 生成验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000).toISOString();
    
    // 保存验证码
    const { error } = await client
      .from('verification_codes')
      .insert({ phone, code, expires_at: expiresAt, used: false });
    
    if (error) throw error;
    
    // TODO: 生产环境调用短信服务发送验证码
    // 目前开发阶段直接返回验证码（生产环境不应返回）
    console.log(`[SMS] 发送验证码到 ${phone}: ${code}`);
    
    res.json({ 
      success: true, 
      message: '验证码已发送',
      // 开发环境返回验证码，生产环境应删除此字段
      ...(process.env.NODE_ENV === 'development' && { code })
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

/**
 * POST /api/v1/auth/login
 * 验证码登录
 * Body: { phone: string, code: string }
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: '请输入手机号和验证码' });
    }
    
    const client = getSupabaseClient();
    
    // 验证验证码
    const { data: codeRecord, error: codeError } = await client
      .from('verification_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (codeError) throw codeError;
    
    if (!codeRecord) {
      return res.status(400).json({ error: '验证码无效或已过期' });
    }
    
    // 标记验证码已使用
    await client
      .from('verification_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);
    
    // 查找或创建用户
    const { data: existingUser, error: userError } = await client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    
    if (userError) throw userError;
    
    let user;
    
    if (existingUser) {
      // 更新最后登录时间
      const { data, error } = await client
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingUser.id)
        .select()
        .single();
      if (error) throw error;
      user = data;
    } else {
      // 创建新用户
      const { data, error } = await client
        .from('users')
        .insert({ phone, nickname: `用户${phone.slice(-4)}` })
        .select()
        .single();
      if (error) throw error;
      user = data;
    }
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        device_id: user.device_id
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

/**
 * POST /api/v1/auth/guest
 * 游客登录（使用设备ID）
 * Body: { device_id: string }
 */
router.post('/guest', async (req, res) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: '设备ID不能为空' });
    }
    
    const client = getSupabaseClient();
    
    // 查找或创建游客用户
    const { data: existingUser, error: userError } = await client
      .from('users')
      .select('*')
      .eq('device_id', device_id)
      .maybeSingle();
    
    if (userError) throw userError;
    
    let user;
    
    if (existingUser) {
      // 更新最后登录时间
      const { data, error } = await client
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingUser.id)
        .select()
        .single();
      if (error) throw error;
      user = data;
    } else {
      // 创建新的游客用户
      const { data, error } = await client
        .from('users')
        .insert({ device_id, nickname: `游客${device_id.slice(-4)}` })
        .select()
        .single();
      if (error) throw error;
      user = data;
    }
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        device_id: user.device_id,
        is_guest: !user.phone
      }
    });
  } catch (error) {
    console.error('游客登录失败:', error);
    res.status(500).json({ error: '游客登录失败' });
  }
});

/**
 * GET /api/v1/auth/me
 * 获取当前用户信息
 * Query: user_id
 */
router.get('/me', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data: user, error } = await client
      .from('users')
      .select('id, phone, nickname, device_id, created_at')
      .eq('id', user_id)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ 
      success: true, 
      user: {
        ...user,
        is_guest: !user.phone
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/v1/auth/profile
 * 更新用户资料
 * Body: { user_id: string, nickname?: string }
 */
router.put('/profile', async (req, res) => {
  try {
    const { user_id, nickname } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data: user, error } = await client
      .from('users')
      .update({ 
        nickname, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', user_id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        device_id: user.device_id
      }
    });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    res.status(500).json({ error: '更新用户资料失败' });
  }
});

export default router;
