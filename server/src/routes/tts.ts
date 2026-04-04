import express, { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getTtsCache, setTtsCache, isVipUser, getCacheStats } from '../services/vipCache';
import { getTTSSpeaker, LANGUAGE_CONFIGS } from '../config/languages';
import type { LanguageCode } from '../config/languages';

const router: Router = express.Router();

/**
 * GET /api/v1/tts
 * 文本转语音接口（用于 Web 端实时播放）
 * Query: text: string, speaker?: string, user_id?: string, phone?: string, language?: string
 * 返回: 音频流（直接播放）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      text, 
      speaker,
      user_id,
      phone,
      language = 'en'  // 默认英语
    } = req.query as { 
      text?: string; 
      speaker?: string;
      user_id?: string;
      phone?: string;
      language?: string;
    };
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供文本内容' });
    }
    
    // 检查是否为 VIP 用户
    const vip = isVipUser(user_id || '', phone);
    if (vip) {
      console.log(`[TTS] VIP用户请求: ${user_id || phone}`);
    }
    
    // 根据语言选择合适的 speaker
    const ttsSpeaker = speaker || getTTSSpeaker(language, 'male');
    
    // 检查缓存
    const cached = getTtsCache(text, ttsSpeaker);
    if (cached) {
      console.log(`[TTS] 命中缓存: "${text.substring(0, 30)}..."`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-VIP', vip ? 'true' : 'false');
      res.setHeader('X-Language', language);
      return res.send(cached);
    }
    
    console.log(`[TTS] 生成音频: "${text.substring(0, 50)}..." language: ${language}, speaker: ${ttsSpeaker}`);
    
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);
    
    const ttsResponse = await ttsClient.synthesize({
      uid: 'web_tts_' + Date.now(),
      text: text,
      speaker: ttsSpeaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    });
    
    // 获取音频数据
    const audioResponse = await axios.get(ttsResponse.audioUri, {
      responseType: 'arraybuffer',
    });
    
    const audioBuffer = Buffer.from(audioResponse.data);
    
    // 存入缓存
    setTtsCache(text, ttsSpeaker, audioBuffer);
    
    // 设置响应头并返回音频数据
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-VIP', vip ? 'true' : 'false');
    res.setHeader('X-Language', language);
    res.send(audioBuffer);
  } catch (error: any) {
    console.error('[TTS] 生成失败:', error);
    res.status(500).json({ error: '语音生成失败', message: error.message });
  }
});

/**
 * GET /api/v1/tts/languages
 * 获取支持的语言列表
 */
router.get('/languages', (req: Request, res: Response) => {
  const languages = Object.values(LANGUAGE_CONFIGS).map(config => ({
    code: config.code,
    name: config.name,
    nativeName: config.nativeName,
  }));
  
  res.json({
    success: true,
    languages,
  });
});

/**
 * GET /api/v1/tts/cache-stats
 * 获取缓存统计信息（仅管理员）
 */
router.get('/cache-stats', (req: Request, res: Response) => {
  const stats = getCacheStats();
  res.json({
    ...stats,
    ttsSizeMB: Math.round(stats.ttsSize / 1024 / 1024 * 100) / 100,
  });
});

export default router;
