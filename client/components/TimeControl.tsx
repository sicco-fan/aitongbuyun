import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

  // 渲染调整按钮 - 6个按钮在一行，充满整个宽度
  const renderAdjustButton = (delta: number, icon: string, text: string) => {
    return (
      <Pressable 
        key={text}
        style={[styles.adjustBtn, { backgroundColor: color + '20', borderColor: color }]}
        onPress={() => onChange(delta)}
        hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
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
      
      {/* 调整按钮行 - 6个按钮充满整个宽度 */}
      <View style={styles.buttonRow}>
        {renderAdjustButton(-1000, 'angles-left', '-1s')}
        {renderAdjustButton(-100, 'angle-left', '-0.1')}
        {renderAdjustButton(-10, 'minus', '-10ms')}
        {renderAdjustButton(10, 'plus', '+10ms')}
        {renderAdjustButton(100, 'angle-right', '+0.1')}
        {renderAdjustButton(1000, 'angles-right', '+1s')}
      </View>
      
      <Text style={styles.hint}>点击播放 | 滑动微调</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
    width: '100%',
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
    justifyContent: 'space-between',
    marginTop: 10,
    width: '100%',
    gap: 4,
  },
  adjustBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
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
