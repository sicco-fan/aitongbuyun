/**
 * OpenAI 服务模块
 * 
 * 提供 Whisper ASR（语音识别）和 TTS（语音合成）能力
 * 支持多语言：法语、德语、西班牙语、日语、韩语、中文、英语等
 */

import axios from 'axios';
import FormData from 'form-data';
import type { LanguageCode } from '../config/languages';

// OpenAI API 配置
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const WHISPER_MODEL = 'whisper-1'; // OpenAI Whisper 模型
const TTS_MODEL = 'tts-1'; // 标准 TTS 模型（性价比高）
const TTS_HD_MODEL = 'tts-1-hd'; // 高清 TTS 模型

// OpenAI TTS 支持的声音
// 每种声音都有不同的特点，适合不同场景
export const OPENAI_VOICES = {
  // 女声
  alloy: { name: 'Alloy', gender: 'neutral', description: '中性声音' },
  echo: { name: 'Echo', gender: 'male', description: '男声' },
  fable: { name: 'Fable', gender: 'neutral', description: '讲故事风格' },
  onyx: { name: 'Onyx', gender: 'male', description: '深沉男声' },
  nova: { name: 'Nova', gender: 'female', description: '女声' },
  shimmer: { name: 'Shimmer', gender: 'female', description: '温柔女声' },
} as const;

export type OpenAIVoice = keyof typeof OPENAI_VOICES;

// 语言代码映射（OpenAI 格式）
const OPENAI_LANGUAGE_CODES: Record<LanguageCode, string> = {
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh',
};

// 各语言推荐的 TTS 声音配置
const LANGUAGE_VOICE_MAP: Record<LanguageCode, { female: OpenAIVoice; male: OpenAIVoice }> = {
  en: { female: 'nova', male: 'echo' },
  fr: { female: 'nova', male: 'echo' }, // 法语推荐
  de: { female: 'nova', male: 'echo' },
  es: { female: 'nova', male: 'echo' },
  ja: { female: 'nova', male: 'echo' },
  ko: { female: 'nova', male: 'echo' },
  zh: { female: 'nova', male: 'echo' },
};

// ASR 响应接口
export interface OpenAIASRResponse {
  text: string;
  duration?: number;
  language?: string;
  error?: string;
}

// TTS 响应接口
export interface OpenAITTSResponse {
  audioBuffer: Buffer;
  error?: string;
}

/**
 * 检查 OpenAI API 是否可用
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * 获取 OpenAI 语言代码
 */
export function getOpenAILanguageCode(language: LanguageCode): string {
  return OPENAI_LANGUAGE_CODES[language] || 'en';
}

/**
 * 获取指定语言的推荐 TTS 声音
 */
export function getRecommendedVoice(language: LanguageCode, gender: 'male' | 'female' = 'female'): OpenAIVoice {
  const voiceConfig = LANGUAGE_VOICE_MAP[language];
  return gender === 'male' ? voiceConfig.male : voiceConfig.female;
}

/**
 * 使用 OpenAI Whisper API 进行语音识别
 * 
 * @param audioBuffer - 音频数据 Buffer
 * @param language - 语言代码（可选，不传则自动检测）
 * @param filename - 文件名（用于 FormData）
 * @returns 识别结果
 */
export async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  language?: LanguageCode,
  filename: string = 'audio.m4a'
): Promise<OpenAIASRResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      text: '',
      error: 'OPENAI_API_KEY not configured',
    };
  }
  
  try {
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename,
      contentType: 'audio/m4a',
    });
    formData.append('model', WHISPER_MODEL);
    
    // 如果指定了语言，添加语言参数（提高识别准确率）
    if (language) {
      formData.append('language', getOpenAILanguageCode(language));
    }
    
    console.log(`[OpenAI Whisper] 开始识别，语言: ${language || '自动检测'}, 模型: ${WHISPER_MODEL}`);
    
    const response = await axios.post(
      `${OPENAI_API_BASE}/audio/transcriptions`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000, // 60 秒超时
      }
    );
    
    const result = response.data;
    
    console.log(`[OpenAI Whisper] 识别完成，文本长度: ${result.text?.length || 0}`);
    
    return {
      text: result.text || '',
      duration: result.duration,
      language: result.language,
    };
  } catch (error: any) {
    console.error('[OpenAI Whisper] 识别失败:', error.message);
    
    // 解析错误详情
    let errorMessage = error.message;
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    }
    
    return {
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * 使用 OpenAI TTS API 进行语音合成
 * 
 * @param text - 要合成的文本
 * @param voice - 声音类型
 * @param speed - 语速（0.25 到 4.0，默认 1.0）
 * @returns 音频 Buffer
 */
export async function synthesizeWithOpenAI(
  text: string,
  voice: OpenAIVoice = 'nova',
  speed: number = 1.0
): Promise<OpenAITTSResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      audioBuffer: Buffer.alloc(0),
      error: 'OPENAI_API_KEY not configured',
    };
  }
  
  try {
    console.log(`[OpenAI TTS] 开始合成，声音: ${voice}, 文本长度: ${text.length}`);
    
    const response = await axios.post(
      `${OPENAI_API_BASE}/audio/speech`,
      {
        model: TTS_MODEL,
        input: text,
        voice: voice,
        speed: Math.max(0.25, Math.min(4.0, speed)), // 限制范围
        response_format: 'mp3',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000, // 30 秒超时
      }
    );
    
    const audioBuffer = Buffer.from(response.data);
    
    console.log(`[OpenAI TTS] 合成完成，音频大小: ${audioBuffer.length} bytes`);
    
    return {
      audioBuffer,
    };
  } catch (error: any) {
    console.error('[OpenAI TTS] 合成失败:', error.message);
    
    let errorMessage = error.message;
    if (error.response?.data) {
      try {
        const errorData = JSON.parse(Buffer.from(error.response.data).toString());
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    return {
      audioBuffer: Buffer.alloc(0),
      error: errorMessage,
    };
  }
}

/**
 * 判断是否应该使用 OpenAI Whisper
 * 
 * @param language - 语言代码
 * @returns 是否使用 OpenAI
 */
export function shouldUseOpenAI(language: LanguageCode): boolean {
  // OpenAI Whisper 支持所有语言，且识别准确率高
  // 中文和英语也可以使用豆包 ASR，但 OpenAI 更稳定
  
  // 如果 OpenAI 不可用，返回 false
  return isOpenAIAvailable();
}
