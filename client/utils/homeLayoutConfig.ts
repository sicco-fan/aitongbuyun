import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeLayoutType = 'single-column' | 'two-column' | 'hero-list' | 'state-driven';

export interface HomeLayoutConfig {
  layoutType: HomeLayoutType;
}

const HOME_LAYOUT_KEY = '@home_layout_config';

export const DEFAULT_HOME_LAYOUT: HomeLayoutConfig = {
  layoutType: 'state-driven',
};

export const HOME_LAYOUT_OPTIONS: { key: HomeLayoutType; name: string; description: string }[] = [
  { key: 'single-column', name: '精简模式', description: '单列流式布局，简洁高效' },
  { key: 'two-column', name: '网格模式', description: '双列网格卡片，信息密度高' },
  { key: 'hero-list', name: '焦点模式', description: '大卡片+列表，视觉焦点突出' },
  { key: 'state-driven', name: '智能模式', description: '状态驱动布局，智能自适应（推荐）' },
];

export async function getHomeLayoutConfig(): Promise<HomeLayoutConfig> {
  try {
    const stored = await AsyncStorage.getItem(HOME_LAYOUT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load home layout config:', e);
  }
  return DEFAULT_HOME_LAYOUT;
}

export async function setHomeLayoutConfig(config: HomeLayoutConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save home layout config:', e);
  }
}

export async function setHomeLayoutType(layoutType: HomeLayoutType): Promise<void> {
  await setHomeLayoutConfig({ layoutType });
}
