import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface TimeDialProps {
  value: number; // 当前时间值（毫秒）
  onChange: (delta: number) => void; // 变化量回调
  label: string; // 标签（如"开始时间"）
  min?: number;
  max?: number;
  color?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAL_SIZE = Math.min(SCREEN_WIDTH * 0.35, 140);

export function TimeDial({
  value,
  onChange,
  label,
  min = 0,
  max = 999999,
  color = '#00ff88',
}: TimeDialProps) {
  const rotation = useSharedValue(0);
  const lastRotation = useSharedValue(0);
  const lastAngle = useSharedValue(0);
  
  // 格式化时间显示
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const minutes = Math.floor(seconds / 60);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const handleChange = useCallback((delta: number) => {
    onChange(delta);
  }, [onChange]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // 计算当前触摸点相对于中心的角度
      const centerX = DIAL_SIZE / 2;
      const centerY = DIAL_SIZE / 2;
      const x = e.x - centerX;
      const y = e.y - centerY;
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      
      // 计算角度变化
      let deltaAngle = angle - lastAngle.value;
      
      // 处理跨越 -180/180 边界的情况
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;
      
      // 更新旋转值
      rotation.value = lastRotation.value + deltaAngle;
      
      // 计算时间变化量：每度对应 1ms（最小单位）
      const timeDelta = Math.round(deltaAngle);
      if (Math.abs(timeDelta) >= 1) {
        runOnJS(handleChange)(timeDelta);
        lastAngle.value = angle;
        lastRotation.value = rotation.value;
      }
    })
    .onEnd(() => {
      // 弹性回弹效果
      lastRotation.value = rotation.value;
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <GestureDetector gesture={panGesture}>
        <View style={styles.dialWrapper}>
          {/* 外圈刻度 */}
          <View style={styles.dialOuter}>
            {[...Array(12)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.tick,
                  { transform: [{ rotate: `${i * 30}deg` }] },
                ]}
              />
            ))}
          </View>
          
          {/* 可旋转的内圈 */}
          <Animated.View style={[styles.dialInner, animatedStyle, { borderColor: color }]}>
            {/* 指示线 */}
            <View style={[styles.indicator, { backgroundColor: color }]} />
          </Animated.View>
          
          {/* 中心显示 */}
          <View style={styles.centerDisplay}>
            <Text style={[styles.timeValue, { color }]}>{formatTime(value)}</Text>
          </View>
        </View>
      </GestureDetector>
      
      <Text style={styles.hint}>← 逆时针减少 | 顺时针增加 →</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dialWrapper: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialOuter: {
    position: 'absolute',
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: '#444',
    top: 2,
    transformOrigin: 'center',
  },
  dialInner: {
    width: DIAL_SIZE - 20,
    height: DIAL_SIZE - 20,
    borderRadius: (DIAL_SIZE - 20) / 2,
    borderWidth: 3,
    backgroundColor: '#1a1a1a',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 8,
  },
  indicator: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
  },
  centerDisplay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#555',
    fontSize: 10,
    marginTop: 6,
  },
});
