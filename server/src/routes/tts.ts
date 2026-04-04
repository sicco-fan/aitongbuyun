import express, { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getTtsCache, setTtsCache, isVipUser, getCacheStats } from '../services/vipCache';
import { getTTSSpeaker, LANGUAGE_CONFIGS } from '../config/languages';
import type { LanguageCode } from '../config/languages';

const router: Router = express.Router();

/**
 * 自动检测文本语言
 * 根据文本中的字符特征和常见词汇判断语言
 */
function detectLanguage(text: string): LanguageCode {
  // 语言特征字符集
  const patterns: { lang: LanguageCode; pattern: RegExp; name: string }[] = [
    // 日语：平假名、片假名
    { lang: 'ja', pattern: /[\u3040-\u309F\u30A0-\u30FF]/, name: '日语' },
    // 韩语：谚文
    { lang: 'ko', pattern: /[\uAC00-\uD7AF]/, name: '韩语' },
    // 中文：汉字（排除日语汉字范围）
    { lang: 'zh', pattern: /[\u4E00-\u9FFF]/, name: '中文' },
    // 法语：特殊字符 é, è, ê, ë, à, â, ù, û, ô, î, ç, œ, æ
    { lang: 'fr', pattern: /[éèêëàâùûôîçœæ]/i, name: '法语' },
    // 德语：ü, ö, ä, ß
    { lang: 'de', pattern: /[üöäß]/i, name: '德语' },
    // 西班牙语：ñ, ¿, ¡
    { lang: 'es', pattern: /[ñ¿¡]/i, name: '西班牙语' },
  ];
  
  // 按顺序检测（日语、韩语、中文优先，因为它们的字符集更独特）
  for (const { lang, pattern, name } of patterns) {
    if (pattern.test(text)) {
      console.log(`[语言检测] 检测到 ${name}: "${text.substring(0, 30)}..."`);
      return lang;
    }
  }
  
  // 如果没有特殊字符，检测常见词汇
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/[\s,.!?;:'"()-]+/).filter(w => w.length > 0);
  
  // 常见词汇检测（注意：词汇列表必须不包含英文词汇，避免误判）
  const languageWords: { lang: LanguageCode; words: string[]; name: string }[] = [
    // 法语常见词
    { 
      lang: 'fr', 
      words: ['bonjour', 'merci', 'oui', 'comment', 'allez', 'vous', 'tu', 'le', 'les', 'une', 'sont', 'avec', 'dans', 'cette', 'qui', 'que', 'quoi', 'où', 'quand', 'pourquoi', 'bien', 'grand', 'petit', 'homme', 'femme', 'enfant', 'maison', 'voiture', 'amour', 'monde', 'vie', 'temps', 'jour', 'nuit', 'ami', 'amie', 'belle', 'beau', 'nouveau', 'autre', 'même', 'tout', 'tous', 'rien', 'quelque', 'encore', 'déjà', 'aussi', 'très', 'beaucoup', 'mais', 'où', 'donc', 'ni', 'car', 'est', 'sont', 'être', 'avoir', 'fait', 'faire', 'peut', 'pour', 'par', 'sur', 'sous', 'entre', 'sans', 'chez', 'trop', 'peu', 'plus', 'moins', 'avant', 'après', 'maintenant', 'toujours', 'jamais', 'souvent', 'parfois', 'ensemble', 'seul', 'seule', 'tous', 'toutes', 'aucun', 'aucune', 'certains', 'certaines', 'plusieurs', 'chaque', 'tout', 'toute', 'nul', 'nulle', 'même', 'autres', 'autre', 'tel', 'telle', 'tels', 'telles'],
      name: '法语'
    },
    // 德语常见词
    { 
      lang: 'de', 
      words: ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'der', 'die', 'das', 'ist', 'sind', 'bin', 'haben', 'hab', 'hast', 'hat', 'werden', 'werde', 'wirst', 'wird', 'ein', 'eine', 'einer', 'einem', 'einen', 'nicht', 'oder', 'aber', 'mit', 'für', 'von', 'zu', 'an', 'auf', 'aus', 'bei', 'nach', 'vor', 'über', 'unter', 'durch', 'um', 'ja', 'nein', 'bitte', 'danke', 'guten', 'tag', 'morgen', 'abend', 'nacht', 'hallo', 'tschüss', 'wiedersehen', 'wie', 'was', 'wo', 'wann', 'warum', 'wer', 'welche', 'gut', 'schlecht', 'groß', 'klein', 'alt', 'jung', 'neu', 'schön', 'hässlich', 'schnell', 'langsam', 'viel', 'wenig', 'mehr', 'immer', 'nie', 'oft', 'manchmal', 'gerne', 'möglichkeit', 'möglich', 'können', 'kann', 'könnte', 'müssen', 'muss', 'sollte', 'sollen', 'wollen', 'will', 'würde', 'würden', 'diese', 'dieser', 'dieses', 'jene', 'jener', 'jenes', 'welcher', 'welches', 'alle', 'allem', 'allen', 'aller', 'alles', 'manche', 'mancher', 'manches', 'kein', 'keine', 'keiner', 'keinem', 'keinen', 'keines', 'andere', 'anderer', 'anderes', 'anderen', 'selbe', 'selber', 'selbst', 'gemeinsam', 'zusammen', 'allein'],
      name: '德语'
    },
    // 西班牙语常见词
    { 
      lang: 'es', 
      words: ['hola', 'gracias', 'favor', 'sí', 'yo', 'tú', 'él', 'ella', 'nosotros', 'ellos', 'los', 'las', 'una', 'son', 'está', 'están', 'con', 'para', 'en', 'qué', 'dónde', 'cuándo', 'cómo', 'mucho', 'poco', 'bien', 'mal', 'grande', 'pequeño', 'bueno', 'malo', 'nuevo', 'viejo', 'casa', 'coche', 'trabajo', 'dinero', 'tiempo', 'vida', 'amor', 'amigo', 'amiga', 'hombre', 'mujer', 'niño', 'niña', 'día', 'noche', 'mañana', 'tarde', 'ayer', 'hoy', 'siempre', 'nunca', 'también', 'todavía', 'muy', 'más', 'menos', 'tan', 'tanto', 'esto', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'quien', 'quienes', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'cuyo', 'cuya', 'cuyos', 'cuyas', 'todo', 'toda', 'todos', 'todas', 'algo', 'alguien', 'algún', 'alguno', 'alguna', 'algunos', 'algunas', 'nada', 'nadie', 'ningún', 'ninguno', 'ninguna', 'ningunos', 'ningunas', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'mismos', 'mismas', 'varios', 'varias', 'cada', 'cualquier', 'cualesquiera', 'quienquiera', 'quiera'],
      name: '西班牙语'
    },
  ];
  
  // 统计各语言的匹配词汇数
  const scores: { lang: LanguageCode; score: number; name: string }[] = [];
  
  for (const { lang, words: langWords, name } of languageWords) {
    const matchCount = words.filter(w => langWords.includes(w)).length;
    if (matchCount > 0) {
      scores.push({ lang, score: matchCount, name });
    }
  }
  
  // 按匹配数排序，取最高分
  scores.sort((a, b) => b.score - a.score);
  
  if (scores.length > 0) {
    const winner = scores[0];
    console.log(`[语言检测] 词汇匹配检测到 ${winner.name}: "${text.substring(0, 30)}..." (匹配 ${winner.score} 个词汇)`);
    return winner.lang;
  }
  
  // 默认英语
  return 'en';
}

/**
 * GET /api/v1/tts
 * 文本转语音接口（用于 Web 端实时播放）
 * Query: text: string, speaker?: string, user_id?: string, phone?: string, language?: string (可选，不传则自动检测)
 * 返回: 音频流（直接播放）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      text, 
      speaker,
      user_id,
      phone,
      language  // 不设置默认值，改为自动检测
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
    
    // 自动检测语言（如果没有指定）
    const detectedLanguage = language || detectLanguage(text);
    
    // 根据语言选择合适的 speaker
    const ttsSpeaker = speaker || getTTSSpeaker(detectedLanguage, 'male');
    
    // 检查缓存
    const cached = getTtsCache(text, ttsSpeaker);
    if (cached) {
      console.log(`[TTS] 命中缓存: "${text.substring(0, 30)}..."`);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-VIP', vip ? 'true' : 'false');
      res.setHeader('X-Language', detectedLanguage);
      res.setHeader('X-Language-Detected', language ? 'false' : 'true');
      return res.send(cached);
    }
    
    console.log(`[TTS] 生成音频: "${text.substring(0, 50)}..." language: ${detectedLanguage}${language ? '' : '(自动检测)'}, speaker: ${ttsSpeaker}`);
    
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
    
    // 检查 audioUri 是否有效
    if (!ttsResponse.audioUri) {
      console.error(`[TTS] 音频 URI 为空，语言: ${detectedLanguage}, speaker: ${ttsSpeaker}`);
      return res.status(500).json({ 
        error: '语音合成暂不支持该语言', 
        message: `暂不支持 ${detectedLanguage} 语言的语音合成，请使用中英双语内容`,
        language: detectedLanguage,
      });
    }
    
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
    res.setHeader('X-Language', detectedLanguage);
    res.setHeader('X-Language-Detected', language ? 'false' : 'true');
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
