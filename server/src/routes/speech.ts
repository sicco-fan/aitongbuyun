import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { ASRClient, Config, HeaderUtils, LLMClient } from 'coze-coding-dev-sdk';
import { Pool } from 'pg';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 26个字母（不区分大小写）
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// 中国人常见发音错误映射（来源 → 可能被识别为）
const CHINESE_PRONUNCIATION_ERRORS: Record<string, string[]> = {
  // r/l 混淆
  'r': ['l', 'r'],
  'l': ['r', 'l'],
  // th/s/z 混淆
  'th': ['s', 'z', 't', 'd'],
  's': ['th', 'z', 's'],
  'z': ['th', 's', 'z'],
  // v/w 混淆
  'v': ['w', 'v'],
  'w': ['v', 'w'],
  // 其他常见错误
  'n': ['n', 'ng', 'm'],
  'ng': ['n', 'ng'],
  'b': ['b', 'p'],
  'p': ['p', 'b'],
  'd': ['d', 't'],
  't': ['t', 'd'],
  'g': ['g', 'k'],
  'k': ['k', 'g'],
};

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

// 从识别文本中提取字母
function extractLetters(text: string): string[] {
  const letters: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const char of lowerText) {
    if (LETTERS.includes(char)) {
      letters.push(char);
    }
  }
  
  return letters;
}

// 判断识别结果是否是字母模式
function isLetterMode(text: string): boolean {
  const cleanText = text.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanText.length === 0) return false;
  
  if (cleanText.length === 1) return true;
  
  const words = text.trim().split(/[\s,，]+/).filter(w => w.length > 0);
  
  if (words.length > 1) {
    const allSingleLetters = words.every(word => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      return clean.length === 1;
    });
    if (allSingleLetters) return true;
  }
  
  return false;
}

// 应用中国人发音纠正
function applyChinesePronunciationCorrection(recognized: string, targets: string[]): string {
  const recLower = recognized.toLowerCase();
  
  // 遍历目标单词，寻找可能的发音纠正匹配
  for (const target of targets) {
    const targetLower = target.toLowerCase();
    
    // 完全匹配
    if (recLower === targetLower) {
      return target;
    }
    
    // 检查是否可能是中国人的发音错误
    // 逐个字符比较
    if (recLower.length === targetLower.length) {
      let corrected = '';
      let hasCorrection = false;
      
      for (let i = 0; i < targetLower.length; i++) {
        const targetChar = targetLower[i];
        const recChar = recLower[i];
        
        if (targetChar === recChar) {
          corrected += recChar;
        } else {
          // 检查是否是常见发音错误
          const possibleErrors = CHINESE_PRONUNCIATION_ERRORS[targetChar] || [];
          if (possibleErrors.includes(recChar)) {
            corrected += targetChar; // 纠正为目标字符
            hasCorrection = true;
          } else {
            corrected += recChar;
          }
        }
      }
      
      if (hasCorrection && similarity(corrected, targetLower) >= 0.7) {
        console.log(`[发音纠正] "${recognized}" → "${target}" (中国人发音纠正)`);
        return target;
      }
    }
  }
  
  return recognized;
}

// 从数据库获取用户的个性化发音映射
async function getUserPronunciationMapping(deviceId: string): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    const result = await pool.query(
      `SELECT original_sound, correct_as 
       FROM pronunciation_mapping 
       WHERE device_id = $1 AND occurrence_count >= 2
       ORDER BY occurrence_count DESC`,
      [deviceId]
    );
    
    for (const row of result.rows) {
      mapping.set(row.original_sound, row.correct_as);
    }
    
    console.log(`[学习] 加载用户 ${deviceId} 的个性化映射: ${mapping.size} 条`);
  } catch (error) {
    console.error('[学习] 获取用户发音映射失败:', error);
  }
  
  return mapping;
}

// 记录用户的发音学习
async function recordPronunciationLearning(
  deviceId: string,
  materialId: number,
  recognizedText: string,
  correctText: string,
  isCorrect: boolean,
  similarityScore: number
): Promise<void> {
  try {
    // 记录学习历史
    await pool.query(
      `INSERT INTO pronunciation_learning 
       (device_id, material_id, recognized_text, correct_text, is_correct, similarity_score)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [deviceId, materialId, recognizedText, correctText, isCorrect, similarityScore]
    );
    
    // 如果识别错误，更新个性化映射
    if (!isCorrect && recognizedText && correctText) {
      const recLower = recognizedText.toLowerCase();
      const correctLower = correctText.toLowerCase();
      
      // 更新发音映射
      await pool.query(
        `INSERT INTO pronunciation_mapping 
         (device_id, original_sound, recognized_as, correct_as, occurrence_count)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (device_id, original_sound, recognized_as)
         DO UPDATE SET 
           occurrence_count = pronunciation_mapping.occurrence_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [deviceId, correctLower, recLower, correctLower]
      );
    }
    
    console.log(`[学习] 记录用户 ${deviceId} 发音: "${recognizedText}" → "${correctText}" (${isCorrect ? '正确' : '错误'})`);
  } catch (error) {
    console.error('[学习] 记录发音学习失败:', error);
  }
}

// 使用 LLM 分析用户发音模式
async function analyzeUserPronunciationPattern(deviceId: string): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT recognized_text, correct_text, similarity_score
       FROM pronunciation_learning
       WHERE device_id = $1 AND is_correct = false
       ORDER BY created_at DESC
       LIMIT 20`,
      [deviceId]
    );
    
    if (result.rows.length < 3) {
      return ''; // 数据不足，无法分析
    }
    
    const errors = result.rows.map(r => `"${r.recognized_text}" → "${r.correct_text}"`).join('\n');
    
    const config = new Config();
    const client = new LLMClient(config);
    
    const messages = [
      {
        role: 'system' as const,
        content: `你是一个英语发音专家，专门分析中国学习者的发音问题。
请根据用户的错误记录，总结他们的发音模式问题，并给出改进建议。
回复要简洁，不超过100字。`
      },
      {
        role: 'user' as const,
        content: `以下是用户最近的发音错误记录：
${errors}

请分析这个用户的发音模式问题。`
      }
    ];
    
    const response = await client.invoke(messages, { temperature: 0.7 });
    return response.content;
  } catch (error) {
    console.error('[AI分析] 分析发音模式失败:', error);
    return '';
  }
}

/**
 * POST /api/v1/speech-recognize
 * 语音识别接口 - 支持中国人发音纠正和AI学习
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    const { buffer, mimetype } = req.file;
    const { targetWords, deviceId, materialId } = req.body;
    
    // 将音频转为 base64
    const base64Data = buffer.toString('base64');

    // 使用 ASR 识别
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const asrClient = new ASRClient(new Config(), customHeaders);
    
    const result = await asrClient.recognize({
      uid: deviceId || 'user',
      base64Data,
    });

    const recognizedText = result.text.trim();
    console.log('[ASR] 原始识别结果:', recognizedText);
    
    if (!recognizedText) {
      return res.json({ 
        success: false,
        text: '',
        message: '未识别到语音内容',
      });
    }
    
    // 获取用户的个性化发音映射（AI学习）
    const userMapping = deviceId ? await getUserPronunciationMapping(deviceId) : new Map();
    
    // 获取目标单词列表
    const targetList = targetWords 
      ? targetWords.toLowerCase().split(',').map((w: string) => w.trim()).filter((w: string) => w)
      : [];
    
    // 判断是字母模式还是单词模式
    if (isLetterMode(recognizedText)) {
      const letters = extractLetters(recognizedText);
      console.log('[ASR] 字母模式，提取字母:', letters);
      
      // 应用个性化映射和学习
      const correctedLetters = letters.map(letter => {
        const corrected = userMapping.get(letter);
        return corrected || letter;
      });
      
      // 记录学习
      if (deviceId && materialId && letters.length > 0) {
        const targetLetter = targetList[0]?.[0];
        if (targetLetter) {
          const isCorrect = correctedLetters[0]?.toLowerCase() === targetLetter.toLowerCase();
          await recordPronunciationLearning(
            deviceId,
            parseInt(materialId),
            letters[0],
            targetLetter,
            isCorrect,
            isCorrect ? 1 : similarity(letters[0], targetLetter)
          );
        }
      }
      
      return res.json({ 
        success: true,
        text: recognizedText,
        letters: correctedLetters,
        mode: 'letter',
        aiCorrected: letters.join('') !== correctedLetters.join(''),
      });
    }
    
    // 单词模式
    if (targetList.length > 0) {
      const recognizedWords = recognizedText.split(/\s+/).filter((w: string) => w.length > 0);
      const matchedWords: string[] = [];
      
      console.log('[ASR] 单词模式，目标单词:', targetList.slice(0, 5), '...');
      console.log('[ASR] 识别到的词:', recognizedWords);
      
      for (const recWord of recognizedWords) {
        const recLower = recWord.toLowerCase().replace(/[^a-z]/g, '');
        if (recLower.length === 0) continue;
        
        // 应用个性化映射
        const userCorrected = userMapping.get(recLower);
        if (userCorrected && targetList.includes(userCorrected)) {
          console.log(`[学习纠正] "${recLower}" → "${userCorrected}" (用户学习)`);
          matchedWords.push(userCorrected);
          continue;
        }
        
        // 寻找最佳匹配
        let bestMatch: { word: string; similarity: number; corrected: boolean } | null = null;
        
        for (const target of targetList) {
          const targetClean = target.toLowerCase().replace(/[^a-z]/g, '');
          
          // 完全匹配
          if (recLower === targetClean) {
            bestMatch = { word: target, similarity: 1, corrected: false };
            break;
          }
          
          // 应用中国人发音纠正
          const corrected = applyChinesePronunciationCorrection(recLower, [targetClean]);
          if (corrected !== recLower) {
            bestMatch = { word: target, similarity: 0.9, corrected: true };
            break;
          }
          
          // 包含匹配
          if (recLower.includes(targetClean) || targetClean.includes(recLower)) {
            const sim = Math.max(recLower.length, targetClean.length) / Math.min(recLower.length, targetClean.length);
            if (!bestMatch || sim > bestMatch.similarity) {
              bestMatch = { word: target, similarity: sim, corrected: false };
            }
            continue;
          }
          
          // 模糊匹配（相似度>60%，降低阈值以适应非母语发音）
          const sim = similarity(recLower, targetClean);
          if (sim >= 0.6 && (!bestMatch || sim > bestMatch.similarity)) {
            bestMatch = { word: target, similarity: sim, corrected: false };
          }
        }
        
        if (bestMatch) {
          matchedWords.push(bestMatch.word);
        }
      }
      
      console.log('[ASR] 匹配结果:', matchedWords);
      
      // 记录学习
      if (deviceId && materialId && matchedWords.length > 0) {
        for (const matched of matchedWords) {
          const originalRec = recognizedWords.find(w => 
            similarity(w.toLowerCase(), matched.toLowerCase()) >= 0.6
          );
          if (originalRec) {
            const isCorrect = originalRec.toLowerCase() === matched.toLowerCase();
            await recordPronunciationLearning(
              deviceId,
              parseInt(materialId),
              originalRec,
              matched,
              isCorrect,
              similarity(originalRec, matched)
            );
          }
        }
      }
      
      return res.json({ 
        success: true,
        text: recognizedText,
        matchedWords,
        originalWords: recognizedWords,
        mode: 'word',
        aiCorrected: matchedWords.length > 0 && 
          !recognizedWords.some(w => matchedWords.includes(w.toLowerCase())),
      });
    }
    
    // 没有目标单词，直接返回识别结果
    return res.json({ 
      success: true,
      text: recognizedText,
      mode: 'raw',
    });
  } catch (error) {
    console.error('语音识别失败:', error);
    res.status(500).json({ error: '语音识别失败', message: (error as Error).message });
  }
});

/**
 * GET /api/v1/speech-recognize/analysis
 * 获取用户发音模式分析
 */
router.get('/analysis/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const analysis = await analyzeUserPronunciationPattern(deviceId as string);
    
    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('分析失败:', error);
    res.status(500).json({ error: '分析失败', message: (error as Error).message });
  }
});

export default router;
