/**
 * 多语言配置
 * 
 * 支持的语言及其 TTS/ASR 配置
 */

// 支持的语言代码
export type LanguageCode = 'en' | 'fr' | 'de' | 'es' | 'ja' | 'ko' | 'zh';

// 语言配置接口
export interface LanguageConfig {
  code: LanguageCode;
  name: string;           // 语言名称（中文）
  nativeName: string;     // 语言原生名称
  ttsSpeaker: string;     // TTS 语音 ID
  ttsSpeakerFemale?: string; // 女声
  ttsSpeakerMale?: string;   // 男声
  asrLang: string;        // ASR 语言代码
}

// 语言配置表
// 注意：TTS speaker 使用中英双语 speaker，支持多语言文本
// ASR 支持多语言识别
export const LANGUAGE_CONFIGS: Record<LanguageCode, LanguageConfig> = {
  en: {
    code: 'en',
    name: '英语',
    nativeName: 'English',
    ttsSpeaker: 'zh_male_m191_uranus_bigtts', // 中英双语 speaker
    ttsSpeakerFemale: 'zh_female_vv_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'en',
  },
  fr: {
    code: 'fr',
    name: '法语',
    nativeName: 'Français',
    // 法语 TTS 可能不支持，使用中英双语 speaker 作为后备
    ttsSpeaker: 'zh_male_m191_uranus_bigtts',
    ttsSpeakerFemale: 'zh_female_vv_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'fr',
  },
  de: {
    code: 'de',
    name: '德语',
    nativeName: 'Deutsch',
    ttsSpeaker: 'zh_male_m191_uranus_bigtts',
    ttsSpeakerFemale: 'zh_female_vv_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'de',
  },
  es: {
    code: 'es',
    name: '西班牙语',
    nativeName: 'Español',
    ttsSpeaker: 'zh_male_m191_uranus_bigtts',
    ttsSpeakerFemale: 'zh_female_vv_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'es',
  },
  ja: {
    code: 'ja',
    name: '日语',
    nativeName: '日本語',
    ttsSpeaker: 'zh_male_m191_uranus_bigtts',
    ttsSpeakerFemale: 'zh_female_vv_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'ja',
  },
  ko: {
    code: 'ko',
    name: '韩语',
    nativeName: '한국어',
    ttsSpeaker: 'zh_male_m191_uranus_bigtts',
    ttsSpeakerFemale: 'zh_female_vv_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'ko',
  },
  zh: {
    code: 'zh',
    name: '中文',
    nativeName: '中文',
    ttsSpeaker: 'zh_female_xiaohe_uranus_bigtts',
    ttsSpeakerFemale: 'zh_female_xiaohe_uranus_bigtts',
    ttsSpeakerMale: 'zh_male_m191_uranus_bigtts',
    asrLang: 'zh',
  },
};

// 获取语言配置
export function getLanguageConfig(language: string): LanguageConfig {
  return LANGUAGE_CONFIGS[language as LanguageCode] || LANGUAGE_CONFIGS.en;
}

// 获取 TTS Speaker
export function getTTSSpeaker(language: string, gender: 'male' | 'female' = 'female'): string {
  const config = getLanguageConfig(language);
  return gender === 'male' ? (config.ttsSpeakerMale || config.ttsSpeaker) : (config.ttsSpeakerFemale || config.ttsSpeaker);
}

// 获取 ASR 语言代码
export function getASRLanguage(language: string): string {
  const config = getLanguageConfig(language);
  return config.asrLang;
}

// 获取所有支持的语言列表
export function getSupportedLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGE_CONFIGS);
}
