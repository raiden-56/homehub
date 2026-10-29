import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  ButtonBase,
} from '@mui/material';
import { Users, Wallet } from 'lucide-react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCollection, useHouseholdLoading } from '@/app/hooks';
import { paths } from '@/app/paths';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { BillListSkeleton } from '@/components/ui/Skeletons';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatDate, formatMonth, monthKey } from '@/lib/dates';
import { sumMinor } from '@/lib/money';
import type { Expense } from '@/types/models';
import { ExpenseSourceChip } from '../components/ExpenseSourceChip';
import { CategoryIcon } from '../components/CategoryIcon';
import { ExpenseDialog } from '../components/ExpenseDialog';
import { EditButton } from '../components/EditButton';
import { useExpenseCategories } from '../hooks';

const PAGE_SIZE = 25;

export default function ExpensesPage() {
  const loading = useHouseholdLoading();
  const expenses = useCollection('expenses');
  const categories = useExpenseCategories();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const month = params.get('month') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  const months = useMemo(
    () => [...new Set(expenses.map((expense) => monthKey(expense.date)))].sort().reverse(),
    [expenses],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return expenses
      .filter((expense) => !category || expense.category === category)
      .filter((expense) => !month || monthKey(expense.date) === month)
      .filter(
        (expense) =>
          !query ||
          [expense.description, expense.category, expense.notes, expense.paymentMethod].filter(Boolean).join(' ').toLowerCase().includes(query),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [expenses, q, category, month]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const total = sumMinor(filtered.map((expense) => expense.amountMinor));
  const open = (expense: Expense) => navigate({ pathname: paths.expense(expense.id), search: location.search });
  const hasFilters = !!(q || category || month);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <SearchField value={q} onChange={(value) => setParam('q', value)} placeholder="Search expenses" sx={{ flex: 2 }} />
        <TextField select label="Category" value={category} onChange={(event) => setParam('category', event.target.value)} sx={{ flex: 1 }}>
          <MenuItem value="">All categories</MenuItem>
          {categories.map((entry) => (
            <MenuItem key={entry} value={entry}>
              {entry}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Month" value={month} onChange={(event) => setParam('month', event.target.value)} sx={{ flex: 1 }}>
          <MenuItem value="">All months</MenuItem>
          {months.map((entry) => (
            <MenuItem key={entry} value={entry}>
              {formatMonth(entry)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {!loading && expenses.length > 0 && (
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ flexWrap: 'wrap', rowGap: 0.5 }} role="status">
          <Typography variant="body2" color="text.secondary">
            {filtered.length} expense{filtered.length === 1 ? '' : 's'}
            {hasFilters ? ' match your filters' : ''}
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>
            Total <Money minor={total} />
          </Typography>
        </Stack>
      )}

      <Card>
        {loading ? (
          <BillListSkeleton rows={6} />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<Wallet size={24} />}
            title="No expenses recorded yet"
            description="Record what the household spends to see budgets, balances and reports based on real numbers."
            action={
              <EditButton variant="contained" onClick={() => setAdding(true)}>
                Record an expense
              </EditButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet size={24} />}
            title="No matching expenses"
            description="Try a different search, category or month."
            action={<Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</Button>}
          />
        ) : compact ? (
          <Box role="list">
            {visible.map((expense) => (
              <ButtonBase
                key={expense.id}
                role="listitem"
                onClick={() => open(expense)}
                sx={{ display: 'flex', width: '100%', gap: 1.5, px: 1.5, py: 1.25, textAlign: 'left', borderBottom: 1, borderColor: 'divider' }}
              >
                <CategoryIcon category={expense.category} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {expense.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="p" noWrap>
                    {formatDate(expense.date, 'd MMM yyyy')} · {expense.category}
                    {expense.split ? ' · Split' : ''}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>
                  <Money minor={expense.amountMinor} />
                </Typography>
              </ButtonBase>
            ))}
          </Box>
        ) : (
          <Table size="small" aria-label="Expenses">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Paid by</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((expense) => (
                <TableRow
                  key={expense.id}
                  hover
                  onClick={() => open(expense)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(expense.date, 'd MMM yyyy')}</TableCell>
                  <TableCell>
                    <ButtonBase
                      onClick={(event) => {
                        event.stopPropagation();
                        open(expense);
                      }}
                      sx={{ fontWeight: 600, textAlign: 'left', borderRadius: 1, gap: 0.75 }}
                    >
                      {expense.description}
                      {expense.split && (
                        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }} aria-label="Split expense" role="img">
                          <Users size={14} />
                        </Box>
                      )}
                    </ButtonBase>
                  </TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>
                    <MemberAvatar userId={expense.payerId} withName size={22} />
                  </TableCell>
                  <TableCell>
                    <ExpenseSourceChip source={expense.source} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    <Money minor={expense.amountMinor} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {pageCount > 1 && (
        <Pagination
          count={pageCount}
          page={currentPage}
          onChange={(_, value) => setPage(value)}
          sx={{ alignSelf: 'center' }}
          color="primary"
          aria-label="Expense pages"
        />
      )}

      <Outlet />
      {adding && <ExpenseDialog open onClose={() => setAdding(false)} />}
    </Stack>
  );
}
