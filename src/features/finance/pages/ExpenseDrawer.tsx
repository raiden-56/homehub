import { useState } from 'react';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { Pencil, Trash2 } from 'lucide-react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppSelector, useCan, useRecord } from '@/app/hooks';
import { paths } from '@/app/paths';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { LinkedDocuments } from '@/features/documents/components/LinkedDocuments';
import type { Expense } from '@/types/models';
import { SPLIT_METHOD_LABELS, formatBp } from '../logic/splits';
import { ExpenseSourceChip } from '../components/ExpenseSourceChip';
import { ExpenseDialog } from '../components/ExpenseDialog';
import { useDeleteExpense } from '../useDeleteExpense';

function useSourceLink(expense: Expense | undefined): { to: string; label: string } | null {
  const data = useAppSelector((state) => state.data);
  if (!expense?.sourceId) return null;
  switch (expense.source) {
    case 'bill':
      return data.billOccurrences[expense.sourceId] ? { to: paths.billOccurrence(expense.sourceId), label: 'View bill' } : null;
    case 'shopping': {
      const item = data.shoppingItems[expense.sourceId];
      return item ? { to: paths.shoppingList(item.listId), label: 'View shopping list' } : null;
    }
    case 'maintenance': {
      const record = data.maintenanceRecords[expense.sourceId];
      if (!record) return null;
      return record.assetId ? { to: paths.asset(record.assetId), label: 'View asset history' } : { to: paths.maintenance(), label: 'View maintenance' };
    }
    default:
      return null;
  }
}

/** Detail panel for one expense at `/finance/expenses/:expenseId`. */
export function ExpenseDrawer() {
  const { expenseId } = useParams();
  const expense = useRecord('expenses', expenseId);
  const canEdit = useCan('edit');
  const navigate = useNavigate();
  const location = useLocation();
  const deleteExpense = useDeleteExpense();
  const sourceLink = useSourceLink(expense);
  const [editing, setEditing] = useState(false);

  const close = () => navigate({ pathname: paths.expenses(), search: location.search });

  if (!expense) {
    return (
      <DetailDrawer open onClose={close} title="Expense not found">
        <ErrorState kind="not-found" action={<Button onClick={close}>Back to expenses</Button>} />
      </DetailDrawer>
    );
  }

  return (
    <>
      <DetailDrawer
        open
        onClose={close}
        title={expense.description}
        subtitle={
          <Stack direction="row" spacing={1} alignItems="center">
            <ExpenseSourceChip source={expense.source} />
            <span>{expense.category}</span>
          </Stack>
        }
      >
        <Typography variant="caption" color="text.secondary">
          Amount
        </Typography>
        <Typography variant="h1" component="p" sx={{ mb: 2 }}>
          <Money minor={expense.amountMinor} />
        </Typography>

        {canEdit && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant="outlined" startIcon={<Pencil size={16} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={async () => {
                if (await deleteExpense(expense)) close();
              }}
            >
              Delete
            </Button>
          </Stack>
        )}

        <DetailRow label="Date">{formatDate(expense.date, 'EEEE, d MMM yyyy')}</DetailRow>
        <DetailRow label="Paid by">
          <MemberAvatar userId={expense.payerId} withName size={22} />
        </DetailRow>
        {expense.paymentMethod && <DetailRow label="Payment method">{expense.paymentMethod}</DetailRow>}
        {sourceLink && (
          <DetailRow label="Recorded from">
            <Button component={RouterLink} to={sourceLink.to} size="small" sx={{ px: 0, minHeight: 0 }}>
              {sourceLink.label}
            </Button>
          </DetailRow>
        )}
        {expense.notes && <DetailRow label="Notes">{expense.notes}</DetailRow>}
        <DetailRow label="Last updated">{formatTimestamp(expense.updatedAt)}</DetailRow>

        <Box sx={{ mt: 2.5 }}>
          <Typography variant="h4" component="h3" sx={{ mb: 1 }}>
            Split
          </Typography>
          {expense.split ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {SPLIT_METHOD_LABELS[expense.split.method]} between {expense.split.shares.length}{' '}
                {expense.split.shares.length === 1 ? 'person' : 'people'}
              </Typography>
              <Stack spacing={0.5} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {expense.split.shares.map((share) => (
                  <Stack key={share.userId} component="li" direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
                    <MemberAvatar userId={share.userId} withName size={22} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      <Money minor={share.shareMinor} />
                      {share.percentBp !== undefined && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          ({formatBp(share.percentBp)})
                        </Typography>
                      )}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Button component={RouterLink} to={paths.balances()} size="small" sx={{ mt: 1, px: 0 }}>
                See household balances
              </Button>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not split — treated as a personal expense of the payer.
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2.5 }} />
        <LinkedDocuments link={{ type: 'expense', id: expense.id }} title="Receipts" />
      </DetailDrawer>
      {editing && <ExpenseDialog open expense={expense} onClose={() => setEditing(false)} />}
    </>
  );
}
