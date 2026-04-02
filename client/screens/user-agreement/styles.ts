import { Spacing } from '@/constants/theme';
import { Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  updateDate: {
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontWeight: '600' as const,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  listItem: {
    lineHeight: 24,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.xs,
  },
});
