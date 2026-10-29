import { useMemo, useState } from 'react';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { ArrowRight, HandCoins, Scale } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCollection, useHouseholdLoading, useMembers } from '@/app/hooks';
import { paths } from '@/app/paths';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { BillListSkeleton } from '@/components/ui/Skeletons';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate } from '@/lib/dates';
import { computeBalances, minimizeTransfers, type Transfer } from '../logic/settlement';
import { shareOf } from '../logic/splits';
import { SettlementDialog } from '../components/SettlementDialog';
import { EditButton } from '../components/EditButton';

const HISTORY_PAGE = 20;

export default function BalancesPage() {
  const loading = useHouseholdLoading();
  const expenses = useCollection('expenses');
  const settlements = useCollection('settlements');
  const members = useMembers();
  const users = useAppSelector((state) => state.data.users);
  const [dialog, setDialog] = useState<{ defaults?: Partial<Transfer> } | null>(null);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);

  const balances = useMemo(
    () => computeBalances(expenses, settlements, members.map((member) => member.userId)),
    [expenses, settlements, members],
  );
  const transfers = useMemo(() => minimizeTransfers(balances), [balances]);
  const nameOf = (userId: string) => users[userId]?.name ?? 'Former member';
  const people = Object.keys(balances).sort((a, b) => (balances[b] ?? 0) - (balances[a] ?? 0));

  const history = useMemo(() => {
    const split = expenses
      .filter((expense) => expense.split)
      .map((expense) => ({ kind: 'expense' as const, date: expense.date, created: expense.createdAt, expense }));
    const paid = settlements.map((settlement) => ({ kind: 'settlement' as const, date: settlement.date, created: settlement.createdAt, settlement }));
    return [...split, ...paid].sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created));
  }, [expenses, settlements]);

  if (loading) {
    return (
      <Card>
        <BillListSkeleton />
      </Card>
    );
  }

  const hasShared = history.length > 0;

  return (
    <Stack spacing={2.5}>
      <SectionCard
        title="Who owes whom"
        subtitle="Based on split expenses and recorded settlements"
        icon={<Scale size={17} />}
        action={
          <EditButton size="small" variant="outlined" onClick={() => setDialog({})}>
            Record settlement
          </EditButton>
        }
      >
        {!hasShared ? (
          <EmptyState
            compact
            icon={<Scale size={20} />}
            title="All settled"
            description="Split an expense between members to track shared costs here."
            action={
              <Button component={RouterLink} to={paths.expenses()} size="small">
                Go to expenses
              </Button>
            }
          />
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
            {people.map((userId) => {
              const amount = balances[userId] ?? 0;
              return (
                <Card key={userId} sx={{ p: 1.75 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <MemberAvatar userId={userId} size={36} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>
                        {nameOf(userId)}
                      </Typography>
                      {amount === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          All settled
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {amount > 0 ? 'Is owed ' : 'Owes '}
                          <Money minor={Math.abs(amount)} />
                        </Typography>
                      )}
                    </Box>
                    <StatusChip
                      tone={amount > 0 ? 'success' : amount < 0 ? 'terracotta' : 'neutral'}
                      label={amount > 0 ? 'Owed' : amount < 0 ? 'Owes' : 'Settled'}
                    />
                  </Stack>
                </Card>
              );
            })}
          </Box>
        )}
      </SectionCard>

      {hasShared && (
        <SectionCard
          title="Suggested transfers"
          subtitle="The fewest transfers that settle everyone without changing what anyone owes"
          icon={<HandCoins size={17} />}
          flush
        >
          {transfers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>
              Everyone is settled up. Nothing to transfer.
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {transfers.map((transfer) => (
                <Stack
                  component="li"
                  key={`${transfer.fromUserId}-${transfer.toUserId}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0, flexWrap: 'wrap', rowGap: 0.5 }}>
                    <MemberAvatar userId={transfer.fromUserId} withName size={24} />
                    <ArrowRight size={16} aria-label="pays" role="img" />
                    <MemberAvatar userId={transfer.toUserId} withName size={24} />
                  </Stack>
                  <Typography sx={{ fontWeight: 700 }}>
                    <Money minor={transfer.amountMinor} />
                  </Typography>
                  <EditButton size="small" variant="outlined" onClick={() => setDialog({ defaults: transfer })}>
                    Record as paid
                  </EditButton>
                </Stack>
              ))}
            </Box>
          )}
        </SectionCard>
      )}

      {hasShared && (
        <SectionCard title="Shared transaction history" subtitle={`${history.length} entries`} flush>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {history.slice(0, historyLimit).map((entry) =>
              entry.kind === 'expense' ? (
                <Stack
                  component="li"
                  key={`e-${entry.expense.id}`}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ px: 2.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}
                >
                  <MemberAvatar userId={entry.expense.payerId} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component={RouterLink}
                      to={paths.expense(entry.expense.id)}
                      variant="body2"
                      sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {entry.expense.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p" noWrap>
                      {formatDate(entry.date, 'd MMM yyyy')} · {nameOf(entry.expense.payerId)} paid · split {entry.expense.split!.shares.length} ways · their share{' '}
                      <Money minor={shareOf(entry.expense.split, entry.expense.payerId)} />
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    <Money minor={entry.expense.amountMinor} />
                  </Typography>
                </Stack>
              ) : (
                <Stack
                  component="li"
                  key={`s-${entry.settlement.id}`}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ px: 2.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}
                >
                  <HandCoins size={20} aria-hidden />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {nameOf(entry.settlement.fromUserId)} paid {nameOf(entry.settlement.toUserId)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p" noWrap>
                      Settlement · {formatDate(entry.date, 'd MMM yyyy')}
                      {entry.settlement.note ? ` · ${entry.settlement.note}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    <Money minor={entry.settlement.amountMinor} />
                  </Typography>
                </Stack>
              ),
            )}
          </Box>
          {history.length > historyLimit && (
            <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
              <Button size="small" onClick={() => setHistoryLimit((value) => value + HISTORY_PAGE)}>
                Show more
              </Button>
            </Box>
          )}
        </SectionCard>
      )}

      {dialog && <SettlementDialog open defaults={dialog.defaults} onClose={() => setDialog(null)} />}
    </Stack>
  );
}
