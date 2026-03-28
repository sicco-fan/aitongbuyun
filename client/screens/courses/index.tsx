import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
  total_lessons: number;
  cover_image?: string;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function CoursesScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses`);
      const data = await response.json();
      
      if (data.courses) {
        setCourses(data.courses);
      }
    } catch (error) {
      console.error('获取课程列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCourses();
    }, [fetchCourses])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCourses();
  }, [fetchCourses]);

  const handleCoursePress = useCallback((courseId: number) => {
    router.push('/course-lessons', { courseId: courseId.toString() });
  }, [router]);

  const getBookIcon = (bookNumber: number): string => {
    const icons: Record<number, string> = {
      1: 'book-open',
      2: 'book',
      3: 'graduation-cap',
      4: 'award',
    };
    return icons[bookNumber] || 'book';
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载课程中...
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
        <View style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            精品课程
          </ThemedText>
          <ThemedText variant="small" color={theme.textSecondary} style={styles.subtitle}>
            系统化学习，循序渐进提升英语听力
          </ThemedText>
        </View>

        {courses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="book-open" size={48} color={theme.textMuted} />
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
              暂无课程
            </ThemedText>
          </View>
        ) : (
          courses.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={styles.courseCard}
              onPress={() => handleCoursePress(course.id)}
              activeOpacity={0.7}
            >
              <View style={styles.courseHeader}>
                <View style={styles.courseIcon}>
                  <FontAwesome6
                    name={getBookIcon(course.book_number)}
                    size={24}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.courseInfo}>
                  <ThemedText variant="h4" color={theme.textPrimary} style={styles.courseTitle}>
                    {course.title}
                  </ThemedText>
                  <ThemedText variant="small" color={theme.textSecondary} style={styles.courseMeta}>
                    {course.description}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.courseStats}>
                <View style={styles.statItem}>
                  <ThemedText variant="h3" color={theme.primary} style={styles.statValue}>
                    {course.total_lessons}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
                    课程数
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText variant="h3" color={theme.primary} style={styles.statValue}>
                    {course.total_lessons * 18}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
                    预计句子数
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <FontAwesome6 name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
