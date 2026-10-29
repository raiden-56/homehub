import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { formatDate, relativeDay } from '@/lib/dates';
import type { Bill, BillOccurrence } from '@/types/models';
import { BILL_STATUS_LABELS, type BillStatus } from '../logic/bills';
import { CategoryIcon } from './CategoryIcon';

export const BILL_STATUS_TONES: Record<BillStatus, StatusTone> = {
  overdue: 'danger',
  'due-soon': 'warning',
  upcoming: 'neutral',
  paid: 'success',
  cancelled: 'neutral',
};

export function BillStatusChip({ status }: { status: BillStatus }) {
  const icon =
    status === 'paid' ? <CheckCircle2 /> : status === 'overdue' ? <AlertCircle /> : status === 'cancelled' ? <XCircle /> : <Clock />;
  return <StatusChip tone={BILL_STATUS_TONES[status]} label={BILL_STATUS_LABELS[status]} icon={icon} />;
}

interface BillRowProps {
  occurrence: BillOccurrence;
  bill: Bill;
  status: BillStatus;
  today: string;
  onOpen: () => void;
  onMarkPaid?: () => void;
}

/** One bill occurrence: category, name, due date, amount, status and a quick "Mark paid". */
export function BillRow({ occurrence, bill, status, today, onOpen, onMarkPaid }: BillRowProps) {
  const dateLabel =
    status === 'paid' && occurrence.paidAt
      ? `Paid ${formatDate(occurrence.paidAt, 'd MMM')}`
      : status === 'cancelled'
        ? `Was due ${formatDate(occurrence.dueDate, 'd MMM')}`
        : `Due ${relativeDay(occurrence.dueDate, today).toLowerCase()} · ${formatDate(occurrence.dueDate, 'EEE d MMM')}`;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
    >
      <ButtonBase
        onClick={onOpen}
        aria-label={`${bill.name}, ${BILL_STATUS_LABELS[status]}, ${dateLabel}`}
        sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 2, gap: 1.5, py: 0.5 }}
      >
        <CategoryIcon category={bill.category} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {bill.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" noWrap>
            {bill.category} · {dateLabel}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>
            <Money minor={status === 'paid' ? (occurrence.paidAmountMinor ?? occurrence.amountMinor) : occurrence.amountMinor} />
          </Typography>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 0.25 }}>
            <BillStatusChip status={status} />
          </Box>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block' }, width: 112, flexShrink: 0 }}>
          <BillStatusChip status={status} />
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}>
          <MemberAvatar userId={status === 'paid' ? (occurrence.paidBy ?? bill.payerId) : bill.payerId} emptyLabel="No payer set" />
        </Box>
      </ButtonBase>
      {onMarkPaid && (
        <Button size="small" variant="outlined" onClick={onMarkPaid} sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}>
          Mark paid
        </Button>
      )}
    </Stack>
  );
}
