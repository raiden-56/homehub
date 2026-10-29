import { StatusChip } from '@/components/ui/StatusChip';
import type { ExpenseSource } from '@/types/models';

export const EXPENSE_SOURCE_LABELS: Record<ExpenseSource, string> = {
  manual: 'Manual',
  shopping: 'Shopping',
  bill: 'Bill',
  maintenance: 'Maintenance',
};

export function ExpenseSourceChip({ source }: { source: ExpenseSource }) {
  return <StatusChip tone={source === 'manual' ? 'neutral' : 'primary'} label={EXPENSE_SOURCE_LABELS[source]} />;
}
