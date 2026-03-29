import express, { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

const router = Router();

// 配置 multer 用于处理头像上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

/**
 * GET /api/v1/users/me
 * 获取当前用户信息
 * Query: user_id
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, phone, role')
      .eq('id', user_id)
      .single();

    if (error) {
      console.error('获取用户信息失败:', error);
      return res.status(500).json({ success: false, error: '获取用户信息失败' });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('获取用户信息异常:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
});

/**
 * PATCH /api/v1/users/me
 * 更新当前用户信息
 * Body: user_id, username
 */
router.patch('/me', async (req: Request, res: Response) => {
  try {
    const { user_id, username } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (username !== undefined) {
      if (!username.trim()) {
        return res.status(400).json({ success: false, error: '用户名不能为空' });
      }
      updateData.username = username.trim();
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user_id);

    if (error) {
      console.error('更新用户信息失败:', error);
      return res.status(500).json({ success: false, error: '更新用户信息失败' });
    }

    return res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新用户信息异常:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
});

/**
 * POST /api/v1/users/avatar
 * 上传用户头像
 * FormData: file, user_id
 */
router.post('/avatar', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择要上传的图片' });
    }

    // 上传到对象存储
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const key = `avatars/${user_id}_${timestamp}.${ext}`;

    const uploadedKey = await storage.uploadFile({
      fileContent: req.file.buffer,
      fileName: key,
      contentType: req.file.mimetype,
    });

    // 生成签名 URL
    const url = await storage.generatePresignedUrl({
      key: uploadedKey,
      expireTime: 86400 * 30, // 30天有效
    });

    // 更新用户头像URL
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update({ 
        avatar_url: url, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', user_id);

    if (error) {
      console.error('更新用户头像失败:', error);
      return res.status(500).json({ success: false, error: '更新用户头像失败' });
    }

    return res.json({ success: true, avatar_url: url });
  } catch (error) {
    console.error('上传头像异常:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
});

export default router;
