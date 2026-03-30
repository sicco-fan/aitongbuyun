import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  TextInput,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import DraggableFlatList, {
  DragEndParams,
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
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
import { getLastLearningPosition, LastLearningPosition } from '@/utils/learningStorage';
import { Spacing, BorderRadius } from '@/constants/theme';

interface Course {
  id: number;
  title: string;
  book_number: number;
  description: string;
  total_lessons: number;
  total_sentences?: number;
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importProgress, setImportProgress] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [importBookTitle, setImportBookTitle] = useState('');
  const [importBookNumber, setImportBookNumber] = useState('');
  const [lastLearningPosition, setLastLearningPosition] = useState<LastLearningPosition | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const sseRef = useRef<any>(null);
  const [hasShownDragTip, setHasShownDragTip] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const lastPosition = await getLastLearningPosition();
      setLastLearningPosition(lastPosition);
      
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

  // 保存排序
  const saveReorder = useCallback(async (newCourses: Course[]) => {
    try {
      const orders = newCourses.map((course, index) => ({
        id: course.id,
        book_number: index + 1,
      }));

      /**
       * 服务端文件：server/src/routes/courses.ts
       * 接口：PUT /api/v1/courses/reorder
       * Body 参数：orders: Array<{ id: number; book_number: number }>
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });

      const data = await response.json();
      if (data.success) {
        console.log('[排序] 保存成功');
      }
    } catch (error) {
      console.error('[排序] 保存失败:', error);
    }
  }, []);

  // 拖拽结束处理
  const handleDragEnd = useCallback((params: DragEndParams<Course>) => {
    const { from, to, data } = params;
    
    if (from !== to) {
      setCourses(data);
      saveReorder(data);
    }
  }, [saveReorder]);

  const handlePickFile = useCallback(async (fileType: 'pdf' | 'word' | 'txt') => {
    if (!importBookTitle.trim()) {
      Alert.alert('提示', '请输入课程名称');
      return;
    }
    if (!importBookNumber.trim()) {
      Alert.alert('提示', '请输入课程编号');
      return;
    }

    const bookNum = parseInt(importBookNumber, 10);
    if (isNaN(bookNum) || bookNum < 1) {
      Alert.alert('提示', '课程编号必须是大于0的数字');
      return;
    }

    try {
      const mimeTypes = {
        pdf: 'application/pdf',
        word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes[fileType],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      console.log('[导入课程] 选择的文件:', file.name, file.uri);

      setImporting(true);
      setImportPhase('uploading');
      setUploadProgress(0);

      const formData = new FormData();
      const fileData = await createFormDataFile(file.uri, file.name, mimeTypes[fileType]);
      formData.append('file', fileData as any);

      const uploadUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/upload`;
      const uploadData = await new Promise<{ url?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
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

      setImportPhase('importing');
      setImportProgress('正在初始化导入...');

      const sseUrl = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/import-text`;
      
      await new Promise<void>((resolve, reject) => {
        const sse = new RNSSE(sseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            file_url: uploadData.url,
            file_type: fileType,
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

  // 显示拖拽提示
  const showDragTip = useCallback(() => {
    if (hasShownDragTip) return;
    setHasShownDragTip(true);
    Alert.alert(
      '排序提示',
      '长按课程卡片可以拖动调整顺序',
      [{ text: '知道了' }]
    );
  }, [hasShownDragTip]);

  const getBookIcon = useCallback((bookNumber: number): string => {
    const icons: Record<number, string> = {
      1: 'book-open',
      2: 'book',
      3: 'graduation-cap',
      4: 'award',
    };
    return icons[bookNumber] || 'book';
  }, []);

  // 渲染单个课程卡片
  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Course>) => {
    const isLastLearned = lastLearningPosition?.sourceType === 'lesson' && 
                          lastLearningPosition.courseId === item.id;

    return (
      <ScaleDecorator>
        <Pressable
          style={({ pressed }) => [
            styles.courseCard,
            isLastLearned && styles.lastLearnedCard,
            isActive && styles.draggingItem,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => handleCoursePress(item.id)}
          onLongPress={drag}
          delayLongPress={300}
        >
          {/* 上次学习提示 */}
          {isLastLearned && (
            <View style={[styles.lastLearnedBadge, { backgroundColor: theme.success + '20' }]}>
              <FontAwesome6 name="clock-rotate-left" size={10} color={theme.success} />
              <ThemedText variant="tiny" color={theme.success} style={{ marginLeft: 2 }}>
                第{lastLearningPosition?.lessonNumber}课
              </ThemedText>
            </View>
          )}
          
          <View style={styles.courseHeader}>
            <View style={styles.courseIcon}>
              <FontAwesome6
                name={getBookIcon(item.book_number)}
                size={18}
                color={theme.primary}
              />
            </View>
            <View style={styles.courseInfo}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.courseTitle}>
                {item.title}
              </ThemedText>
              <ThemedText variant="tiny" color={theme.textMuted} style={styles.courseMeta}>
                {item.total_lessons}课 · {item.total_sentences || item.total_lessons * 18}句
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.courseStats}>
            <FontAwesome6 name="grip-vertical" size={14} color={theme.textMuted} />
            <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
          </View>
        </Pressable>
      </ScaleDecorator>
    );
  }, [lastLearningPosition, handleCoursePress, getBookIcon, styles, theme]);

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
      <View style={styles.container}>
        {/* 头部 */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
                精品课程
              </ThemedText>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => setShowInfoModal(true)}
              >
                <FontAwesome6 name="circle-info" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
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
          {courses.length > 1 && (
            <TouchableOpacity onPress={showDragTip} style={{ marginTop: 8 }}>
              <ThemedText variant="tiny" color={theme.textMuted}>
                💡 长按课程卡片可拖动排序
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* 课程列表 */}
        {courses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="book-open" size={48} color={theme.textMuted} />
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyText}>
              暂无课程
            </ThemedText>
          </View>
        ) : (
          <DraggableFlatList
            data={courses}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            onDragEnd={handleDragEnd}
            activationDistance={10}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.primary}
              />
            }
          />
        )}
      </View>

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
              支持 PDF、Word(.docx)、TXT 三种格式导入课程。如果课程已存在，将覆盖原有数据。
            </ThemedText>

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
                      {importProgress || '正在解析文件并导入课程数据...'}
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
              <>
                <View style={{ marginBottom: 20 }}>
                  <ThemedText variant="smallMedium" color={theme.textSecondary} style={{ marginBottom: 8 }}>
                    课程名称 <ThemedText color={theme.error}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
                    value={importBookTitle}
                    onChangeText={setImportBookTitle}
                    placeholder="例如：新概念英语第三册"
                    placeholderTextColor={theme.textMuted}
                    maxLength={50}
                  />
                </View>

                <View style={{ marginBottom: 20 }}>
                  <ThemedText variant="smallMedium" color={theme.textSecondary} style={{ marginBottom: 8 }}>
                    课程编号 <ThemedText color={theme.error}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: theme.backgroundTertiary, color: theme.textPrimary }]}
                    value={importBookNumber}
                    onChangeText={setImportBookNumber}
                    placeholder="输入唯一编号（如：3）"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <ThemedText variant="tiny" color={theme.textMuted} style={{ marginTop: 4 }}>
                    编号用于区分不同课程，相同编号会覆盖已有课程
                  </ThemedText>
                </View>

                <TouchableOpacity 
                  style={styles.importOption}
                  onPress={() => handlePickFile('pdf')}
                >
                  <View style={[styles.importOptionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <FontAwesome6 name="file-pdf" size={24} color="#EF4444" />
                  </View>
                  <View style={styles.importOptionContent}>
                    <ThemedText variant="body" color={theme.textPrimary}>
                      PDF 文件
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>
                      支持新概念英语格式
                    </ThemedText>
                  </View>
                  <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.importOption, { marginTop: 12 }]}
                  onPress={() => handlePickFile('word')}
                >
                  <View style={[styles.importOptionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <FontAwesome6 name="file-word" size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.importOptionContent}>
                    <ThemedText variant="body" color={theme.textPrimary}>
                      Word 文档 (.docx)
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>
                      自动提取文本内容
                    </ThemedText>
                  </View>
                  <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.importOption, { marginTop: 12 }]}
                  onPress={() => handlePickFile('txt')}
                >
                  <View style={[styles.importOptionIcon, { backgroundColor: 'rgba(107, 114, 128, 0.1)' }]}>
                    <FontAwesome6 name="file-lines" size={24} color="#6B7280" />
                  </View>
                  <View style={styles.importOptionContent}>
                    <ThemedText variant="body" color={theme.textPrimary}>
                      纯文本文件 (.txt)
                    </ThemedText>
                    <ThemedText variant="small" color={theme.textMuted}>
                      UTF-8 编码格式
                    </ThemedText>
                  </View>
                  <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </>
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

      {/* 功能说明弹窗 */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContent}>
            <View style={styles.infoModalHeader}>
              <ThemedText variant="h4" color={theme.textPrimary}>
                关于精品课程
              </ThemedText>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <FontAwesome6 name="times" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoModalBody}>
              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  📚 什么是精品课程？
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  精品课程是系统化的英语听力学习内容，每个课程包含多个课时，每个课时包含多个句子。适合循序渐进地提升英语听力能力。
                </ThemedText>
              </View>

              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  🔀 拖动排序
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  长按课程卡片可以拖动调整顺序，释放后自动保存新的排序。
                </ThemedText>
              </View>

              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  📥 关于"导入"功能
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  点击右上角的「导入」按钮，上传文档文件即可自动创建课程。系统会提取文本内容、划分课时和句子，并为每个句子生成 AI 语音。
                </ThemedText>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.infoModalCloseBtn}
              onPress={() => setShowInfoModal(false)}
            >
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>知道了</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const dragStyles = StyleSheet.create({
  itemContainer: {
    marginBottom: Spacing.md,
  },
});
