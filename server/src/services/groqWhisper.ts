/**
 * Groq Whisper 多语言语音识别服务
 * 
 * 使用 Groq 的 Whisper API 支持多语言语音识别
 * 支持：法语、德语、西班牙语、日语、韩语等 99+ 种语言
 * 
 * 文档：https://console.groq.com/docs/speech-text
 */

import axios from 'axios';
import FormData from 'form-data';
import type { LanguageCode } from '../config/languages';

// Groq Whisper API 配置
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo'; // 最佳性价比，支持多语言

// Groq Whisper 语言代码映射
const GROQ_LANGUAGE_CODES: Record<LanguageCode, string> = {
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh',
};

// ASR 响应接口
export interface GroqASRResponse {
  text: string;
  duration?: number;
  error?: string;
}

/**
 * 检查 Groq API 是否可用
 */
export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * 获取 Groq 语言代码
 */
export function getGroqLanguageCode(language: LanguageCode): string {
  return GROQ_LANGUAGE_CODES[language] || 'en';
}

/**
 * 使用 Groq Whisper API 进行语音识别
 * 
 * @param audioBuffer - 音频数据 Buffer
 * @param language - 语言代码
 * @param filename - 文件名（用于 FormData）
 * @returns 识别结果
 */
export async function transcribeWithGroq(
  audioBuffer: Buffer,
  language: LanguageCode,
  filename: string = 'audio.m4a'
): Promise<GroqASRResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return {
      text: '',
      error: 'GROQ_API_KEY not configured',
    };
  }
  
  try {
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename,
      contentType: 'audio/m4a',
    });
    formData.append('model', GROQ_WHISPER_MODEL);
    formData.append('language', getGroqLanguageCode(language));
    formData.append('response_format', 'json');
    
    console.log(`[Groq Whisper] 开始识别，语言: ${language}, 模型: ${GROQ_WHISPER_MODEL}`);
    
    const response = await axios.post(GROQ_API_URL, formData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000, // 60 秒超时
    });
    
    const result = response.data;
    
    console.log(`[Groq Whisper] 识别完成，文本长度: ${result.text?.length || 0}`);
    
    return {
      text: result.text || '',
      duration: result.duration,
    };
  } catch (error: any) {
    console.error('[Groq Whisper] 识别失败:', error.message);
    
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
 * 使用 URL 进行语音识别
 * 
 * @param audioUrl - 音频文件 URL
 * @param language - 语言代码
 * @returns 识别结果
 */
export async function transcribeUrlWithGroq(
  audioUrl: string,
  language: LanguageCode
): Promise<GroqASRResponse> {
  try {
    // 下载音频文件
    console.log(`[Groq Whisper] 下载音频文件: ${audioUrl}`);
    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const audioBuffer = Buffer.from(response.data);
    
    // 从 URL 提取文件名
    const urlPath = new URL(audioUrl).pathname;
    const filename = urlPath.split('/').pop() || 'audio.m4a';
    
    return transcribeWithGroq(audioBuffer, language, filename);
  } catch (error: any) {
    console.error('[Groq Whisper] 下载音频失败:', error.message);
    return {
      text: '',
      error: `Failed to download audio: ${error.message}`,
    };
  }
}

/**
 * 判断是否应该使用 Groq Whisper
 * 
 * @param language - 语言代码
 * @returns 是否使用 Groq
 */
export function shouldUseGroq(language: LanguageCode): boolean {
  // 中文和英语使用豆包 ASR（更稳定）
  // 其他语言使用 Groq Whisper
  const doubaoSupportedLanguages: LanguageCode[] = ['zh', 'en'];
  
  if (doubaoSupportedLanguages.includes(language)) {
    return false;
  }
  
  // 如果 Groq 不可用，返回 false（将在 speech.ts 中处理）
  return isGroqAvailable();
}
