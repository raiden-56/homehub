import { useState } from 'react';
import { Tab, Tabs } from '@mui/material';
import { Receipt, Wallet } from 'lucide-react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { EditButton } from './components/EditButton';
import { BillDialog } from './components/BillDialog';
import { ExpenseDialog } from './components/ExpenseDialog';
import BillsPage from './pages/BillsPage';
import { BillOccurrenceDrawer } from './pages/BillOccurrenceDrawer';
import ExpensesPage from './pages/ExpensesPage';
import { ExpenseDrawer } from './pages/ExpenseDrawer';
import BudgetPage from './pages/BudgetPage';
import BalancesPage from './pages/BalancesPage';
import ReportsPage from './pages/ReportsPage';

const TABS = [
  { value: 'bills', label: 'Bills' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budget', label: 'Budget' },
  { value: 'balances', label: 'Balances' },
  { value: 'reports', label: 'Reports' },
] as const;

/** Bills & Expenses: bills owed, money spent, budgets, shared balances and reports. */
export default function FinanceModule() {
  const { pathname } = useLocation();
  const section = pathname.split('/')[2] ?? 'bills';
  const current = TABS.some((tab) => tab.value === section) ? section : false;
  const [dialog, setDialog] = useState<'bill' | 'expense' | null>(null);

  return (
    <>
      <PageHeader
        title="Bills & Expenses"
        description="Track what’s due, what’s been spent, and how shared costs balance out."
        actions={
          <>
            <EditButton variant="outlined" startIcon={<Receipt size={17} />} onClick={() => setDialog('bill')}>
              Add bill
            </EditButton>
            <EditButton variant="contained" startIcon={<Wallet size={17} />} onClick={() => setDialog('expense')}>
              Record expense
            </EditButton>
          </>
        }
      >
        <Tabs
          value={current}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Bills and expenses sections"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} component={RouterLink} to={`/finance/${tab.value}`} />
          ))}
        </Tabs>
      </PageHeader>

      <Routes>
        <Route index element={<Navigate to="bills" replace />} />
        <Route path="bills" element={<BillsPage />}>
          <Route path=":occurrenceId" element={<BillOccurrenceDrawer />} />
        </Route>
        <Route path="expenses" element={<ExpensesPage />}>
          <Route path=":expenseId" element={<ExpenseDrawer />} />
        </Route>
        <Route path="budget" element={<BudgetPage />} />
        <Route path="balances" element={<BalancesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<ErrorState kind="not-found" title="Page not found" description="That finance page doesn’t exist." />} />
      </Routes>

      {dialog === 'bill' && <BillDialog open onClose={() => setDialog(null)} />}
      {dialog === 'expense' && <ExpenseDialog open onClose={() => setDialog(null)} />}
    </>
  );
}
