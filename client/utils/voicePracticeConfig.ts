import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 语音答题模式类型
 * 
 * 方案 A (auto-match): 自动匹配模式
 * - 念整句 → 红色块块 → 再念（整句/部分）→ 自动匹配消除
 * - 发音容错：相似发音也算对
 * - 位置感知：念到哪，附近的块块自动高亮提示
 * 
 * 方案 B (follow-along): 实时跟随朗读模式
 * - 播放音频 → 用户跟读 → 边念边消绿色 → 念错/没念的地方显示红色
 * - 类似卡拉OK的体验
 * 
 * 方案 C (smart-guide): 智能提示+渐进式攻克模式
 * - 念整句 → 红色块块 → 自动播放红色块块附近的音频 → 用户跟读
 * - 听觉引导，更易模仿
 */
export type VoicePracticeMode = 'auto-match' | 'follow-along' | 'smart-guide';

export interface VoicePracticeModeOption {
  key: VoicePracticeMode;
  name: string;
  description: string;
  icon: string;
  features: string[];
}

export const VOICE_PRACTICE_MODE_OPTIONS: VoicePracticeModeOption[] = [
  {
    key: 'auto-match',
    name: '自动匹配',
    description: '念什么匹配什么，干净利落',
    icon: 'microphone',
    features: [
      '显示你念的内容',
      '匹配到的自动变绿',
      '不要红色提示，纯靠听力',
    ],
  },
  {
    key: 'follow-along',
    name: '跟随朗读',
    description: '显示要念的内容，跟着念',
    icon: 'headphones',
    features: [
      '显示"跟着念: xxx"提示',
      '帮助你知道要念什么',
      '适合初学者',
    ],
  },
  {
    key: 'smart-guide',
    name: '智能引导',
    description: '念错了自动播放音频',
    icon: 'lightbulb',
    features: [
      '识别失败自动播放原音',
      '听觉引导更易模仿',
      '渐进式攻克难点',
    ],
  },
];

const STORAGE_KEY = 'voice_practice_mode';

/**
 * 获取语音答题模式配置
 */
export const getVoicePracticeMode = async (): Promise<VoicePracticeMode> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && ['auto-match', 'follow-along', 'smart-guide'].includes(stored)) {
      return stored as VoicePracticeMode;
    }
  } catch (e) {
    console.log('[语音模式配置] 读取失败:', e);
  }
  return 'auto-match'; // 默认使用自动匹配模式
};

/**
 * 保存语音答题模式配置
 */
export const setVoicePracticeMode = async (mode: VoicePracticeMode): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
    console.log('[语音模式配置] 已保存:', mode);
  } catch (e) {
    console.error('[语音模式配置] 保存失败:', e);
  }
};
