import express, { type Request, type Response } from 'express';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = express.Router();

/**
 * 翻译接口
 * POST /api/v1/translate
 * Body: { text: string, type: 'word' | 'sentence' }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, type = 'word' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '缺少要翻译的文本' });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(
      req.headers as Record<string, string>
    );
    
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    let systemPrompt: string;
    if (type === 'word') {
      systemPrompt = `你是一个英语词典助手。用户会给你一个英语单词，你需要返回这个单词的中文意思。
要求：
1. 只返回中文意思，不要其他解释
2. 如果单词有多种意思，用顿号分隔列出最常见的2-3个意思
3. 不要加任何标点符号或解释`;
    } else {
      systemPrompt = `你是一个英语翻译助手。用户会给你一个英语句子，你需要翻译成中文。
要求：
1. 只返回中文翻译，不要其他解释
2. 翻译要准确、自然、流畅`;
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: text }
    ];

    const response = await client.invoke(messages, { 
      temperature: 0.3,
      model: 'doubao-seed-1-6-lite-251015' // 使用轻量模型，翻译任务不需要复杂推理
    });

    res.json({ 
      translation: response.content.trim(),
      original: text 
    });
  } catch (error) {
    console.error('翻译失败:', error);
    res.status(500).json({ error: '翻译失败' });
  }
});

export default router;
