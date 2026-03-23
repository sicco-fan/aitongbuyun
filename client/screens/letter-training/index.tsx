import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Text, 
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { createStyles } from './styles';
import { FontAwesome6 } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFormDataFile } from '@/utils';
import { Spacing } from '@/constants/theme';

// 后端服务地址 - 直接连接后端服务器，不经过 Metro 代理
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LetterTrainingScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  // 状态
  const [deviceId, setDeviceId] = useState<string>('');
  const [letterStatus, setLetterStatus] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordingIndex, setRecordingIndex] = useState(0); // 当前字母的第几次录音 (0-2)
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const currentLetter = ALPHABET[currentIndex];

  // 初始化设备ID
  useEffect(() => {
    const initDeviceId = async () => {
      try {
        let id = await AsyncStorage.getItem('deviceId');
        if (!id) {
          // 生成新的设备ID
          id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await AsyncStorage.setItem('deviceId', id);
        }
        setDeviceId(id);
      } catch (error) {
        console.error('初始化设备ID失败:', error);
      }
    };
    initDeviceId();
  }, []);

  // 获取字母采集状态
  useEffect(() => {
    if (deviceId) {
      fetchLetterStatus();
    }
  }, [deviceId]);

  const fetchLetterStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/letter-pronunciation/status/${deviceId}`);
      const data = await response.json();
      if (data.success) {
        setLetterStatus(data.status);
        // 找到第一个未完成的字母
        const firstIncomplete = ALPHABET.findIndex(letter => data.status[letter] < 3);
        if (firstIncomplete >= 0) {
          setCurrentIndex(firstIncomplete);
          setRecordingIndex(data.status[ALPHABET[firstIncomplete]] || 0);
        }
      }
    } catch (error) {
      console.error('获取状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要权限', '请授予麦克风权限');
        return;
      }

      setIsRecording(true);
      setStatusMessage(null);

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (error) {
      console.error('开始录音失败:', error);
      setIsRecording(false);
      Alert.alert('错误', '录音失败，请重试');
    }
  };

  // 停止录音并保存
  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      setSaving(true);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        await saveRecording(uri);
      }
    } catch (error) {
      console.error('停止录音失败:', error);
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 保存录音到服务器
  const saveRecording = async (uri: string) => {
    try {
      const formData = new FormData();
      const audioFile = await createFormDataFile(uri, 'letter.m4a', 'audio/m4a');
      formData.append('file', audioFile as any);
      formData.append('letter', currentLetter);
      formData.append('deviceId', deviceId);
      formData.append('index', recordingIndex.toString());

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/letter-pronunciation/save`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `${currentLetter} 第${recordingIndex + 1}次录音保存成功` });
        
        // 更新本地状态
        setLetterStatus(prev => ({
          ...prev,
          [currentLetter]: data.totalRecordings,
        }));

        // 判断是否需要进入下一次录音或下一个字母
        if (data.isComplete) {
          // 当前字母完成，进入下一个
          goToNextLetter();
        } else {
          // 继续当前字母的下一次录音
          setRecordingIndex(prev => prev + 1);
        }
      } else {
        throw new Error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存录音失败:', error);
      setStatusMessage({ type: 'error', text: '保存失败，请重试' });
    }
  };

  // 跳转到下一个字母
  const goToNextLetter = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < ALPHABET.length) {
      setCurrentIndex(nextIndex);
      setRecordingIndex(letterStatus[ALPHABET[nextIndex]] || 0);
      setStatusMessage(null);
    }
  };

  // 跳转到指定字母
  const goToLetter = (index: number) => {
    if (index !== currentIndex) {
      setCurrentIndex(index);
      setRecordingIndex(letterStatus[ALPHABET[index]] || 0);
      setStatusMessage(null);
    }
  };

  // 计算进度
  const completedLetters = Object.values(letterStatus).filter(c => c === 3).length;
  const progress = (completedLetters / 26) * 100;
  const isAllComplete = completedLetters === 26;

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  if (isAllComplete) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.completedContainer}>
            <View style={styles.completedIcon}>
              <FontAwesome6 name="circle-check" size={64} color={theme.success} />
            </View>
            <ThemedText variant="h2" style={styles.completedTitle}>
              恭喜完成！
            </ThemedText>
            <ThemedText variant="body" color={theme.textSecondary} style={styles.completedSubtitle}>
              您已完成26个字母的发音采集，现在可以使用逐字母语音输入功能了！
            </ThemedText>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]}
              onPress={() => router.back()}
            >
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                返回学习
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}
            onPress={() => router.back()}
          >
            <FontAwesome6 name="chevron-left" size={16} color={theme.textPrimary} />
            <ThemedText variant="smallMedium" color={theme.textPrimary} style={{ marginLeft: 8 }}>
              返回
            </ThemedText>
          </TouchableOpacity>
          <ThemedText variant="h2" style={styles.title}>
            字母发音采集
          </ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.subtitle}>
            请为每个字母录制3次发音，用于语音识别优化
          </ThemedText>
        </ThemedView>

        {/* 进度卡片 */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <ThemedText variant="smallMedium" color={theme.textPrimary}>
              采集进度
            </ThemedText>
            <ThemedText variant="smallMedium" style={styles.progressText}>
              {completedLetters}/26
            </ThemedText>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* 当前字母卡片 */}
        <View style={styles.currentLetterCard}>
          <Text style={styles.currentLetter}>{currentLetter}</Text>
          <ThemedText variant="body" color={theme.textMuted} style={styles.currentLetterHint}>
            请清晰地念出字母 {currentLetter}，录制 {recordingIndex + 1}/3 次
          </ThemedText>
          
          {/* 录音进度点 */}
          <View style={styles.recordingCount}>
            {[0, 1, 2].map(i => (
              <View 
                key={i} 
                style={[
                  styles.recordingDot, 
                  i < recordingIndex && styles.recordingDotActive
                ]} 
              />
            ))}
          </View>

          {/* 状态消息 */}
          {statusMessage && (
            <View style={[styles.statusMessage, statusMessage.type === 'success' ? styles.statusSuccess : styles.statusError]}>
              <ThemedText 
                variant="small" 
                color={statusMessage.type === 'success' ? theme.success : theme.error}
                style={styles.statusMessageText}
              >
                {statusMessage.text}
              </ThemedText>
            </View>
          )}

          {/* 录音按钮 */}
          <TouchableOpacity 
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.buttonPrimaryText} />
            ) : (
              <FontAwesome6 
                name={isRecording ? 'stop' : 'microphone'} 
                size={32} 
                color={theme.buttonPrimaryText} 
              />
            )}
          </TouchableOpacity>
          
          <ThemedText variant="caption" color={theme.textMuted}>
            {isRecording ? '点击停止录音' : '点击开始录音'}
          </ThemedText>
        </View>

        {/* 字母网格 */}
        <View style={styles.letterGrid}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.letterGridTitle}>
            字母列表（点击可跳转）
          </ThemedText>
          {(() => {
            const rows = [];
            for (let i = 0; i < ALPHABET.length; i += 7) {
              rows.push(ALPHABET.slice(i, i + 7));
            }
            return rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.letterRow}>
                {row.map((letter, letterIndex) => {
                  const globalIndex = rowIndex * 7 + letterIndex;
                  const complete = letterStatus[letter] === 3;
                  const isCurrent = globalIndex === currentIndex;
                  
                  return (
                    <TouchableOpacity 
                      key={letter}
                      style={[
                        styles.letterCell,
                        isCurrent && styles.letterCellCurrent,
                        complete && !isCurrent && styles.letterCellComplete,
                      ]}
                      onPress={() => goToLetter(globalIndex)}
                    >
                      <Text style={[
                        styles.letterCellText,
                        complete && styles.letterCellTextComplete,
                        isCurrent && styles.letterCellTextCurrent,
                      ]}>
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ));
          })()}
        </View>
      </ScrollView>
    </Screen>
  );
}
