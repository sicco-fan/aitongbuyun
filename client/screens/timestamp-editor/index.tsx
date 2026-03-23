import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Audio } from 'expo-av';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface Sentence {
  id: number;
  text: string;
  start_time: number;
  end_time: number;
}

interface WordTimestamp {
  word: string;
  start_time: number;
  end_time: number;
}

export default function TimestampEditorScreen() {
  const { theme } = useTheme();
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ materialId: number; title: string }>();
  
  const materialId = params.materialId;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  
  // 选择区域
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  // 缩放状态
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const webViewRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // Web端专用
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const waveformDataRef = useRef<number[]>([]);
  const selectionStartRef = useRef(0);
  const selectionEndRef = useRef(0);
  const scrollLeftRef = useRef(0);
  
  const [dialog, setDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  const currentSentence = sentences[currentIndex];

  const fetchData = useCallback(async () => {
    if (!materialId) return;
    
    setLoading(true);
    try {
      const materialRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}`);
      const materialData = await materialRes.json();
      
      if (materialData.material) {
        setAudioUrl(materialData.material.audio_url || '');
        setDuration(materialData.material.duration || 0);
      }
      
      if (materialData.sentences && materialData.sentences.length > 0) {
        setSentences(materialData.sentences);
      }
      
      try {
        const wordsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/word-timestamps`, {
          method: 'POST',
        });
        const wordsData = await wordsRes.json();
        if (wordsData.words && wordsData.words.length > 0) {
          setWordTimestamps(wordsData.words);
          if (wordsData.duration) {
            setDuration(wordsData.duration);
          }
        }
      } catch (e) {
        console.log('未获取到单词时间戳');
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchData();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [fetchData]);

  // 生成波形数据
  const generateWaveformData = useCallback((barCount: number, dur: number, words: WordTimestamp[]) => {
    const bars: number[] = [];
    
    const seed = 12345;
    let rand = seed;
    const seededRandom = () => {
      rand = (rand * 9301 + 49297) % 233280;
      return rand / 233280;
    };
    
    for (let i = 0; i < barCount; i++) {
      const startTime = (i / barCount) * dur;
      const endTime = ((i + 1) / barCount) * dur;
      
      const hasWord = words.some(
        w => w.start_time < endTime && w.end_time > startTime
      );
      
      let height: number;
      if (hasWord) {
        height = 0.4 + seededRandom() * 0.55;
      } else {
        height = 0.05 + seededRandom() * 0.15;
      }
      bars.push(height);
    }
    
    return bars;
  }, []);

  // 当句子切换时，更新选区
  useEffect(() => {
    if (currentSentence && duration > 0) {
      let start = 0;
      let end = duration;
      
      if (currentSentence.start_time > 0 || currentSentence.end_time > 0) {
        start = currentSentence.start_time || 0;
        end = currentSentence.end_time || duration;
      } else {
        const prevEnd = currentIndex > 0 ? sentences[currentIndex - 1].end_time : 0;
        const estimatedDuration = Math.min(3000, duration - prevEnd);
        start = prevEnd;
        end = Math.min(prevEnd + estimatedDuration, duration);
      }
      
      setSelectionStart(start);
      setSelectionEnd(end);
      selectionStartRef.current = start;
      selectionEndRef.current = end;
      
      // 通知WebView更新选区（移动端）
      if (Platform.OS !== 'web' && webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.setSelection) {
            window.setSelection(${start}, ${end});
          }
          true;
        `);
      }
    }
  }, [currentIndex, currentSentence, duration, sentences]);

  // ========== Web端 Canvas 绘制 ==========
  
  const formatTimeWeb = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const decimal = Math.floor((totalSeconds % 1) * 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${decimal.toString().padStart(2, '0')}`;
  };

  const drawWaveformWeb = useCallback(() => {
    if (Platform.OS !== 'web' || !canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const canvasWidth = containerWidth * zoomLevel;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    ctx.scale(dpr, dpr);
    
    const width = canvasWidth;
    const height = containerHeight;
    const bars = waveformDataRef.current;
    
    // 清空
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // 绘制波形
    const centerY = height / 2;
    const barWidth = width / bars.length;
    const gap = Math.max(0.5, barWidth * 0.2);
    const actualBarWidth = Math.max(1, barWidth - gap);
    
    ctx.fillStyle = '#00ff88';
    for (let i = 0; i < bars.length; i++) {
      const x = i * barWidth;
      const barHeight = bars[i] * centerY * 0.85;
      
      ctx.fillRect(x, centerY - barHeight, actualBarWidth, barHeight);
      ctx.fillRect(x, centerY, actualBarWidth, barHeight);
    }
    
    // 零电平线
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // 选区
    const startX = (selectionStartRef.current / duration) * width;
    const endX = (selectionEndRef.current / duration) * width;
    const leftX = Math.min(startX, endX);
    const rightX = Math.max(startX, endX);
    
    // 遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    if (leftX > 0) {
      ctx.fillRect(0, 0, leftX, height);
    }
    if (rightX < width) {
      ctx.fillRect(rightX, 0, width - rightX, height);
    }
    
    // 高亮
    ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
    ctx.fillRect(leftX, 0, rightX - leftX, height);
    
    // 边界线
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, 0);
    ctx.lineTo(leftX, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX, height);
    ctx.stroke();
  }, [duration, zoomLevel]);

  // Web端初始化Canvas和事件
  useEffect(() => {
    if (Platform.OS !== 'web' || loading || duration === 0) return;
    
    // 生成波形数据
    const barCount = Math.floor(800 * zoomLevel);
    waveformDataRef.current = generateWaveformData(barCount, duration, wordTimestamps);
    
    // 延迟绘制，确保DOM已渲染
    setTimeout(() => {
      drawWaveformWeb();
      
      // 滚动到选区
      if (containerRef.current) {
        const width = containerRef.current.clientWidth * zoomLevel;
        const startX = (selectionStartRef.current / duration) * width;
        const containerWidth = containerRef.current.clientWidth;
        containerRef.current.scrollLeft = Math.max(0, startX - containerWidth / 2);
      }
    }, 100);
  }, [loading, duration, wordTimestamps, zoomLevel, drawWaveformWeb, generateWaveformData]);

  // Web端鼠标事件
  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;
    
    const container = containerRef.current;
    
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      
      const rect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const canvasWidth = container.clientWidth * zoomLevel;
      const time = Math.max(0, Math.min((x / canvasWidth) * duration, duration));
      
      dragStartXRef.current = x;
      dragStartTimeRef.current = time;
      selectionStartRef.current = time;
      selectionEndRef.current = time;
      
      drawWaveformWeb();
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const x = Math.max(0, e.clientX - rect.left + scrollLeft);
      const canvasWidth = container.clientWidth * zoomLevel;
      const time = Math.max(0, Math.min((x / canvasWidth) * duration, duration));
      
      if (time < dragStartTimeRef.current) {
        selectionStartRef.current = time;
        selectionEndRef.current = dragStartTimeRef.current;
      } else {
        selectionStartRef.current = dragStartTimeRef.current;
        selectionEndRef.current = time;
      }
      
      drawWaveformWeb();
    };
    
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      
      // 确保最小选择时长
      const diff = Math.abs(selectionEndRef.current - selectionStartRef.current);
      if (diff < 100) {
        selectionEndRef.current = selectionStartRef.current + 1000;
        if (selectionEndRef.current > duration) selectionEndRef.current = duration;
      }
      
      drawWaveformWeb();
      
      // 更新React状态
      setSelectionStart(Math.min(selectionStartRef.current, selectionEndRef.current));
      setSelectionEnd(Math.max(selectionStartRef.current, selectionEndRef.current));
    };
    
    const handleScroll = () => {
      scrollLeftRef.current = container.scrollLeft;
    };
    
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [duration, zoomLevel, drawWaveformWeb]);

  // 缩放变化时重绘
  useEffect(() => {
    if (Platform.OS !== 'web' || duration === 0) return;
    
    const barCount = Math.floor(800 * zoomLevel);
    waveformDataRef.current = generateWaveformData(barCount, duration, wordTimestamps);
    drawWaveformWeb();
  }, [zoomLevel, duration, wordTimestamps, drawWaveformWeb, generateWaveformData]);

  // ========== 移动端 WebView HTML ==========
  
  const waveformHTML = useMemo(() => {
    if (Platform.OS === 'web' || duration === 0) return '';
    
    const barCount = Math.floor(800 * zoomLevel);
    const bars = generateWaveformData(barCount, duration, wordTimestamps);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #0a0a0a; overflow: hidden; height: 100%; }
    .wrapper { height: 100%; display: flex; flex-direction: column; }
    .waveform-scroll { flex: 1; overflow-x: auto; overflow-y: hidden; background: #0a0a0a; }
    .waveform-container { position: relative; height: 100%; background: #0a0a0a; cursor: crosshair; }
    canvas { display: block; height: 100%; }
    .info-bar { display: flex; justify-content: space-between; padding: 8px 16px; background: #111; border-top: 1px solid #333; }
    .time-range { color: #888; font-size: 12px; font-family: monospace; }
    .zoom-indicator { color: #00ff88; font-size: 12px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="waveform-scroll" id="scrollContainer">
      <div class="waveform-container" id="container">
        <canvas id="waveform"></canvas>
      </div>
    </div>
    <div class="info-bar">
      <span class="time-range" id="timeRange">0:00</span>
      <span class="zoom-indicator" id="zoomIndicator">${zoomLevel.toFixed(1)}x</span>
    </div>
  </div>
  <script>
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('container');
    const scrollContainer = document.getElementById('scrollContainer');
    const timeRangeEl = document.getElementById('timeRange');
    const zoomIndicatorEl = document.getElementById('zoomIndicator');
    
    let baseWidth = window.innerWidth;
    let width = baseWidth;
    let height = 200;
    let barHeights = ${JSON.stringify(bars)};
    let duration = ${duration};
    let selectionStart = ${selectionStart};
    let selectionEnd = ${selectionEnd};
    let zoomLevel = ${zoomLevel};
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartTime = 0;
    
    function formatTimeSimple(ms) {
      const totalSeconds = Math.floor(ms / 1000);
      return Math.floor(totalSeconds / 60) + ':' + (totalSeconds % 60).toString().padStart(2, '0');
    }
    
    function resize() {
      height = container.clientHeight || 200;
      width = baseWidth * zoomLevel;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      container.style.width = width + 'px';
      draw();
    }
    
    function draw() {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      const centerY = height / 2;
      const barWidth = width / barHeights.length;
      const gap = Math.max(0.5, barWidth * 0.2);
      const actualBarWidth = Math.max(1, barWidth - gap);
      
      ctx.fillStyle = '#00ff88';
      for (let i = 0; i < barHeights.length; i++) {
        const x = i * barWidth;
        const barHeight = barHeights[i] * centerY * 0.85;
        ctx.fillRect(x, centerY - barHeight, actualBarWidth, barHeight);
        ctx.fillRect(x, centerY, actualBarWidth, barHeight);
      }
      
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      
      const startX = (selectionStart / duration) * width;
      const endX = (selectionEnd / duration) * width;
      const leftX = Math.min(startX, endX);
      const rightX = Math.max(startX, endX);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      if (leftX > 0) ctx.fillRect(0, 0, leftX, height);
      if (rightX < width) ctx.fillRect(rightX, 0, width - rightX, height);
      
      ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
      ctx.fillRect(leftX, 0, rightX - leftX, height);
      
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightX, 0);
      ctx.lineTo(rightX, height);
      ctx.stroke();
      
      updateInfo();
    }
    
    function updateInfo() {
      const scrollLeft = scrollContainer.scrollLeft;
      const viewWidth = scrollContainer.clientWidth;
      const startTime = (scrollLeft / width) * duration;
      const endTime = ((scrollLeft + viewWidth) / width) * duration;
      timeRangeEl.textContent = formatTimeSimple(startTime) + ' - ' + formatTimeSimple(endTime);
      zoomIndicatorEl.textContent = zoomLevel.toFixed(1) + 'x';
    }
    
    function xToTime(x) {
      const scrollLeft = scrollContainer.scrollLeft;
      const absoluteX = scrollLeft + x;
      return Math.max(0, Math.min((absoluteX / width) * duration, duration));
    }
    
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        isDragging = true;
        const rect = container.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        dragStartX = x;
        dragStartTime = xToTime(x);
        selectionStart = dragStartTime;
        selectionEnd = dragStartTime;
        draw();
      }
    }, { passive: false });
    
    container.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      const time = xToTime(x);
      if (time < dragStartTime) {
        selectionStart = time;
        selectionEnd = dragStartTime;
      } else {
        selectionStart = dragStartTime;
        selectionEnd = time;
      }
      draw();
    }, { passive: false });
    
    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      if (Math.abs(selectionEnd - selectionStart) < 100) {
        selectionEnd = selectionStart + 1000;
        if (selectionEnd > duration) selectionEnd = duration;
      }
      draw();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'selection',
          start: Math.min(selectionStart, selectionEnd),
          end: Math.max(selectionStart, selectionEnd)
        }));
      }
    });
    
    scrollContainer.addEventListener('scroll', updateInfo);
    
    window.setSelection = function(start, end) {
      selectionStart = start;
      selectionEnd = end;
      draw();
      const startX = (start / duration) * width;
      const viewWidth = scrollContainer.clientWidth;
      scrollContainer.scrollLeft = Math.max(0, startX - viewWidth / 2);
    };
    
    window.addEventListener('resize', resize);
    resize();
  </script>
</body>
</html>`;
  }, [duration, wordTimestamps, selectionStart, selectionEnd, zoomLevel, generateWaveformData]);

  // 处理WebView消息
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'selection') {
        setSelectionStart(data.start);
        setSelectionEnd(data.end);
        selectionStartRef.current = data.start;
        selectionEndRef.current = data.end;
      }
    } catch (e) {
      console.error('WebView消息解析失败:', e);
    }
  }, []);

  // 缩放控制
  const zoomIn = () => setZoomLevel(prev => Math.min(prev * 1.5, 20));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev / 1.5, 1));

  const loadAudio = async () => {
    if (!audioUrl) return null;
    
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      
      if (status.isLoaded) {
        const realDuration = status.durationMillis || 0;
        setDuration(realDuration);
        return realDuration;
      }
      return null;
    } catch (error) {
      console.error('加载音频失败:', error);
      return null;
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded && status.didJustFinish) {
      setIsPlaying(false);
    }
  };

  const stopPlaying = async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  };

  const playSelection = async () => {
    if (!soundRef.current) await loadAudio();
    if (!soundRef.current) return;
    
    await stopPlaying();
    
    // 优先使用 ref 中的最新值（Web端拖拽后可能还没更新到React状态）
    let start: number, end: number;
    if (Platform.OS === 'web') {
      start = Math.min(selectionStartRef.current, selectionEndRef.current);
      end = Math.max(selectionStartRef.current, selectionEndRef.current);
    } else {
      start = Math.min(selectionStart, selectionEnd);
      end = Math.max(selectionStart, selectionEnd);
    }
    
    // 确保选区有效
    if (end <= start) {
      end = Math.min(start + 3000, duration);
    }
    
    console.log('播放选区:', start, '-', end, '时长:', end - start);
    
    await soundRef.current.setPositionAsync(start);
    await soundRef.current.playAsync();
    setIsPlaying(true);
    
    // 使用播放状态回调来停止，而不是 setTimeout
    const checkInterval = setInterval(async () => {
      if (!soundRef.current) {
        clearInterval(checkInterval);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.positionMillis >= end) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        clearInterval(checkInterval);
      }
    }, 50);
  };

  const confirmSelection = async () => {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: Math.round(start),
      end_time: Math.round(end),
    };
    
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1] = {
        ...newSentences[currentIndex + 1],
        start_time: Math.round(end),
      };
    }
    
    setSentences(newSentences);
    
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDialog({ visible: true, message: '已完成所有句子的音频分配！' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const sentence of sentences) {
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials/${materialId}/sentences/${sentence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: sentence.start_time,
            end_time: sentence.end_time,
          }),
        });
      }
      setDialog({ visible: true, message: '保存成功！', onConfirm: () => router.back() });
    } catch (error) {
      setDialog({ visible: true, message: `保存失败: ${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor((totalSeconds % 1) * 100).toString().padStart(2, '0')}`;
  };

  const formatTimeSimple = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={{ color: '#888', marginTop: 16 }}>正在加载音频...</Text>
        </ThemedView>
      </Screen>
    );
  }

  if (sentences.length === 0) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <FontAwesome6 name="file-lines" size={48} color="#666" />
          <Text style={{ color: '#888', marginTop: 16 }}>没有句子，请先切分文本</Text>
          <TouchableOpacity style={{ marginTop: 24, padding: 16, backgroundColor: '#00ff88', borderRadius: 8 }} onPress={() => router.back()}>
            <Text style={{ color: '#000', fontWeight: '600' }}>返回</Text>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
      {/* 顶部状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusText}>句子 {currentIndex + 1}/{sentences.length}</Text>
          <Text style={styles.statusInfo}>总时长: {formatTimeSimple(duration)}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <FontAwesome6 name="xmark" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* 当前句子 */}
      <View style={styles.sentenceBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} disabled={currentIndex === 0}>
          <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
        <View style={styles.sentenceContent}>
          <Text style={styles.sentenceText} numberOfLines={2}>{currentSentence?.text}</Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => currentIndex < sentences.length - 1 && setCurrentIndex(currentIndex + 1)} disabled={currentIndex === sentences.length - 1}>
          <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
      </View>

      {/* 缩放控制 */}
      <View style={styles.zoomControls}>
        <Text style={styles.zoomLabel}>缩放:</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} disabled={zoomLevel <= 1}>
          <FontAwesome6 name="minus" size={14} color={zoomLevel <= 1 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
        <Text style={styles.zoomValue}>{zoomLevel.toFixed(1)}x</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} disabled={zoomLevel >= 20}>
          <FontAwesome6 name="plus" size={14} color={zoomLevel >= 20 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
      </View>

      {/* 波形编辑区域 */}
      <View style={styles.waveformContainer}>
        {Platform.OS === 'web' ? (
          // Web端：直接使用Canvas
          <div 
            ref={containerRef as any}
            style={{ 
              width: '100%', 
              height: '100%', 
              overflowX: 'auto', 
              overflowY: 'hidden',
              background: '#0a0a0a',
              cursor: 'crosshair'
            }}
          >
            <canvas ref={canvasRef as any} />
          </div>
        ) : (
          // 移动端：使用WebView
          <WebView
            ref={webViewRef}
            source={{ html: waveformHTML }}
            style={styles.webView}
            onMessage={handleWebViewMessage}
            originWhitelist={['*']}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* 选区时间信息 */}
      <View style={styles.selectionInfo}>
        <View style={styles.selectionTimeBox}>
          <Text style={styles.selectionLabel}>开始</Text>
          <Text style={styles.selectionValue}>{formatTime(Math.min(selectionStart, selectionEnd))}</Text>
        </View>
        <View style={styles.selectionDurationBox}>
          <Text style={styles.selectionDuration}>{formatTime(Math.abs(selectionEnd - selectionStart))}</Text>
          <Text style={styles.selectionDurationLabel}>选中时长</Text>
        </View>
        <View style={styles.selectionTimeBox}>
          <Text style={styles.selectionLabel}>结束</Text>
          <Text style={styles.selectionValue}>{formatTime(Math.max(selectionStart, selectionEnd))}</Text>
        </View>
      </View>

      {/* 操作提示 */}
      <View style={styles.tipBar}>
        <FontAwesome6 name="hand-pointer" size={14} color="#00ff88" />
        <Text style={styles.tipText}>放大波形后，拖动选择精确的音频范围</Text>
      </View>

      {/* 底部控制栏 */}
      <View style={styles.controls}>
        <View style={styles.playControls}>
          <TouchableOpacity style={styles.playBtn} onPress={playSelection}>
            <FontAwesome6 name={isPlaying ? "pause" : "play"} size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={stopPlaying}>
            <FontAwesome6 name="stop" size={18} color="#888" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={confirmSelection}>
          <FontAwesome6 name="check" size={18} color="#000" />
          <Text style={styles.confirmBtnText}>确认并下一句</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#00ff88" /> : <FontAwesome6 name="floppy-disk" size={18} color="#00ff88" />}
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={dialog.visible}
        title="提示"
        message={dialog.message}
        confirmText="确定"
        onConfirm={() => { setDialog({ visible: false, message: '' }); dialog.onConfirm?.(); }}
        onCancel={() => setDialog({ visible: false, message: '' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#222', borderBottomWidth: 1, borderBottomColor: '#333' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusInfo: { color: '#888', fontSize: 12 },
  closeBtn: { padding: 8 },
  sentenceBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#333' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  sentenceContent: { flex: 1, paddingHorizontal: 16 },
  sentenceText: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  zoomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#333' },
  zoomLabel: { color: '#888', fontSize: 12 },
  zoomBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  zoomValue: { color: '#00ff88', fontSize: 14, fontWeight: '600', minWidth: 40, textAlign: 'center' },
  waveformContainer: { height: 220, backgroundColor: '#0a0a0a' },
  webView: { flex: 1, backgroundColor: '#0a0a0a' },
  selectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#333' },
  selectionTimeBox: { alignItems: 'center' },
  selectionLabel: { color: '#666', fontSize: 10, marginBottom: 4 },
  selectionValue: { color: '#00ff88', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  selectionDurationBox: { alignItems: 'center', backgroundColor: 'rgba(0, 255, 136, 0.15)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  selectionDuration: { color: '#00ff88', fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  selectionDurationLabel: { color: '#00ff88', fontSize: 10, marginTop: 2 },
  tipBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#333' },
  tipText: { color: '#888', fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#222', borderTopWidth: 1, borderTopColor: '#333' },
  playControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  controlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#00ff88', justifyContent: 'center', alignItems: 'center' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00ff88', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24 },
  confirmBtnText: { color: '#000', fontSize: 14, fontWeight: '600' },
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00ff88' },
});
