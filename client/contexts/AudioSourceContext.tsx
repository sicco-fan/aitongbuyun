import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

// AI音色配置
export interface AIVoice {
  id: string;
  name: string;
  voiceId: string;
}

// 默认AI音色列表
const DEFAULT_AI_VOICES: AIVoice[] = [
  { id: 'ai_weiwei', name: '薇薇（双语女声）', voiceId: 'zh_female_vv_uranus_bigtts' },
  { id: 'ai_xiaohe', name: '晓荷（中文女声）', voiceId: 'zh_female_xiaohe_uranus_bigtts' },
  { id: 'ai_yunzhou', name: '云舟（中文男声）', voiceId: 'zh_male_m191_uranus_bigtts' },
  { id: 'ai_xiaotian', name: '晓天（中文男声）', voiceId: 'zh_male_taocheng_uranus_bigtts' },
];

// 音频源类型
export type AudioSourceType = 'ai' | 'user_recording' | 'community';

// 音频源信息
export interface AudioSource {
  id: string;
  type: AudioSourceType;
  name: string;
  voiceId?: string; // AI音色的voiceId
  recordingId?: string; // 用户录音或社区分享的录音ID
}

interface AudioSourceContextValue {
  // AI音色列表
  aiVoices: AIVoice[];
  
  // 选中的音源ID列表
  selectedSourceIds: string[];
  setSelectedSourceIds: (ids: string[]) => void;
  
  // 当前播放的音源索引（用于多音源轮流播放）
  currentPlayingSourceIndex: number;
  setCurrentPlayingSourceIndex: (index: number) => void;
  
  // 获取当前要播放的音源信息
  getCurrentSource: () => AudioSource | null;
  
  // 根据voiceId获取对应的AI音色
  getAIVoiceByVoiceId: (voiceId: string) => AIVoice | undefined;
  
  // 根据音源ID获取对应的voiceId（如果是AI音色）
  getVoiceIdBySourceId: (sourceId: string) => string | null;
  
  // 切换到下一个音源
  moveToNextSource: () => void;
}

const AudioSourceContext = createContext<AudioSourceContextValue | null>(null);

export function AudioSourceProvider({ children }: { children: ReactNode }) {
  const aiVoicesRef = useRef<AIVoice[]>(DEFAULT_AI_VOICES);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [currentPlayingSourceIndex, setCurrentPlayingSourceIndex] = useState(0);

  // 根据voiceId获取对应的AI音色
  const getAIVoiceByVoiceId = useCallback((voiceId: string): AIVoice | undefined => {
    return aiVoicesRef.current.find(v => v.voiceId === voiceId);
  }, []);

  // 根据音源ID获取对应的voiceId
  const getVoiceIdBySourceId = useCallback((sourceId: string): string | null => {
    const aiVoice = aiVoicesRef.current.find(v => v.id === sourceId);
    return aiVoice ? aiVoice.voiceId : null;
  }, []);

  // 获取当前要播放的音源信息
  const getCurrentSource = useCallback((): AudioSource | null => {
    if (selectedSourceIds.length === 0) {
      return null;
    }

    const currentSourceId = selectedSourceIds[currentPlayingSourceIndex % selectedSourceIds.length];
    
    // 检查是否是AI音色
    const aiVoice = aiVoicesRef.current.find(v => v.id === currentSourceId);
    if (aiVoice) {
      return {
        id: aiVoice.id,
        type: 'ai',
        name: aiVoice.name,
        voiceId: aiVoice.voiceId,
      };
    }

    // 检查是否是用户录音（格式：user_recording_xxx）
    if (currentSourceId.startsWith('user_recording_')) {
      return {
        id: currentSourceId,
        type: 'user_recording',
        name: '我的发音',
        recordingId: currentSourceId.replace('user_recording_', ''),
      };
    }

    // 检查是否是社区分享（格式：community_xxx）
    if (currentSourceId.startsWith('community_')) {
      return {
        id: currentSourceId,
        type: 'community',
        name: '社区分享',
        recordingId: currentSourceId.replace('community_', ''),
      };
    }

    return null;
  }, [selectedSourceIds, currentPlayingSourceIndex]);

  // 切换到下一个音源
  const moveToNextSource = useCallback(() => {
    if (selectedSourceIds.length > 0) {
      setCurrentPlayingSourceIndex(prev => (prev + 1) % selectedSourceIds.length);
    }
  }, [selectedSourceIds.length]);

  const value: AudioSourceContextValue = {
    aiVoices: aiVoicesRef.current,
    selectedSourceIds,
    setSelectedSourceIds,
    currentPlayingSourceIndex,
    setCurrentPlayingSourceIndex,
    getCurrentSource,
    getAIVoiceByVoiceId,
    getVoiceIdBySourceId,
    moveToNextSource,
  };

  return (
    <AudioSourceContext.Provider value={value}>
      {children}
    </AudioSourceContext.Provider>
  );
}

export function useAudioSource() {
  const context = useContext(AudioSourceContext);
  if (!context) {
    throw new Error('useAudioSource must be used within AudioSourceProvider');
  }
  return context;
}
