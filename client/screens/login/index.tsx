import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, TextInput, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { createStyles } from './styles';

export default function LoginScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { sendCode, loginWithCode, guestLogin, isLoading: authLoading } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setLoading(true);
    setError('');
    
    const result = await sendCode(phone);
    
    if (result.success) {
      setCodeSent(true);
      setCountdown(60);
      // 开发环境，自动填充验证码
      if (result.code) {
        setCode(result.code);
      } else {
        // 如果后端没有返回验证码，使用开发环境的固定验证码
        setCode('123456');
      }
    } else {
      setError(result.error || '发送失败');
    }
    
    setLoading(false);
  };

  // 验证码登录
  const handleLogin = async () => {
    if (!codeSent) {
      setError('请先点击「获取验证码」按钮');
      return;
    }
    
    if (!code || code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setLoading(true);
    setError('');
    
    const result = await loginWithCode(phone, code);
    
    if (!result.success) {
      setError(result.error || '登录失败');
    }
    
    setLoading(false);
  };

  // 游客登录
  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    
    const result = await guestLogin();
    
    if (!result.success) {
      setError(result.error || '游客登录失败');
    }
    
    setLoading(false);
  };

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <View style={styles.container}>
        {/* 标题 */}
        <View style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary}>欢迎来到AI听写云</ThemedText>
          <ThemedText variant="body" color={theme.textSecondary} style={styles.subtitle}>
            登录后可同步学习进度
          </ThemedText>
        </View>

        {/* 开发环境提示 */}
        <View style={styles.devTip}>
          <Text style={styles.devTipText}>开发模式：输入手机号后点击「获取验证码」，验证码自动填充为 123456</Text>
        </View>

        {/* 手机号输入 */}
        <View style={styles.inputGroup}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>手机号</ThemedText>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="请输入手机号"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            maxLength={11}
            editable={!loading}
          />
        </View>

        {/* 验证码输入 */}
        <View style={styles.inputGroup}>
          <ThemedText variant="smallMedium" color={theme.textSecondary}>验证码</ThemedText>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={setCode}
              placeholder="请输入验证码"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.codeBtn, (countdown > 0 || loading) && styles.codeBtnDisabled]}
              onPress={handleSendCode}
              disabled={countdown > 0 || loading}
            >
              {loading && !codeSent ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={styles.codeBtnText}>
                  {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 错误提示 */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {/* 登录按钮 */}
        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
          ) : (
            <Text style={styles.loginBtnText}>登录</Text>
          )}
        </TouchableOpacity>

        {/* 游客登录 */}
        <TouchableOpacity
          style={styles.guestBtn}
          onPress={handleGuestLogin}
          disabled={loading}
        >
          <Text style={styles.guestBtnText}>游客模式进入</Text>
        </TouchableOpacity>

        {/* 协议 */}
        <Text style={styles.agreement}>
          登录即代表同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </Screen>
  );
}
