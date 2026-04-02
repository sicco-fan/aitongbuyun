import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { getLastLearningPosition, LastLearningPosition } from '@/utils/learningStorage';
import { getHomeLayoutConfig, HomeLayoutType } from '@/utils/homeLayoutConfig';
import { DisclaimerModal, checkDisclaimerAccepted } from '@/components/DisclaimerModal';

// 布局组件
import SingleColumnLayout from './layouts/SingleColumnLayout';
import TwoColumnLayout from './layouts/TwoColumnLayout';
import HeroListLayout from './layouts/HeroListLayout';
import StateDrivenLayout from './layouts/StateDrivenLayout';

interface SentenceFile {
  id: number;
  title: string;
  sentences_count: number;
  ready_sentences_count: number;
  status: string;
  original_duration: number;
  source_type?: string;
}

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
  total_lessons: number;
  total_sentences?: number;
  cover_image?: string;
}

interface ErrorStats {
  uniqueWords: number;
  totalErrors: number;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [sentenceFiles, setSentenceFiles] = useState<SentenceFile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [lastLearningPosition, setLastLearningPosition] = useState<LastLearningPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [layoutType, setLayoutType] = useState<HomeLayoutType>('state-driven');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  // AI 句库文件
  const aiSentenceFiles = useMemo(() => {
    return sentenceFiles.filter(f => f.source_type === 'ai_tts');
  }, [sentenceFiles]);

  // 自制句库
  const customSentenceFiles = useMemo(() => {
    return sentenceFiles.filter(f => f.source_type !== 'ai_tts');
  }, [sentenceFiles]);

  // AI 句库总句数
  const aiTotalSentences = useMemo(() => {
    const courseSentences = courses.reduce((sum, c) => sum + (c.total_sentences || c.total_lessons * 18), 0);
    const fileSentences = aiSentenceFiles.reduce((sum, f) => sum + f.ready_sentences_count, 0);
    return courseSentences + fileSentences;
  }, [courses, aiSentenceFiles]);

  const fetchData = useCallback(async () => {
    try {
      // 获取布局配置
      const config = await getHomeLayoutConfig();
      setLayoutType(config.layoutType);

      // 获取最后学习位置
      const lastPosition = await getLastLearningPosition();
      setLastLearningPosition(lastPosition);
      
      // 获取精品课程
      const coursesRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses`);
      const coursesData = await coursesRes.json();
      if (coursesData.courses) {
        const sortedCourses = [...coursesData.courses].sort((a, b) => a.book_number - b.book_number);
        setCourses(sortedCourses);
      }
      
      // 获取句库文件
      const sentenceFilesRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const sentenceFilesData = await sentenceFilesRes.json();

      if (sentenceFilesData.files) {
        const filesWithReady = sentenceFilesData.files.filter((f: SentenceFile) => f.ready_sentences_count > 0);
        setSentenceFiles(filesWithReady);
      }
      
      // 获取错题统计
      if (isAuthenticated && user?.id) {
        try {
          const errorRes = await fetch(
            `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/stats?user_id=${user.id}`
          );
          const errorData = await errorRes.json();
          if (errorData.success) {
            setErrorStats(errorData.data);
          }
        } catch (e) {
          console.log('获取错题统计失败:', e);
        }
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // 检查免责声明是否已同意
  useEffect(() => {
    const checkDisclaimer = async () => {
      const accepted = await checkDisclaimerAccepted();
      if (!accepted) {
        setShowDisclaimer(true);
      }
      setDisclaimerChecked(true);
    };
    checkDisclaimer();
  }, []);

  const handleAcceptDisclaimer = () => {
    setShowDisclaimer(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // 公共属性
  const layoutProps = {
    courses,
    aiSentenceFiles,
    customSentenceFiles,
    lastLearningPosition,
    errorStats,
    aiTotalSentences,
    onRefresh: handleRefresh,
    refreshing,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // 根据布局类型渲染对应布局
  switch (layoutType) {
    case 'single-column':
      return (
        <>
          <SingleColumnLayout {...layoutProps} />
          <DisclaimerModal visible={showDisclaimer} onAccept={handleAcceptDisclaimer} />
        </>
      );
    case 'two-column':
      return (
        <>
          <TwoColumnLayout {...layoutProps} />
          <DisclaimerModal visible={showDisclaimer} onAccept={handleAcceptDisclaimer} />
        </>
      );
    case 'hero-list':
      return (
        <>
          <HeroListLayout {...layoutProps} />
          <DisclaimerModal visible={showDisclaimer} onAccept={handleAcceptDisclaimer} />
        </>
      );
    case 'state-driven':
    default:
      return (
        <>
          <StateDrivenLayout {...layoutProps} />
          <DisclaimerModal visible={showDisclaimer} onAccept={handleAcceptDisclaimer} />
        </>
      );
  }
}
