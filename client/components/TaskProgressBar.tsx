import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FontAwesome6 } from '@expo/vector-icons';
import { Task, useTask } from '@/contexts/TaskContext';
import { useAuth } from '@/contexts/AuthContext';

interface TaskProgressBarProps {
  courseId: number;
  onComplete?: () => void;
}

export function TaskProgressBar({ courseId, onComplete }: TaskProgressBarProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { activeTasks, cancelTask } = useTask();
  
  // 找到与当前课程相关的任务
  const courseTask = activeTasks.find(
    t => t.resource_id === courseId && t.task_type === 'generate_course_audio'
  );
  
  if (!courseTask) return null;
  
  const handleCancel = async () => {
    if (user?.id && courseTask) {
      await cancelTask(user.id, courseTask.id);
    }
  };
  
  const getStatusText = (task: Task) => {
    switch (task.status) {
      case 'pending':
        return '准备中...';
      case 'running':
        return `正在生成音频 ${task.progress}%`;
      case 'completed':
        return '生成完成';
      case 'failed':
        return '生成失败';
      case 'cancelled':
        return '已取消';
      default:
        return '';
    }
  };
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 1,
    },
    status: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    progressContainer: {
      marginTop: 12,
      height: 6,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 3,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    stats: {
      fontSize: 12,
      color: theme.textMuted,
    },
    cancelButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.error + '15',
    },
    cancelButtonText: {
      fontSize: 13,
      color: theme.error,
    },
    completedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    completedIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {courseTask.resource_title || '课程音频生成'}
        </Text>
        <Text style={styles.status}>{getStatusText(courseTask)}</Text>
      </View>
      
      {courseTask.status === 'running' || courseTask.status === 'pending' ? (
        <>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${courseTask.progress}%` }]} />
          </View>
          <View style={styles.footer}>
            <Text style={styles.stats}>
              {courseTask.completed_count} / {courseTask.total} 句
            </Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : courseTask.status === 'completed' ? (
        <View style={[styles.footer, { justifyContent: 'flex-start' }]}>
          <View style={styles.completedContainer}>
            <View style={styles.completedIcon}>
              <FontAwesome6 name="check" size={12} color="#FFF" />
            </View>
            <Text style={[styles.stats, { color: theme.success }]}>
              音频生成完成
            </Text>
          </View>
        </View>
      ) : courseTask.status === 'failed' ? (
        <Text style={[styles.stats, { color: theme.error, marginTop: 8 }]}>
          {courseTask.error_message || '生成失败，请重试'}
        </Text>
      ) : null}
    </View>
  );
}
