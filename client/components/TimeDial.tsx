import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { FontAwesome6 } from '@expo/vector-icons';

interface TimeDialProps {
  value: number; // 当前时间值（毫秒）
  onChange: (delta: number) => void; // 变化量回调
  label: string; // 标签（如"开始"）
  color?: string;
}

export function TimeDial({
  value,
  onChange,
  label,
  color = '#00ff88',
}: TimeDialProps) {
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
    transform: [{ translateX: accumulatedDelta.value * 0.3 }],
  }));

  return (
    <View style={styles.container}>
      {/* 标签 */}
      <Text style={[styles.label, { color }]}>{label}</Text>
      
      {/* 时间显示区域 - 可滑动 */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.dialArea, { borderColor: color }, animatedStyle]}>
          <Text style={[styles.timeValue, { color }]}>
            {formatTime(value)}
          </Text>
          <Text style={styles.hint}>← 滑动调整 →</Text>
        </Animated.View>
      </GestureDetector>
      
      {/* 微调按钮 - 紧凑布局 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => onChange(-100)}
        >
          <FontAwesome6 name="angles-left" size={12} color={color} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => onChange(-10)}
        >
          <FontAwesome6 name="angle-left" size={12} color={color} />
        </TouchableOpacity>
        
        <View style={styles.divider} />
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => onChange(10)}
        >
          <FontAwesome6 name="angle-right" size={12} color={color} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => onChange(100)}
        >
          <FontAwesome6 name="angles-right" size={12} color={color} />
        </TouchableOpacity>
      </View>
      
      {/* 步长说明 */}
      <Text style={styles.stepHint}>±10ms / ±100ms</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dialArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 120,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#444',
    fontSize: 9,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  adjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 8,
  },
  stepHint: {
    color: '#444',
    fontSize: 9,
    marginTop: 4,
  },
});
