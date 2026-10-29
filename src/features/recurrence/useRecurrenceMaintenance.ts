import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector, useToday } from '@/app/hooks';
import { commitChanges } from '@/data/actions';
import { selectActiveRole, selectList } from '@/store/selectors';
import { can } from '@/lib/permissions';
import { nowIso } from '@/lib/ids';
import { missingBillOccurrences } from '@/features/finance/logic/bills';
import type { BillOccurrence } from '@/types/models';

/**
 * Materialises upcoming occurrences of recurring bills for the active household. Occurrence ids
 * are deterministic, so running this repeatedly (or in several tabs) never creates duplicates.
 */
export function useRecurrenceMaintenance() {
  const dispatch = useAppDispatch();
  const today = useToday();
  const status = useAppSelector((state) => state.session.householdStatus);
  const role = useAppSelector(selectActiveRole);
  const bills = useAppSelector(selectList('bills'));
  const occurrences = useAppSelector(selectList('billOccurrences'));
  const running = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || !can(role, 'edit') || running.current) return;
    const existing = new Set(occurrences.map((occurrence) => occurrence.id));
    const now = nowIso();
    const missing: BillOccurrence[] = bills.flatMap((bill) => missingBillOccurrences(bill, existing, today, now));
    if (missing.length === 0) return;
    running.current = true;
    dispatch(commitChanges({ put: { billOccurrences: missing } }))
      .catch(() => {
        // Generation is retried on the next change; failures are not user-facing.
      })
      .finally(() => {
        running.current = false;
      });
  }, [bills, occurrences, today, status, role, dispatch]);
}
