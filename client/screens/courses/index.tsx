import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore - react-native-sse 类型定义不完整
import RNSSE from 'react-native-sse';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { createFormDataFile } from '@/utils';

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
  total_lessons: number;
  total_sentences?: number;  // 实际句子数
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
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<'idle' | 'uploading' | 'importing'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [importProgress, setImportProgress] = useState(''); // 导入进度消息
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBookTitle, setImportBookTitle] = useState('新概念英语第三册');
  const [importBookNumber, setImportBookNumber] = useState('3');
  const xhrRef = useRef<XMLHttpRequest | null>(null); // 用于取消上传
  const sseRef = useRef<any>(null); // 用于取消 SSE

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

  // 选择并上传 PDF 文件
  const handlePickPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      console.log('[导入课程] 选择的文件:', file.name, file.uri);

      // 上传文件到对象存储
      setImporting(true);
      setImportPhase('uploading');
      setUploadProgress(0);

      const formData = new FormData();
      const fileData = await createFormDataFile(file.uri, file.name, 'application/pdf');
      formData.append('file', fileData as any);

      // 使用 XMLHttpRequest 跟踪上传进度
      const uploadUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/upload`;
      const uploadData = await new Promise<{ url?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
            console.log(`[导入课程] 上传进度: ${progress}%`);
          }
        });

        xhr.addEventListener('load', () => {
          xhrRef.current = null;
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error('解析响应失败'));
            }
          } else {
            reject(new Error(`上传失败: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          xhrRef.current = null;
          reject(new Error('网络错误'));
        });

        xhr.addEventListener('abort', () => {
          xhrRef.current = null;
          reject(new Error('已取消'));
        });

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
      });

      if (!uploadData.url) {
        throw new Error(uploadData.error || '文件上传失败');
      }

      console.log('[导入课程] 文件上传成功:', uploadData.url);

      // 调用导入 API (使用 SSE 接收进度)
      setImportPhase('importing');
      setImportProgress('正在初始化导入...');

      const sseUrl = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/import-pdf`;
      
      await new Promise<void>((resolve, reject) => {
        const sse = new RNSSE(sseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            pdf_url: uploadData.url,
            book_title: importBookTitle,
            book_number: parseInt(importBookNumber, 10),
          }),
        });
        
        sseRef.current = sse;

        sse.addEventListener('message', (event) => {
          if (!event.data || event.data === '[DONE]') {
            sse.close();
            sseRef.current = null;
            resolve();
            return;
          }

          try {
            const data = JSON.parse(event.data);
            console.log('[导入课程] SSE 消息:', data);

            if (data.type === 'progress') {
              setImportProgress(data.message);
              if (data.percent !== undefined) {
                setUploadProgress(data.percent);
              }
            } else if (data.type === 'complete') {
              setImportProgress(data.message);
              setUploadProgress(100);
              Alert.alert('导入成功', data.message, [
                { text: '知道了', onPress: () => {
                  setShowImportModal(false);
                  fetchCourses();
                }}
              ]);
            } else if (data.type === 'error') {
              sse.close();
              sseRef.current = null;
              reject(new Error(data.message));
            }
          } catch (e) {
            console.error('[导入课程] 解析 SSE 消息失败:', e);
          }
        });

        sse.addEventListener('error', (event) => {
          console.error('[导入课程] SSE 错误:', event);
          sse.close();
          sseRef.current = null;
          reject(new Error('导入过程发生错误'));
        });
      });

    } catch (error: any) {
      console.error('[导入课程] 失败:', error);
      if (error.message !== '已取消') {
        Alert.alert('导入失败', error.message || '请稍后重试');
      }
    } finally {
      setImporting(false);
      setImportPhase('idle');
      setUploadProgress(0);
      setImportProgress('');
      xhrRef.current = null;
      sseRef.current = null;
    }
  }, [importBookTitle, importBookNumber, fetchCourses]);

  // 取消上传或导入
  const handleCancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

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
          <View style={styles.headerRow}>
            <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
              精品课程
            </ThemedText>
            <TouchableOpacity 
              style={styles.importButton}
              onPress={() => setShowImportModal(true)}
            >
              <FontAwesome6 name="file-import" size={16} color={theme.buttonPrimaryText} />
              <ThemedText variant="small" color={theme.buttonPrimaryText} style={{ marginLeft: 4 }}>
                导入
              </ThemedText>
            </TouchableOpacity>
          </View>
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
                    {course.total_sentences || course.total_lessons * 18}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
                    句子数
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

      {/* 导入弹窗 */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => !importing && setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              导入课程
            </ThemedText>
            
            <ThemedText variant="body" color={theme.textSecondary} style={{ marginBottom: 16 }}>
              上传 PDF 文件导入课程内容。如果课程已存在，将覆盖原有数据。
            </ThemedText>

            {/* 上传进度显示 */}
            {importing ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText variant="body" color={theme.textPrimary} style={{ marginLeft: 8 }}>
                    {importPhase === 'uploading' ? `上传中 ${uploadProgress}%` : '正在导入...'}
                  </ThemedText>
                </View>
                
                {importPhase === 'uploading' && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${uploadProgress}%`, backgroundColor: theme.primary }]} />
                  </View>
                )}
                
                {importPhase === 'importing' && (
                  <>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${uploadProgress}%`, backgroundColor: theme.primary }]} />
                    </View>
                    <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 8 }}>
                      {importProgress || '正在解析 PDF 并导入课程数据...'}
                    </ThemedText>
                  </>
                )}

                <TouchableOpacity 
                  style={styles.cancelUploadButton}
                  onPress={handleCancelUpload}
                >
                  <ThemedText variant="small" color={theme.error}>取消上传</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.importOption}
                onPress={handlePickPdf}
              >
                <View style={styles.importOptionIcon}>
                  <FontAwesome6 name="file-pdf" size={24} color={theme.error} />
                </View>
                <View style={styles.importOptionContent}>
                  <ThemedText variant="body" color={theme.textPrimary}>
                    选择 PDF 文件
                  </ThemedText>
                  <ThemedText variant="small" color={theme.textMuted}>
                    支持新概念英语格式
                  </ThemedText>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => !importing && setShowImportModal(false)}
                disabled={importing}
              >
                <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
