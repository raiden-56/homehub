import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { AlertCircle, CalendarClock, CheckCircle2, MoreVertical, Pause, Pencil, Play, Receipt, Trash2 } from 'lucide-react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCan, useCollection, useHouseholdLoading, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { BillListSkeleton, DashboardMetricSkeleton } from '@/components/ui/Skeletons';
import { Money, useFormatMoney } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { addDaysISO, monthKey } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { sumMinor } from '@/lib/money';
import type { Bill, BillOccurrence } from '@/types/models';
import { BILL_STATUS_LABELS, billStatus, monthlyEquivalentMinor, type BillStatus } from '../logic/bills';
import { useBillLeadDays } from '../hooks';
import { BillRow } from '../components/BillRow';
import { CategoryIcon } from '../components/CategoryIcon';
import { BillDialog } from '../components/BillDialog';
import { MarkBillPaidDialog } from '../components/MarkBillPaidDialog';
import { EditButton } from '../components/EditButton';
import { useBillActions } from '../useBillActions';

const STATUS_FILTERS: BillStatus[] = ['overdue', 'due-soon', 'upcoming', 'paid', 'cancelled'];
const UPCOMING_WINDOW_DAYS = 45;
const RECENT_PAID_DAYS = 31;

interface Row {
  occurrence: BillOccurrence;
  bill: Bill;
  status: BillStatus;
}

function isStatus(value: string | null): value is BillStatus {
  return value !== null && (STATUS_FILTERS as string[]).includes(value);
}

export default function BillsPage() {
  const loading = useHouseholdLoading();
  const bills = useCollection('bills');
  const occurrences = useCollection('billOccurrences');
  const today = useToday();
  const leadDays = useBillLeadDays();
  const canEdit = useCan('edit');
  const formatMoney = useFormatMoney();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const filter = isStatus(statusParam) ? statusParam : null;
  const [paying, setPaying] = useState<BillOccurrence | null>(null);
  const [editing, setEditing] = useState<Bill | 'new' | null>(null);

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(bills.map((bill) => [bill.id, bill]));
    return occurrences.flatMap((occurrence) => {
      const bill = byId.get(occurrence.billId);
      return bill ? [{ occurrence, bill, status: billStatus(occurrence, today, leadDays) }] : [];
    });
  }, [bills, occurrences, today, leadDays]);

  const byStatus = (status: BillStatus) => rows.filter((row) => row.status === status);
  const overdue = byStatus('overdue').sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));
  const dueSoon = byStatus('due-soon').sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));
  const upcomingAll = byStatus('upcoming').sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));
  const paidAll = byStatus('paid').sort((a, b) => (b.occurrence.paidAt ?? b.occurrence.dueDate).localeCompare(a.occurrence.paidAt ?? a.occurrence.dueDate));
  const cancelled = byStatus('cancelled').sort((a, b) => b.occurrence.dueDate.localeCompare(a.occurrence.dueDate));
  const thisMonth = monthKey(today);
  const paidThisMonth = paidAll.filter((row) => row.occurrence.paidAt && monthKey(row.occurrence.paidAt) === thisMonth);

  const open = (occurrence: BillOccurrence) =>
    navigate({ pathname: paths.billOccurrence(occurrence.id), search: location.search });

  const setFilter = (status: BillStatus | null) => {
    const next = new URLSearchParams(params);
    if (status) next.set('status', status);
    else next.delete('status');
    setParams(next, { replace: true });
  };

  const renderRows = (list: Row[]) => (
    <Box role="list">
      {list.map((row) => (
        <Box role="listitem" key={row.occurrence.id}>
          <BillRow
            occurrence={row.occurrence}
            bill={row.bill}
            status={row.status}
            today={today}
            onOpen={() => open(row.occurrence)}
            onMarkPaid={canEdit && (row.status === 'overdue' || row.status === 'due-soon' || row.status === 'upcoming') ? () => setPaying(row.occurrence) : undefined}
          />
        </Box>
      ))}
    </Box>
  );

  const group = (title: string, list: Row[], footer?: React.ReactNode) =>
    list.length === 0 ? null : (
      <SectionCard
        key={title}
        title={title}
        subtitle={`${list.length} bill${list.length === 1 ? '' : 's'} · ${formatMoney(sumMinor(list.map((row) => (row.status === 'paid' ? (row.occurrence.paidAmountMinor ?? row.occurrence.amountMinor) : row.occurrence.amountMinor))))}`}
        flush
      >
        {renderRows(list)}
        {footer}
      </SectionCard>
    );

  if (loading) {
    return (
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          <DashboardMetricSkeleton />
          <DashboardMetricSkeleton />
          <DashboardMetricSkeleton />
        </Box>
        <Card>
          <BillListSkeleton />
        </Card>
      </Stack>
    );
  }

  const upcomingWindowEnd = addDaysISO(today, UPCOMING_WINDOW_DAYS);
  const upcoming = upcomingAll.filter((row) => row.occurrence.dueDate <= upcomingWindowEnd);
  const recentPaid = paidAll.filter((row) => (row.occurrence.paidAt ?? row.occurrence.dueDate) >= addDaysISO(today, -RECENT_PAID_DAYS));
  const filtered = filter ? { overdue, 'due-soon': dueSoon, upcoming: upcomingAll, paid: paidAll, cancelled }[filter] : [];

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        <StatCard
          label="Overdue"
          value={overdue.length}
          icon={<AlertCircle size={18} />}
          tone={overdue.length ? 'danger' : 'neutral'}
          detail={overdue.length ? `${formatMoney(sumMinor(overdue.map((row) => row.occurrence.amountMinor)))} unpaid` : 'Nothing overdue'}
          to={paths.bills({ status: 'overdue' })}
        />
        <StatCard
          label={`Due in the next ${leadDays} days`}
          value={dueSoon.length}
          icon={<CalendarClock size={18} />}
          tone={dueSoon.length ? 'warning' : 'neutral'}
          detail={dueSoon.length ? formatMoney(sumMinor(dueSoon.map((row) => row.occurrence.amountMinor))) : 'No bills due soon'}
          to={paths.bills({ status: 'due-soon' })}
        />
        <StatCard
          label="Paid this month"
          value={formatMoney(sumMinor(paidThisMonth.map((row) => row.occurrence.paidAmountMinor ?? row.occurrence.amountMinor)))}
          icon={<CheckCircle2 size={18} />}
          tone="success"
          detail={`${paidThisMonth.length} bill${paidThisMonth.length === 1 ? '' : 's'}`}
          to={paths.bills({ status: 'paid' })}
        />
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }} role="group" aria-label="Filter bills by status">
        <Chip label="All" onClick={() => setFilter(null)} color={filter ? 'default' : 'primary'} variant={filter ? 'outlined' : 'filled'} aria-pressed={!filter} />
        {STATUS_FILTERS.map((status) => (
          <Chip
            key={status}
            label={BILL_STATUS_LABELS[status]}
            onClick={() => setFilter(status)}
            color={filter === status ? 'primary' : 'default'}
            variant={filter === status ? 'filled' : 'outlined'}
            aria-pressed={filter === status}
          />
        ))}
      </Stack>

      {bills.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={24} />}
            title="No upcoming bills"
            description="Add rent, utilities, subscriptions and other recurring bills to see what’s due and when."
            action={
              <EditButton variant="contained" onClick={() => setEditing('new')}>
                Add a bill
              </EditButton>
            }
          />
        </Card>
      ) : filter ? (
        filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Receipt size={24} />}
              title={`No ${BILL_STATUS_LABELS[filter].toLowerCase()} bills`}
              description="Try another status, or view all bills."
              action={<Button onClick={() => setFilter(null)}>Show all bills</Button>}
            />
          </Card>
        ) : (
          group(BILL_STATUS_LABELS[filter], filtered)
        )
      ) : (
        <>
          {overdue.length + dueSoon.length + upcoming.length === 0 && (
            <Card>
              <EmptyState icon={<CheckCircle2 size={24} />} title="No bills due" description="Nothing is due in the next few weeks." compact />
            </Card>
          )}
          {group('Overdue', overdue)}
          {group('Due soon', dueSoon)}
          {group(
            'Upcoming',
            upcoming,
            upcomingAll.length > upcoming.length ? (
              <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
                <Button size="small" onClick={() => setFilter('upcoming')}>
                  Show all {upcomingAll.length} upcoming bills
                </Button>
              </Box>
            ) : undefined,
          )}
          {group(
            'Recently paid',
            recentPaid,
            paidAll.length > recentPaid.length ? (
              <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
                <Button size="small" onClick={() => setFilter('paid')}>
                  View full payment history
                </Button>
              </Box>
            ) : undefined,
          )}
        </>
      )}

      {bills.length > 0 && <RecurringBills bills={bills} onEdit={(bill) => setEditing(bill)} onAdd={() => setEditing('new')} />}

      <Outlet />
      {paying && <MarkBillPaidDialog open occurrence={paying} onClose={() => setPaying(null)} />}
      {editing && <BillDialog open bill={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

function RecurringBills({ bills, onEdit, onAdd }: { bills: Bill[]; onEdit: (bill: Bill) => void; onAdd: () => void }) {
  const canEdit = useCan('edit');
  const { setSeriesActive, deleteBill } = useBillActions();
  const [menu, setMenu] = useState<{ anchor: HTMLElement; bill: Bill } | null>(null);
  const sorted = [...bills].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const monthlyTotal = sumMinor(bills.filter((bill) => bill.active && bill.recurrence).map(monthlyEquivalentMinor));

  return (
    <SectionCard
      title="All bills"
      subtitle={<>Recurring commitments ≈ <Money minor={monthlyTotal} /> per month</>}
      action={
        <EditButton size="small" onClick={onAdd}>
          Add bill
        </EditButton>
      }
      flush
    >
      <Box role="list">
        {sorted.map((bill) => (
          <Stack
            key={bill.id}
            role="listitem"
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: 1, borderColor: 'divider', opacity: bill.active ? 1 : 0.75 }}
          >
            <CategoryIcon category={bill.category} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>
                {bill.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" noWrap>
                {bill.recurrence ? describeRecurrence(bill.recurrence) : 'One-off'} · <Money minor={bill.amountMinor} />
                {bill.recurrence && bill.recurrence.frequency !== 'monthly' && (
                  <> (≈ <Money minor={monthlyEquivalentMinor(bill)} />/month)</>
                )}
              </Typography>
            </Box>
            {!bill.active && <StatusChip tone="neutral" label="Stopped" />}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <MemberAvatar userId={bill.payerId} emptyLabel="No payer set" />
            </Box>
            {canEdit && (
              <IconButton aria-label={`More actions for ${bill.name}`} onClick={(event) => setMenu({ anchor: event.currentTarget, bill })}>
                <MoreVertical size={18} />
              </IconButton>
            )}
          </Stack>
        ))}
      </Box>
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) onEdit(menu.bill);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <Pencil size={16} />
          </ListItemIcon>
          <ListItemText primary="Edit bill" />
        </MenuItem>
        {menu?.bill.recurrence && (
          <MenuItem
            onClick={() => {
              if (menu) void setSeriesActive(menu.bill, !menu.bill.active);
              setMenu(null);
            }}
          >
            <ListItemIcon>{menu.bill.active ? <Pause size={16} /> : <Play size={16} />}</ListItemIcon>
            <ListItemText primary={menu.bill.active ? 'Stop series' : 'Resume series'} />
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menu) void deleteBill(menu.bill);
            setMenu(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          <ListItemText primary="Delete bill" />
        </MenuItem>
      </Menu>
    </SectionCard>
  );
}
