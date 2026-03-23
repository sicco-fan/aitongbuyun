import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  onPlayStart?: () => void; // 按下开始播放
  onPlayStop?: () => void; // 松开停止播放
  label: string; // 标签（如"开始"）
  color?: string;
}

export function TimeControl({
  value,
  onChange,
  onPlayStart,
  onPlayStop,
  label,
  color = '#00ff88',
}: TimeControlProps) {
  const lastAngle = useSharedValue(0);
  const accumulatedDelta = useSharedValue(0);

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

  const handlePressIn = useCallback(() => {
    onPlayStart?.();
  }, [onPlayStart]);

  const handlePressOut = useCallback(() => {
    onPlayStop?.();
  }, [onPlayStop]);

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

  return (
    <View style={styles.container}>
      {/* 时间显示行 - 可点击播放，也可滑动微调 */}
      <TouchableOpacity 
        style={[styles.timeRow, { borderColor: color }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        {/* 左侧：标签 + 播放图标 */}
        <View style={styles.leftSection}>
          <Text style={[styles.label, { color }]}>{label}</Text>
          <View style={[styles.playHint, { backgroundColor: color + '20' }]}>
            <FontAwesome6 name="play" size={10} color={color} />
            <Text style={[styles.hintText, { color }]}>点击试听</Text>
          </View>
        </View>
        
        {/* 右侧：时间值 */}
        <Text style={[styles.timeValue, { color }]}>
          {formatTime(value)}
        </Text>
      </TouchableOpacity>
      
      {/* 调整按钮行 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.adjustBtn, { backgroundColor: color + '20', borderColor: color }]}
          onPress={() => onChange(-100)}
        >
          <FontAwesome6 name="angles-left" size={16} color={color} />
          <Text style={[styles.btnText, { color }]}>-100ms</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { backgroundColor: color + '20', borderColor: color }]}
          onPress={() => onChange(-10)}
        >
          <FontAwesome6 name="angle-left" size={16} color={color} />
          <Text style={[styles.btnText, { color }]}>-10ms</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { backgroundColor: color + '20', borderColor: color }]}
          onPress={() => onChange(10)}
        >
          <FontAwesome6 name="angle-right" size={16} color={color} />
          <Text style={[styles.btnText, { color }]}>+10ms</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { backgroundColor: color + '20', borderColor: color }]}
          onPress={() => onChange(100)}
        >
          <FontAwesome6 name="angles-right" size={16} color={color} />
          <Text style={[styles.btnText, { color }]}>+100ms</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.hint}>← 滑动上方时间可微调 →</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#1a1a1a',
    minWidth: 280,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hintText: {
    fontSize: 10,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    color: '#444',
    fontSize: 10,
    marginTop: 8,
  },
});
