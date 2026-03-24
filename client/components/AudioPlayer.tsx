import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';

interface AudioPlayerProps {
  uri: string;
  onTimeUpdate?: (time: number) => void;
  onDurationLoad?: (duration: number) => void;
}

export function AudioPlayer({ uri, onTimeUpdate, onDurationLoad }: AudioPlayerProps) {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis / 1000);
      
      if (status.durationMillis) {
        setDuration(status.durationMillis / 1000);
        onDurationLoad?.(status.durationMillis / 1000);
      }
      
      setIsPlaying(status.isPlaying);
      
      // 播放结束时停止
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    }
  };

  const unloadAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 卸载之前的音频
      await unloadAudio();
      
      // 配置音频模式
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: false },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      setIsLoading(false);
    } catch (err) {
      console.error('加载音频失败:', err);
      setError('加载音频失败');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 异步加载音频
    let cancelled = false;
    
    const initAudio = async () => {
      try {
        // 配置音频模式
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        // 卸载之前的音频
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false, isLooping: false },
          onPlaybackStatusUpdate
        );
        
        if (!cancelled) {
          soundRef.current = sound;
          setIsLoading(false);
        } else {
          await sound.unloadAsync();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('加载音频失败:', err);
          setError('加载音频失败');
          setIsLoading(false);
        }
      }
    };
    
    initAudio();
    
    return () => {
      cancelled = true;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [uri]);

  const togglePlayPause = async () => {
    if (!soundRef.current) return;
    
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.error('播放/暂停失败:', err);
    }
  };

  const stop = async () => {
    if (!soundRef.current) return;
    
    try {
      await soundRef.current.stopAsync();
      setCurrentTime(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('停止失败:', err);
    }
  };

  const seekBackward = async () => {
    if (!soundRef.current) return;
    
    try {
      const newTime = Math.max(0, currentTime - 5);
      await soundRef.current.setPositionAsync(newTime * 1000);
      setCurrentTime(newTime);
    } catch (err) {
      console.error('后退失败:', err);
    }
  };

  const seekForward = async () => {
    if (!soundRef.current) return;
    
    try {
      const newTime = Math.min(duration, currentTime + 5);
      await soundRef.current.setPositionAsync(newTime * 1000);
      setCurrentTime(newTime);
    } catch (err) {
      console.error('前进失败:', err);
    }
  };

  const handleSliderChange = async (value: number) => {
    if (!soundRef.current) return;
    
    try {
      await soundRef.current.setPositionAsync(value * 1000);
      setCurrentTime(value);
    } catch (err) {
      console.error('跳转失败:', err);
    }
  };

  // 定时更新当前时间
  useEffect(() => {
    if (isPlaying) {
      updateIntervalRef.current = setInterval(() => {
        if (soundRef.current) {
          soundRef.current.getStatusAsync().then(status => {
            if (status.isLoaded) {
              setCurrentTime(status.positionMillis / 1000);
              onTimeUpdate?.(status.positionMillis / 1000);
            }
          });
        }
      }, 100);
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    }
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isPlaying, onTimeUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <View style={styles.container}>
        <ThemedText variant="body" color={theme.error}>
          {error}
        </ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={loadAudio}>
          <ThemedText variant="smallMedium" color={theme.primary}>
            重试
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} />
      ) : (
        <>
          {/* Progress Bar (Web) */}
          {Platform.OS === 'web' && (
            <View style={styles.progressContainer}>
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </View>
          )}
          
          {/* Time Display */}
          <View style={styles.timeContainer}>
            <ThemedText variant="small" color={theme.textMuted}>
              {formatTime(currentTime)}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              {formatTime(duration)}
            </ThemedText>
          </View>
          
          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={seekBackward}>
              <FontAwesome6 name="backward" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
              <FontAwesome6 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color={theme.buttonPrimaryText} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={seekForward}>
              <FontAwesome6 name="forward" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={stop}>
              <FontAwesome6 name="stop" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.md,
    },
    progressContainer: {
      width: '100%',
      marginBottom: Spacing.sm,
    },
    timeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
    },
    controlButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryButton: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.sm,
    },
  });
