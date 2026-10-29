import { useState } from 'react';
import { Box, Button, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { Ban, CheckCircle2, MoreVertical, Pause, Pencil, Play, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCan, useRecord, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatDate, relativeDay } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { LinkedDocuments } from '@/features/documents/components/LinkedDocuments';
import { billStatus } from '../logic/bills';
import { useBillLeadDays } from '../hooks';
import { BillStatusChip } from '../components/BillRow';
import { MarkBillPaidDialog } from '../components/MarkBillPaidDialog';
import { OccurrenceDialog } from '../components/OccurrenceDialog';
import { BillDialog } from '../components/BillDialog';
import { useBillActions } from '../useBillActions';

/** Detail panel for one bill occurrence at `/finance/bills/:occurrenceId`. */
export function BillOccurrenceDrawer() {
  const { occurrenceId } = useParams();
  const occurrence = useRecord('billOccurrences', occurrenceId);
  const bill = useRecord('bills', occurrence?.billId);
  const expense = useRecord('expenses', occurrence?.expenseId);
  const today = useToday();
  const leadDays = useBillLeadDays();
  const canEdit = useCan('edit');
  const navigate = useNavigate();
  const location = useLocation();
  const actions = useBillActions();
  const [dialog, setDialog] = useState<'pay' | 'occurrence' | 'series' | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const close = () => navigate({ pathname: paths.bills(), search: location.search });

  if (!occurrence || !bill) {
    return (
      <DetailDrawer open onClose={close} title="Bill not found">
        <ErrorState kind="not-found" action={<Button onClick={close}>Back to bills</Button>} />
      </DetailDrawer>
    );
  }

  const status = billStatus(occurrence, today, leadDays);
  const isOpen = occurrence.state === 'open';

  return (
    <>
      <DetailDrawer
        open
        onClose={close}
        title={bill.name}
        subtitle={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            <BillStatusChip status={status} />
            <span>{bill.category}</span>
          </Stack>
        }
        actions={
          canEdit ? (
            <IconButton aria-label="More bill actions" onClick={(event) => setMenuAnchor(event.currentTarget)}>
              <MoreVertical size={18} />
            </IconButton>
          ) : undefined
        }
      >
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {occurrence.state === 'paid' ? 'Amount paid' : 'Amount due'}
          </Typography>
          <Typography variant="h1" component="p">
            <Money minor={occurrence.state === 'paid' ? (occurrence.paidAmountMinor ?? occurrence.amountMinor) : occurrence.amountMinor} />
          </Typography>
        </Box>

        {canEdit && (
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
            {occurrence.state !== 'paid' && (
              <Button variant="contained" startIcon={<CheckCircle2 size={16} />} onClick={() => setDialog('pay')}>
                Mark as paid
              </Button>
            )}
            {occurrence.state === 'paid' && (
              <Button variant="outlined" startIcon={<Undo2 size={16} />} onClick={() => actions.undoPayment(occurrence, bill)}>
                Undo payment
              </Button>
            )}
            {isOpen && (
              <Button variant="outlined" startIcon={<Pencil size={16} />} onClick={() => setDialog('occurrence')}>
                Edit this bill
              </Button>
            )}
          </Stack>
        )}

        <DetailRow label="Due date">
          {formatDate(occurrence.dueDate, 'EEEE, d MMM yyyy')}
          {isOpen && (
            <Typography variant="caption" color="text.secondary" component="span">
              {' '}
              ({relativeDay(occurrence.dueDate, today).toLowerCase()})
            </Typography>
          )}
        </DetailRow>
        {occurrence.dueDate !== occurrence.originalDate && (
          <DetailRow label="Originally due">{formatDate(occurrence.originalDate)}</DetailRow>
        )}
        <DetailRow label="Schedule">{describeRecurrence(bill.recurrence)}{!bill.active && ' · stopped'}</DetailRow>
        <DetailRow label="Usually paid by">
          <MemberAvatar userId={bill.payerId} withName size={22} emptyLabel="Not set" />
        </DetailRow>
        {occurrence.state === 'paid' && (
          <>
            <DetailRow label="Paid on">{occurrence.paidAt ? formatDate(occurrence.paidAt) : '—'}</DetailRow>
            <DetailRow label="Paid by">
              <MemberAvatar userId={occurrence.paidBy} withName size={22} emptyLabel="Not recorded" />
            </DetailRow>
            <DetailRow label="Expense">
              {expense ? (
                <Button component={RouterLink} to={paths.expense(expense.id)} size="small" sx={{ px: 0, minHeight: 0 }}>
                  View recorded expense
                </Button>
              ) : (
                'Not recorded as an expense'
              )}
            </DetailRow>
          </>
        )}
        {occurrence.notes && <DetailRow label="Notes (this bill)">{occurrence.notes}</DetailRow>}
        {bill.notes && <DetailRow label="Notes (series)">{bill.notes}</DetailRow>}

        <Divider sx={{ my: 2.5 }} />
        <LinkedDocuments link={{ type: 'bill', id: bill.id }} title="Bill documents" />
      </DetailDrawer>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDialog('series');
          }}
        >
          <ListItemIcon>
            <Pencil size={16} />
          </ListItemIcon>
          <ListItemText primary={bill.recurrence ? 'Edit whole series' : 'Edit bill'} />
        </MenuItem>
        {occurrence.state !== 'paid' && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              void actions.setOccurrenceState(occurrence, bill, isOpen ? 'cancelled' : 'open');
            }}
          >
            <ListItemIcon>{isOpen ? <Ban size={16} /> : <RotateCcw size={16} />}</ListItemIcon>
            <ListItemText primary={isOpen ? 'Cancel this bill' : 'Restore this bill'} secondary={isOpen ? 'Skips only this occurrence' : undefined} />
          </MenuItem>
        )}
        {bill.recurrence && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              void actions.setSeriesActive(bill, !bill.active);
            }}
          >
            <ListItemIcon>{bill.active ? <Pause size={16} /> : <Play size={16} />}</ListItemIcon>
            <ListItemText primary={bill.active ? 'Stop series' : 'Resume series'} />
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={async () => {
            setMenuAnchor(null);
            if (await actions.deleteBill(bill)) close();
          }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          <ListItemText primary="Delete bill" />
        </MenuItem>
      </Menu>

      {dialog === 'pay' && <MarkBillPaidDialog open occurrence={occurrence} onClose={() => setDialog(null)} />}
      {dialog === 'occurrence' && (
        <OccurrenceDialog open occurrence={occurrence} billName={bill.name} onClose={() => setDialog(null)} />
      )}
      {dialog === 'series' && <BillDialog open bill={bill} onClose={() => setDialog(null)} />}
    </>
  );
}
