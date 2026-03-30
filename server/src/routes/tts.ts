import express, { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router: Router = express.Router();

/**
 * GET /api/v1/tts
 * 文本转语音接口（用于 Web 端实时播放）
 * Query: text: string, speaker?: string
 * 返回: 音频流（直接播放）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { text, speaker = 'zh_female_xiaohe_uranus_bigtts' } = req.query as { text?: string; speaker?: string };
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供文本内容' });
    }
    
    console.log(`[TTS] 生成音频: "${text.substring(0, 50)}..." speaker: ${speaker}`);
    
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);
    
    const ttsResponse = await ttsClient.synthesize({
      uid: 'web_tts_' + Date.now(),
      text: text,
      speaker: speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    });
    
    // 获取音频数据
    const audioResponse = await axios.get(ttsResponse.audioUri, {
      responseType: 'arraybuffer',
    });
    
    // 设置响应头并返回音频数据
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioResponse.data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
    res.send(Buffer.from(audioResponse.data));
  } catch (error: any) {
    console.error('[TTS] 生成失败:', error);
    res.status(500).json({ error: '语音生成失败', message: error.message });
  }
});

export default router;
