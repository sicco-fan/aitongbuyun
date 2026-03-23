import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 内存存储用户字母发音（生产环境应使用数据库）
// 结构: { deviceId: { letter: [audioBase64, ...] } }
const letterPronunciations: Record<string, Record<string, string[]>> = {};

/**
 * POST /api/v1/letter-pronunciation/save
 * 保存用户字母发音
 * Body: FormData { file: audio file, letter: string, deviceId: string, index: number(0-2) }
 */
router.post('/save', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const { letter, deviceId, index } = req.body;
    
    if (!letter || !deviceId || index === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证字母
    const upperLetter = letter.toUpperCase();
    if (!/^[A-Z]$/.test(upperLetter)) {
      return res.status(400).json({ error: '字母必须是A-Z' });
    }

    // 验证索引
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx > 2) {
      return res.status(400).json({ error: '索引必须是0-2' });
    }

    // 将音频转为 base64
    const base64Data = req.file.buffer.toString('base64');

    // 初始化用户存储
    if (!letterPronunciations[deviceId]) {
      letterPronunciations[deviceId] = {};
    }
    if (!letterPronunciations[deviceId][upperLetter]) {
      letterPronunciations[deviceId][upperLetter] = [];
    }

    // 保存发音（最多3次）
    letterPronunciations[deviceId][upperLetter][idx] = base64Data;

    // 检查是否已采集完成该字母的所有发音
    const letterCount = letterPronunciations[deviceId][upperLetter].filter(Boolean).length;

    res.json({ 
      success: true,
      letter: upperLetter,
      index: idx,
      totalRecordings: letterCount,
      isComplete: letterCount === 3
    });
  } catch (error) {
    console.error('保存字母发音失败:', error);
    res.status(500).json({ error: '保存字母发音失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/letter-pronunciation/status/:deviceId
 * 获取用户字母发音采集状态
 */
router.get('/status/:deviceId', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    
    const userPronunciations = letterPronunciations[deviceId] || {};
    
    // 统计已采集的字母
    const status: Record<string, number> = {};
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of alphabet) {
      status[letter] = (userPronunciations[letter] || []).filter(Boolean).length;
    }
    
    const completedLetters = Object.values(status).filter(c => c === 3).length;
    
    res.json({
      success: true,
      status,
      completedLetters,
      totalLetters: 26,
      isAllComplete: completedLetters === 26
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({ error: '获取状态失败' });
  }
});

/**
 * POST /api/v1/letter-pronunciation/recognize
 * 识别用户念的字母（快速模式，直接用ASR）
 * Body: FormData { file: audio file, deviceId: string }
 */
router.post('/recognize', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: '缺少设备ID' });
    }

    const { buffer } = req.file;
    
    // 将音频转为 base64
    const base64Data = buffer.toString('base64');

    // 使用 ASR 识别
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const result = await asrClient.recognize({
      uid: deviceId,
      base64Data,
    });

    // 从识别结果中提取字母
    const text = result.text.toUpperCase().trim();
    
    // 快速提取第一个字母
    let recognizedLetter: string | null = null;
    
    // 1. 直接是单个字母
    if (/^[A-Z]$/.test(text)) {
      recognizedLetter = text;
    }
    // 2. 从文本开头提取字母
    else if (text.length > 0) {
      const firstChar = text[0];
      if (/^[A-Z]$/.test(firstChar)) {
        recognizedLetter = firstChar;
      }
    }
    
    // 3. 快速字母发音词匹配（仅检查常见情况）
    if (!recognizedLetter && text.length <= 5) {
      const quickLetterMap: Record<string, string> = {
        'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
        'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
        'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O',
        'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
        'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z',
        'AY': 'A', 'BEE': 'B', 'SEE': 'C', 'DEE': 'D',
        'EF': 'F', 'GEE': 'G', 'AITCH': 'H', 'EYE': 'I', 'JAY': 'J',
        'KAY': 'K', 'EL': 'L', 'EM': 'M', 'EN': 'N', 'OH': 'O',
        'PEA': 'P', 'QUEUE': 'Q', 'ARE': 'R', 'ESS': 'S', 'TEA': 'T',
        'YOU': 'U', 'VEE': 'V', 'EX': 'X', 'WHY': 'Y', 'ZEE': 'Z'
      };
      
      for (const [key, letter] of Object.entries(quickLetterMap)) {
        if (text === key || text.includes(key)) {
          recognizedLetter = letter;
          break;
        }
      }
    }

    res.json({ 
      success: true,
      originalText: result.text,
      letter: recognizedLetter,
    });
  } catch (error) {
    console.error('字母识别失败:', error);
    res.status(500).json({ error: '字母识别失败', message: (error as Error).message });
  }
});

/**
 * POST /api/v1/letter-pronunciation/compare
 * 对比用户发音与存储的发音（使用ASR识别后比较）
 * Body: FormData { file: audio file, deviceId: string, targetLetter: string }
 */
router.post('/compare', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const { deviceId, targetLetter } = req.body;
    
    if (!deviceId || !targetLetter) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const upperTarget = targetLetter.toUpperCase();
    if (!/^[A-Z]$/.test(upperTarget)) {
      return res.status(400).json({ error: '目标字母必须是A-Z' });
    }

    const { buffer } = req.file;
    
    // 将音频转为 base64
    const base64Data = buffer.toString('base64');

    // 使用 ASR 识别
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const result = await asrClient.recognize({
      uid: deviceId,
      base64Data,
    });

    // 从识别结果中提取字母
    const text = result.text.toUpperCase().trim();
    
    // 判断是否匹配目标字母
    let isMatch = false;
    let recognizedLetter: string | null = null;
    
    // 直接匹配
    if (text === upperTarget) {
      isMatch = true;
      recognizedLetter = upperTarget;
    } else if (text.includes(upperTarget)) {
      isMatch = true;
      recognizedLetter = upperTarget;
    } else if (/^[A-Z]$/.test(text)) {
      recognizedLetter = text;
      isMatch = text === upperTarget;
    } else if (text.length > 0) {
      const firstChar = text[0];
      if (/^[A-Z]$/.test(firstChar)) {
        recognizedLetter = firstChar;
        isMatch = firstChar === upperTarget;
      }
    }

    // 检查字母发音词
    const letterWords: Record<string, string> = {
      'AY': 'A', 'BEE': 'B', 'SEE': 'C', 'DEE': 'D', 'E': 'E',
      'EF': 'F', 'GEE': 'G', 'AITCH': 'H', 'EYE': 'I', 'JAY': 'J',
      'KAY': 'K', 'EL': 'L', 'EM': 'M', 'EN': 'N', 'OH': 'O',
      'PEA': 'P', 'QUEUE': 'Q', 'ARE': 'R', 'ESS': 'S', 'TEA': 'T',
      'YOU': 'U', 'VEE': 'V', 'DOUBLE YOU': 'W', 'EX': 'X', 'WHY': 'Y', 'ZEE': 'Z'
    };

    if (!isMatch) {
      for (const [word, letter] of Object.entries(letterWords)) {
        if (text.includes(word)) {
          recognizedLetter = letter;
          isMatch = letter === upperTarget;
          break;
        }
      }
    }

    res.json({ 
      success: true,
      originalText: result.text,
      recognizedLetter,
      targetLetter: upperTarget,
      isMatch
    });
  } catch (error) {
    console.error('字母对比失败:', error);
    res.status(500).json({ error: '字母对比失败', message: (error as Error).message });
  }
});

export default router;
