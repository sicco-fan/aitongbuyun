import express, { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { S3Storage } from 'coze-coding-dev-sdk';

const router = Router();

// 配置 multer 用于处理文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
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
 * POST /api/v1/upload
 * 通用文件上传接口
 * Body: FormData { file: 文件 }
 * 返回: { url: 签名URL, key: 存储key }
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const file = req.file;
    const fileName = `uploads/${Date.now()}_${file.originalname}`;
    
    console.log(`[上传] 文件名: ${file.originalname}, 大小: ${file.size} bytes`);

    // 上传到对象存储
    const key = await storage.uploadFile({
      fileContent: file.buffer,
      fileName: fileName,
      contentType: file.mimetype || 'application/octet-stream',
    });

    // 生成签名 URL（24小时有效）
    const url = await storage.generatePresignedUrl({
      key: key,
      expireTime: 86400,
    });

    console.log(`[上传] 成功: ${key}`);

    res.json({ 
      url: url,
      key: key,
      originalName: file.originalname,
      size: file.size,
    });
  } catch (error: any) {
    console.error('[上传] 失败:', error);
    res.status(500).json({ error: error.message || '上传失败' });
  }
});

export default router;
