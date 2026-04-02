import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
    },
    headerControls: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    smallControlBtn: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    smallControlBtnActive: {
      backgroundColor: theme.primary + '15',
    },
    voiceBtnActive: {
      backgroundColor: theme.error,
    },
    
    // Progress
    progressContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
      // 添加外发光效果
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    progressFillContainer: {
      height: '100%',
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressGradient: {
      flex: 1,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressShimmer: {
      position: 'absolute',
      top: -2,
      bottom: -2,
      left: 0,
      width: 60,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      // 光带渐变效果
      shadowColor: '#ffffff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 10,
    },
    progressGlow: {
      position: 'absolute',
      top: -1,
      bottom: -1,
      left: 0,
      borderRadius: BorderRadius.full,
      // 发光边框效果
      shadowColor: '#764ba2',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    
    // 每句答对的短情绪价值 - 内联显示在句子下方
    sentencePraiseInline: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
    },
    
    // Audio Settings Panel (弹出面板)
    audioSettingsPanel: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: theme.backgroundDefault,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    settingIcon: {
      width: 20,
    },
    settingLabel: {
      width: 35,
      textAlign: 'center',
    },
    sliderContainer: {
      flex: 1,
      height: 24,
      position: 'relative',
      justifyContent: 'center',
    },
    sliderTrack: {
      height: 4,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.full,
      overflow: 'visible',
    },
    sliderFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.full,
    },
    sliderThumb: {
      position: 'absolute',
      top: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.primary,
      marginLeft: -6,
    },
    sliderTouchArea: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
    },
    sliderTouchPoint: {
      flex: 1,
      height: '100%',
    },
    currentSpeedBadge: {
      minWidth: 40,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Content wrapper - 键盘避让
    contentWrapper: {
      flex: 1,
    },
    
    // Main Content - 包含句子和输入框
    mainContent: {
      flex: 1,
    },
    
    // Sentence Section - 可滚动
    sentenceSection: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    sentenceScrollContent: {
      paddingVertical: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    
    // Sentence Card
    sentenceCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    wordContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    wordWrapper: {
      marginBottom: Spacing.xs,
    },
    wordBox: {
      flexDirection: 'column',
      alignItems: 'center',
    },
    wordRow: {
      flexDirection: 'row',
    },
    translationText: {
      fontSize: 10,
      lineHeight: 12,
    },
    char: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    hiddenChar: {
      opacity: 0.35,
    },
    errorChar: {
      // 错误字符由 color 控制，无需额外样式
    },
    // 单词信息容器（音标和中文意思）
    wordInfoContainer: {
      alignItems: 'center',
      marginTop: 2,
      minWidth: 40,
    },
    phoneticText: {
      fontSize: 11,
      lineHeight: 14,
      fontStyle: 'italic',
    },
    meaningText: {
      fontSize: 11,
      lineHeight: 14,
      textAlign: 'center',
    },
    
    // Input Section - 紧跟句子区域
    inputSection: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.xs,
    },
    inputWrapper: {
      width: '100%',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      width: '100%',
      backgroundColor: '#E8F5E9',
      borderRadius: BorderRadius.xl,
      borderWidth: 2,
      borderColor: '#A5D6A7',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      fontSize: 22,
      color: '#4CAF50', // 绿色文字
      fontWeight: '600',
      textAlign: 'center',
      includeFontPadding: false, // Android
      textAlignVertical: 'center', // Android
    },
    // Web端专用麦克风按钮
    webMicButton: {
      position: 'absolute',
      right: Spacing.md,
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.border,
    },
    webMicButtonActive: {
      backgroundColor: theme.error,
      borderColor: theme.error,
    },
    // 自建键盘模式的麦克风按钮（稍小）
    webMicButtonCustom: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.border,
      marginLeft: Spacing.sm,
    },
    
    // Navigation Buttons - 紧跟输入框
    navButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing['2xl'],
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundRoot,
    },
    navBtn: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navBtnDisabled: {
      backgroundColor: theme.backgroundTertiary,
    },
    
    // Translation Card
    translationCard: {
      backgroundColor: theme.primary + '10',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: theme.primary + '30',
    },
    
    // Navigation Buttons below text
    textNavButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    textNavBtn: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Recording Overlay - 录音时的大麦克风遮罩
    recordingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    recordingMicContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Custom Keyboard
    customKeyboardContainer: {
      width: '100%',
      marginBottom: Spacing.sm, // 稍微离底部高一点
    },
    customInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    customInputDisplay: {
      flex: 1,
      backgroundColor: '#E8F5E9',
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: '#A5D6A7',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    navBtnSmall: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    customKeyboard: {
      flexDirection: 'row',
      backgroundColor: '#D1D5DB',
      borderRadius: BorderRadius.lg,
      padding: 8,
      gap: 6,
      height: 260,
    },
    keyboardColumn: {
      flexDirection: 'column',
      gap: 6,
      justifyContent: 'space-between',
    },
    keyboardLetterSection: {
      flex: 1,
      flexDirection: 'column',
      gap: 6,
      justifyContent: 'space-between',
    },
    keyboardRow: {
      flexDirection: 'row',
      gap: 6,
      flex: 1,
    },
    keyButton: {
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1,
    },
    symbolKey: {
      width: 54,
      backgroundColor: '#9CA3AF',
    },
    letterKey: {
      backgroundColor: '#FFFFFF',
    },
    functionKey: {
      width: 54,
      backgroundColor: '#9CA3AF',
    },
    numberKey: {
      backgroundColor: '#FFFFFF',
      flex: 1,
    },
    numberKeyActive: {
      backgroundColor: theme.backgroundTertiary,
    },
    numberPanel: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    // 语音识别结果卡片
    voiceResultCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.error + '30',
    },
    voiceResultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    wordMatchContainer: {
      marginTop: Spacing.xs,
    },
    wordMatchWords: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    unmatchedWordBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    unmatchedWordBlock: {
      width: 40,
      height: 24,
      borderRadius: BorderRadius.md,
    },
    unmatchedWordText: {
      backgroundColor: theme.error + '20',
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.xs,
    },
    voiceResultBtn: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 单词重读提示
    voiceTargetHint: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '10',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    
    // 完美发音列表
    perfectRecordingsOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
    },
    perfectRecordingsBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    perfectRecordingsPanel: {
      position: 'absolute',
      top: 80,
      right: Spacing.lg,
      width: 300,
      maxHeight: 450,
      borderRadius: BorderRadius.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    perfectRecordingsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderBottomWidth: 1,
    },
    perfectRecordingsTabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
    },
    perfectRecordingsTab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    perfectRecordingsTabActive: {
      borderBottomWidth: 2,
    },
    perfectRecordingsList: {
      maxHeight: 350,
    },
    perfectRecordingItem: {
      padding: Spacing.md,
      borderBottomWidth: 1,
    },
    perfectRecordingItemFavorite: {
      backgroundColor: 'rgba(255, 215, 0, 0.1)',
    },
    perfectRecordingHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    perfectRecordingInfo: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    perfectRecordingActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    actionBtnSmall: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    favoriteBtn: {
      backgroundColor: 'rgba(255, 215, 0, 0.2)',
    },
    favoriteBtnActive: {
      backgroundColor: '#FFD700',
    },
    shareBtn: {
      backgroundColor: 'rgba(79, 70, 229, 0.15)',
    },
    shareBtnActive: {
      backgroundColor: '#4F46E5',
    },
    playBtn: {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
    },
    deleteBtn: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    perfectRecordingMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      gap: Spacing.md,
    },
    playPerfectBtn: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deletePerfectBtn: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyPerfectRecordings: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing['2xl'],
    },
    // 公开分享发音的用户信息
    sharedUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
  });
};
