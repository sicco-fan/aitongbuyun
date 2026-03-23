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
  onPlay?: () => void; // 播放回调
  label: string; // 标签（如"开始"）
  playIcon?: 'play' | 'play-from' | 'play-to'; // 播放图标类型
  color?: string;
}

export function TimeControl({
  value,
  onChange,
  onPlay,
  label,
  playIcon = 'play',
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
      {/* 时间显示行 - 可点击播放 */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity 
            style={[styles.timeRow, { borderColor: color }]}
            onPress={onPlay}
            activeOpacity={0.7}
          >
            <View style={styles.timeLeft}>
              <FontAwesome6 name={playIcon === 'play' ? 'play' : playIcon === 'play-from' ? 'backward' : 'forward'} size={16} color={color} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </View>
            <Text style={[styles.timeValue, { color }]}>
              {formatTime(value)}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
      
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
      
      <Text style={styles.hint}>← 滑动时间可微调 →</Text>
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
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#1a1a1a',
    minWidth: 280,
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
