import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { FontAwesome6 } from '@expo/vector-icons';

interface TimeControlProps {
  value: number; // 当前时间值（毫秒）
  onChange: (delta: number) => void; // 变化量回调
  onPlay?: () => void; // 播放回调（播放整个片段）
  label: string; // 标签（如"开始"）
  color?: string;
}

export function TimeControl({
  value,
  onChange,
  onPlay,
  label,
  color = '#00ff88',
}: TimeControlProps) {
  const lastAngle = useSharedValue(0);
  const accumulatedDelta = useSharedValue(0);
  
  // 长按相关
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  // 格式化时间显示
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const minutes = Math.floor(seconds / 60);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}.${millis.toString().padStart(3, '0').substring(0, 2)}`;
  };

  const handleChange = useCallback((delta: number) => {
    onChange(delta);
  }, [onChange]);

  const handlePlay = useCallback(() => {
    onPlay?.();
  }, [onPlay]);

  // 开始连续调整
  const startContinuousAdjust = useCallback((delta: number, btnText: string) => {
    // 立即执行一次
    onChange(delta);
    setPressedButton(btnText);
    
    // 150ms 后开始连续触发
    setTimeout(() => {
      // 再次执行
      onChange(delta);
      
      // 开始连续触发
      intervalRef.current = setInterval(() => {
        onChange(delta);
      }, 80);
    }, 150);
  }, [onChange]);

  // 停止连续调整
  const stopContinuousAdjust = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPressedButton(null);
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const deltaX = e.translationX - lastAngle.value;
      const timeDelta = Math.round(deltaX);
      
      if (Math.abs(timeDelta) >= 1) {
        accumulatedDelta.value += timeDelta;
        runOnJS(handleChange)(timeDelta);
        lastAngle.value = e.translationX;
      }
    })
    .onEnd(() => {
      lastAngle.value = 0;
      accumulatedDelta.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: accumulatedDelta.value * 0.15 }],
  }));

  // 渲染调整按钮 - 6个按钮在一行
  const renderAdjustButton = (delta: number, icon: string, text: string) => {
    const isPressed = pressedButton === text;
    return (
      <Pressable 
        key={text}
        style={[
          styles.adjustBtn, 
          { backgroundColor: color + '20', borderColor: color },
          isPressed && styles.adjustBtnActive,
        ]}
        onPressIn={() => startContinuousAdjust(delta, text)}
        onPressOut={stopContinuousAdjust}
        onPress={stopContinuousAdjust}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <FontAwesome6 name={icon} size={12} color={color} />
        <Text style={[styles.btnText, { color }]}>{text}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* 时间显示行 - 点击播放片段，滑动微调 */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <Pressable 
            style={[styles.timeRow, { borderColor: color }]}
            onPress={handlePlay}
          >
            <View style={styles.labelRow}>
              <FontAwesome6 name="play" size={16} color={color} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </View>
            <Text style={[styles.timeValue, { color }]}>
              {formatTime(value)}
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
      
      {/* 调整按钮行 - 6个按钮在一行，支持长按连续调整 */}
      <View style={styles.buttonRow}>
        {renderAdjustButton(-1000, 'angles-left', '-1s')}
        {renderAdjustButton(-100, 'angle-left', '-0.1')}
        {renderAdjustButton(-10, 'minus', '-10ms')}
        {renderAdjustButton(10, 'plus', '+10ms')}
        {renderAdjustButton(100, 'angle-right', '+0.1')}
        {renderAdjustButton(1000, 'angles-right', '+1s')}
      </View>
      
      <Text style={styles.hint}>点击播放 | 滑动微调 | 长按快调</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#1a1a1a',
    minWidth: 260,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  adjustBtnActive: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  btnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  hint: {
    color: '#444',
    fontSize: 9,
    marginTop: 6,
  },
});
