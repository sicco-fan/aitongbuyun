import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export interface Task {
  id: number;
  user_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total: number;
  completed_count: number;
  resource_id: number | null;
  resource_title: string | null;
  result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskContextType {
  activeTasks: Task[];
  createTask: (userId: string, taskType: string, resourceId?: number, resourceTitle?: string) => Promise<Task | null>;
  fetchTask: (userId: string, taskId: number) => Promise<Task | null>;
  fetchActiveTasks: (userId: string) => Promise<void>;
  cancelTask: (userId: string, taskId: number) => Promise<boolean>;
  startPolling: (userId: string) => void;
  stopPolling: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  /**
   * 创建后台任务
   */
  const createTask = useCallback(async (
    userId: string, 
    taskType: string, 
    resourceId?: number, 
    resourceTitle?: string
  ): Promise<Task | null> => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          task_type: taskType,
          resource_id: resourceId,
          resource_title: resourceTitle,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.task) {
        // 如果有相同资源的进行中任务，直接返回
        if (data.message) {
          // 查找并更新本地状态
          setActiveTasks(prev => {
            const exists = prev.some(t => t.id === data.task.id);
            if (!exists && data.task.status !== 'completed' && data.task.status !== 'failed') {
              return [...prev, data.task];
            }
            return prev;
          });
        } else {
          // 新任务，添加到列表
          setActiveTasks(prev => [...prev, data.task]);
        }
        return data.task;
      }
      
      return null;
    } catch (error) {
      console.error('创建任务失败:', error);
      return null;
    }
  }, []);

  /**
   * 查询单个任务状态
   */
  const fetchTask = useCallback(async (userId: string, taskId: number): Promise<Task | null> => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tasks/${taskId}?user_id=${userId}`
      );
      const data = await response.json();
      return data.success ? data.task : null;
    } catch (error) {
      console.error('查询任务失败:', error);
      return null;
    }
  }, []);

  /**
   * 获取活跃任务列表
   */
  const fetchActiveTasks = useCallback(async (userId: string) => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tasks?user_id=${userId}&status=pending,running&limit=5`
      );
      const data = await response.json();
      
      if (data.success && data.tasks) {
        setActiveTasks(data.tasks);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
    }
  }, []);

  /**
   * 取消任务
   */
  const cancelTask = useCallback(async (userId: string, taskId: number): Promise<boolean> => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tasks/${taskId}?user_id=${userId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      
      if (data.success) {
        setActiveTasks(prev => prev.filter(t => t.id !== taskId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('取消任务失败:', error);
      return false;
    }
  }, []);

  /**
   * 开始轮询任务状态
   */
  const startPolling = useCallback((userId: string) => {
    currentUserIdRef.current = userId;
    
    // 先获取一次
    fetchActiveTasks(userId);
    
    // 清除旧的轮询
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // 每3秒轮询一次
    pollingIntervalRef.current = setInterval(async () => {
      if (activeTasks.length > 0) {
        // 更新所有活跃任务的状态
        const updatedTasks: Task[] = [];
        const completedIds: number[] = [];
        
        for (const task of activeTasks) {
          const updated = await fetchTask(userId, task.id);
          if (updated) {
            if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'cancelled') {
              completedIds.push(updated.id);
            } else {
              updatedTasks.push(updated);
            }
          }
        }
        
        if (completedIds.length > 0) {
          setActiveTasks(prev => prev.filter(t => !completedIds.includes(t.id)));
        }
        
        if (updatedTasks.length > 0) {
          setActiveTasks(prev => {
            const updated = prev.map(t => {
              const found = updatedTasks.find(u => u.id === t.id);
              return found || t;
            });
            return updated;
          });
        }
      } else {
        // 没有活跃任务时，检查是否有新任务
        await fetchActiveTasks(userId);
      }
    }, 3000);
  }, [activeTasks, fetchTask, fetchActiveTasks]);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return (
    <TaskContext.Provider value={{
      activeTasks,
      createTask,
      fetchTask,
      fetchActiveTasks,
      cancelTask,
      startPolling,
      stopPolling,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTask() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
}
