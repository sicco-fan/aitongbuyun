import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
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
  audioDuration?: number; // 音频总时长，用于限制范围
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function TimeDial({
  value,
  onChange,
  label,
  color = '#00ff88',
  audioDuration = 0,
}: TimeDialProps) {
  const rotation = useSharedValue(0);
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

  // 手动调整按钮
  const adjustTime = (delta: number) => {
    onChange(delta);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // 使用水平滑动来调整时间，更直观
      const deltaX = e.translationX - lastAngle.value;
      
      // 每1像素对应1毫秒
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

  const animatedStyle = useAnimatedStyle(() => {
    // 轻微的视觉反馈
    return {
      transform: [{ translateX: accumulatedDelta.value * 0.3 }],
    };
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.dialArea, animatedStyle]}>
          {/* 时间显示 - 大号 */}
          <Text style={[styles.timeValue, { color }]}>
            {formatTime(value)}
          </Text>
          
          {/* 滑动提示 */}
          <Text style={styles.hint}>← 滑动调整 →</Text>
        </Animated.View>
      </GestureDetector>
      
      {/* 微调按钮 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => adjustTime(-100)}
        >
          <FontAwesome6 name="backward-fast" size={14} color={color} />
          <Text style={[styles.btnText, { color }]}>-100ms</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => adjustTime(-10)}
        >
          <FontAwesome6 name="backward" size={14} color={color} />
          <Text style={[styles.btnText, { color }]}>-10ms</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => adjustTime(10)}
        >
          <FontAwesome6 name="forward" size={14} color={color} />
          <Text style={[styles.btnText, { color }]}>+10ms</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.adjustBtn, { borderColor: color }]}
          onPress={() => adjustTime(100)}
        >
          <FontAwesome6 name="forward-fast" size={14} color={color} />
          <Text style={[styles.btnText, { color }]}>+100ms</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  dialArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    minWidth: 140,
  },
  timeValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  hint: {
    color: '#555',
    fontSize: 10,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#222',
    borderWidth: 1,
  },
  btnText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
