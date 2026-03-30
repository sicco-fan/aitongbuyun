import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { getLastLearningPosition, LastLearningPosition } from '@/utils/learningStorage';

interface Lesson {
  id: number;
  lesson_number: number;
  title: string;
  description: string;
  sentences_count: number;
}

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function CourseLessonsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ courseId: string }>();
  const courseId = params.courseId;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLearningPosition, setLastLearningPosition] = useState<LastLearningPosition | null>(null);

  const fetchData = useCallback(async () => {
    if (!courseId) return;
    
    try {
      // 获取最后学习位置
      const lastPosition = await getLastLearningPosition();
      setLastLearningPosition(lastPosition);
      
      // 获取课程信息
      const courseRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses`);
      const courseData = await courseRes.json();
      
      if (courseData.courses) {
        const foundCourse = courseData.courses.find((c: Course) => c.id === parseInt(courseId));
        setCourse(foundCourse || null);
      }
      
      // 获取课时列表
      const lessonsRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/${courseId}/lessons`);
      const lessonsData = await lessonsRes.json();
      
      if (lessonsData.lessons) {
        setLessons(lessonsData.lessons);
      }
    } catch (error) {
      console.error('获取课时列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLessonClick = useCallback((lessonId: number, lessonNumber: number, lessonTitle: string) => {
    router.push('/lesson-practice', { 
      lessonId: lessonId.toString(), 
      title: lessonTitle,
      courseId: course?.id?.toString(),
      courseTitle: course?.title,
      lessonNumber: lessonNumber.toString(),
    });
  }, [router, course]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载课时中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FontAwesome6 name="chevron-left" size={16} color={theme.primary} />
          <ThemedText variant="body" color={theme.primary} style={styles.backButtonText}>
            返回课程列表
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            {course?.title || '课程'}
          </ThemedText>
          <ThemedText variant="small" color={theme.textSecondary} style={styles.subtitle}>
            {course?.description || '选择一课开始学习'}
          </ThemedText>
        </View>

        {lessons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="book-open" size={48} color={theme.textMuted} />
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
              暂无课时
            </ThemedText>
          </View>
        ) : (
          lessons.map((lesson) => {
            // 检查是否是上次学习的课时
            const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && 
                                  lastLearningPosition.lessonId === lesson.id;
            
            return (
              <TouchableOpacity
                key={lesson.id}
                style={[styles.lessonCard, isLastLearned && styles.lastLearnedCard]}
                onPress={() => handleLessonClick(lesson.id, lesson.lesson_number, lesson.title)}
                activeOpacity={0.7}
              >
                <View style={styles.lessonNumber}>
                  <ThemedText variant="h4" color={theme.primary} style={styles.lessonNumberText}>
                    {lesson.lesson_number}
                  </ThemedText>
                </View>
                <View style={styles.lessonInfo}>
                  <ThemedText variant="h4" color={theme.textPrimary} style={styles.lessonTitle}>
                    {lesson.title}
                  </ThemedText>
                  <ThemedText variant="small" color={theme.textSecondary} style={styles.lessonSubtitle}>
                    {lesson.description}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={styles.lessonMeta}>
                    {lesson.sentences_count} 个句子
                  </ThemedText>
                  {/* 上次学习提示 */}
                  {isLastLearned && (
                    <View style={[styles.lastLearnedBadge, { backgroundColor: theme.success + '20' }]}>
                      <FontAwesome6 name="clock-rotate-left" size={10} color={theme.success} />
                      <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 4 }}>
                        上次学到 第 {lastLearningPosition.sentenceIndex + 1}/{lastLearningPosition.totalSentences} 句
                      </ThemedText>
                    </View>
                  )}
                </View>
                <FontAwesome6
                  name="chevron-right"
                  size={20}
                  color={theme.textMuted}
                  style={styles.arrowIcon}
                />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
