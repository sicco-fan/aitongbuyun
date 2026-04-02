import { Spacing } from '@/constants/theme';
import { Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center' as const,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginBottom: Spacing.lg,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: Spacing.md,
  },
  appName: {
    marginBottom: Spacing.xs,
  },
  description: {
    lineHeight: 24,
    textAlign: 'center' as const,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontWeight: '600' as const,
    marginBottom: Spacing.md,
  },
  featureList: {
    paddingLeft: Spacing.sm,
  },
  featureItem: {
    lineHeight: 24,
    marginBottom: Spacing.xs,
  },
  contactItem: {
    paddingVertical: Spacing.sm,
  },
  linkList: {
    flexDirection: 'row' as const,
    gap: Spacing.lg,
  },
  linkItem: {
    paddingVertical: Spacing.sm,
  },
  footer: {
    position: 'absolute' as const,
    bottom: Spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
  },
});
