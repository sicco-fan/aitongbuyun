import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * POST /api/v1/speech-recognize
 * 语音识别接口
 * Body: FormData { file: audio file }
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const { buffer, mimetype } = req.file;
    
    // 将音频转为 base64
    const base64Data = buffer.toString('base64');

    // 使用 ASR 识别
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const result = await asrClient.recognize({
      uid: 'user',
      base64Data,
    });

    res.json({ 
      success: true,
      text: result.text,
    });
  } catch (error) {
    console.error('语音识别失败:', error);
    res.status(500).json({ error: '语音识别失败', message: (error as Error).message });
  }
});

export default router;
