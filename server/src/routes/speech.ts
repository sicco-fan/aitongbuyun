import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 计算两个字符串的相似度（Levenshtein距离）
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j] + 1
        );
      }
    }
  }
  return dp[m][n];
}

// 计算相似度百分比
function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * POST /api/v1/speech-recognize
 * 语音识别接口
 * Body: FormData { file: audio file, targetWords?: string (逗号分隔的目标单词，用于模糊匹配) }
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const { buffer, mimetype } = req.file;
    const { targetWords } = req.body;
    
    // 将音频转为 base64
    const base64Data = buffer.toString('base64');

    // 使用 ASR 识别
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const result = await asrClient.recognize({
      uid: 'user',
      base64Data,
    });

    const recognizedText = result.text.trim();
    
    // 如果提供了目标单词列表，进行模糊匹配
    if (targetWords && recognizedText) {
      const targetList = targetWords.toLowerCase().split(',').map((w: string) => w.trim()).filter((w: string) => w);
      const recognizedWords = recognizedText.split(/\s+/).filter((w: string) => w.length > 0);
      
      // 匹配结果
      const matchedWords: string[] = [];
      
      for (const recWord of recognizedWords) {
        const recLower = recWord.toLowerCase().replace(/[^a-z]/g, '');
        if (recLower.length === 0) continue;
        
        // 寻找最佳匹配
        let bestMatch: { word: string; similarity: number } | null = null;
        
        for (const target of targetList) {
          const targetClean = target.toLowerCase().replace(/[^a-z]/g, '');
          
          // 完全匹配
          if (recLower === targetClean) {
            bestMatch = { word: target, similarity: 1 };
            break;
          }
          
          // 包含匹配
          if (recLower.includes(targetClean) || targetClean.includes(recLower)) {
            const sim = Math.max(recLower.length, targetClean.length) / Math.min(recLower.length, targetClean.length);
            if (!bestMatch || sim > bestMatch.similarity) {
              bestMatch = { word: target, similarity: sim };
            }
            continue;
          }
          
          // 模糊匹配（相似度>70%）
          const sim = similarity(recLower, targetClean);
          if (sim >= 0.7 && (!bestMatch || sim > bestMatch.similarity)) {
            bestMatch = { word: target, similarity: sim };
          }
        }
        
        if (bestMatch) {
          matchedWords.push(bestMatch.word);
        }
      }
      
      res.json({ 
        success: true,
        text: recognizedText,
        matchedWords,
        originalWords: recognizedWords,
      });
    } else {
      res.json({ 
        success: true,
        text: recognizedText,
      });
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    res.status(500).json({ error: '语音识别失败', message: (error as Error).message });
  }
});

export default router;
