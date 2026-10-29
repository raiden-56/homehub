import { useMemo, useState } from 'react';
import { Box, Button, Link } from '@mui/material';
import { Receipt } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { Money } from '@/components/ui/Money';
import { selectCurrentPreferences } from '@/store/selectors';
import { BILL_STATUS_LABELS, DEFAULT_DUE_SOON_DAYS, billStatus, type BillStatus } from '@/features/finance/logic/bills';
import { MarkBillPaidDialog } from '@/features/finance/components/MarkBillPaidDialog';
import { addDaysISO, daysBetween, relativeDay } from '@/lib/dates';
import { paths } from '@/app/paths';
import type { BillOccurrence } from '@/types/models';
import { WidgetFooterLink, WidgetRow, rowLinkSx } from './WidgetList';

const TONE: Record<BillStatus, StatusTone> = {
  overdue: 'danger',
  'due-soon': 'warning',
  upcoming: 'neutral',
  paid: 'success',
  cancelled: 'neutral',
};

export function BillsWidget() {
  const occurrences = useCollection('billOccurrences');
  const bills = useAppSelector((state) => state.data.bills);
  const leadDays = useAppSelector(selectCurrentPreferences)?.notifications.billLeadDays ?? DEFAULT_DUE_SOON_DAYS;
  const today = useToday();
  const canEdit = useCan('edit');
  const [paying, setPaying] = useState<BillOccurrence | null>(null);

  const rows = useMemo(() => {
    const horizon = addDaysISO(today, 30);
    const open = occurrences
      .filter((occurrence) => occurrence.state === 'open' && occurrence.dueDate <= horizon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const recentlyPaid = occurrences
      .filter((occurrence) => occurrence.state === 'paid' && occurrence.paidAt && daysBetween(occurrence.paidAt, today) <= 5)
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
      .slice(0, 2);
    return { open, list: [...open.slice(0, 5), ...recentlyPaid] };
  }, [occurrences, today]);

  const attention = rows.open.filter((occurrence) => {
    const status = billStatus(occurrence, today, leadDays);
    return status === 'overdue' || status === 'due-soon';
  });

  return (
    <SectionCard
      title="Bills due soon"
      subtitle={attention.length > 0 ? `${attention.length} need attention` : 'Next 30 days'}
      icon={<Receipt size={17} />}
      sx={{ height: '100%' }}
    >
      {rows.list.length === 0 ? (
        <EmptyState compact icon={<Receipt size={20} />} title="No upcoming bills" description="Bills due in the next 30 days will appear here." />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Upcoming bills">
          {rows.list.map((occurrence) => {
            const bill = bills[occurrence.billId];
            const status = billStatus(occurrence, today, leadDays);
            return (
              <Box component="li" key={occurrence.id}>
                <WidgetRow
                  title={
                    <Link component={RouterLink} to={paths.billOccurrence(occurrence.id)} sx={rowLinkSx}>
                      {bill?.name ?? 'Bill'}
                    </Link>
                  }
                  subtitle={
                    status === 'paid'
                      ? `Paid ${relativeDay(occurrence.paidAt!, today).toLowerCase()}`
                      : `${status === 'overdue' ? 'Was due' : 'Due'} ${relativeDay(occurrence.dueDate, today).toLowerCase()}`
                  }
                  trailing={
                    <>
                      <Money minor={status === 'paid' ? (occurrence.paidAmountMinor ?? occurrence.amountMinor) : occurrence.amountMinor} sx={{ fontWeight: 600, fontSize: 14 }} />
                      <StatusChip tone={TONE[status]} label={status === 'upcoming' ? 'Scheduled' : BILL_STATUS_LABELS[status]} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
                      {status !== 'paid' && canEdit && (
                        <Button size="small" variant="outlined" onClick={() => setPaying(occurrence)} aria-label={`Mark ${bill?.name ?? 'bill'} as paid`}>
                          Paid
                        </Button>
                      )}
                    </>
                  }
                />
              </Box>
            );
          })}
        </Box>
      )}
      <WidgetFooterLink to={paths.bills()}>Open bills</WidgetFooterLink>
      {paying && <MarkBillPaidDialog open onClose={() => setPaying(null)} occurrence={paying} />}
    </SectionCard>
  );
}
