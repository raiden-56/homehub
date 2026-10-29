import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Chip, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckSquare,
  Eye,
  LayoutGrid,
  PackageSearch,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  useActiveHousehold,
  useAppSelector,
  useCommit,
  useCurrentUser,
  useHouseholdHour,
  useHouseholdLoading,
  useToday,
} from '@/app/hooks';
import { QuickAddMenu } from '@/components/layout/QuickAddMenu';
import { StatCard } from '@/components/ui/StatCard';
import { Money } from '@/components/ui/Money';
import { DashboardChartSkeleton, DashboardMetricSkeleton, TaskListSkeleton } from '@/components/ui/Skeletons';
import { motionTokens } from '@/components/ui/motion';
import { selectCurrentPreferences } from '@/store/selectors';
import { defaultPreferences } from '@/features/household/factory';
import { formatDate, greetingFor } from '@/lib/dates';
import { nowIso } from '@/lib/ids';
import { paths } from '@/app/paths';
import type { DashboardWidgetConfig, DashboardWidgetKey } from '@/types/models';
import { computeSummary } from './summary';
import { DEFAULT_WIDGETS, WIDGET_MODULE, WIDGET_TITLES, layoutId, resolveWidgets } from './layout';
import { DashboardCustomizer } from './DashboardCustomizer';
import { TodayTasksWidget } from './widgets/TodayTasksWidget';
import { ShoppingWidget } from './widgets/ShoppingWidget';
import { BillsWidget } from './widgets/BillsWidget';
import { InventoryAlertsWidget } from './widgets/InventoryAlertsWidget';
import { MaintenanceWidget } from './widgets/MaintenanceWidget';
import { SpendingWidget } from './widgets/SpendingWidget';
import { ActivityWidget } from './widgets/ActivityWidget';
import { InsightsWidget } from './widgets/InsightsWidget';
import { SectionCard } from '@/components/ui/SectionCard';

const WIDGETS: Record<DashboardWidgetKey, () => ReactNode> = {
  tasks: TodayTasksWidget,
  shopping: ShoppingWidget,
  bills: BillsWidget,
  inventory: InventoryAlertsWidget,
  maintenance: MaintenanceWidget,
  spending: SpendingWidget,
  activity: ActivityWidget,
  insights: InsightsWidget,
};

function renderWidget(key: DashboardWidgetKey) {
  const Widget = WIDGETS[key];
  return <Widget />;
}

export default function DashboardPage() {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const data = useAppSelector((state) => state.data);
  const storedPreferences = useAppSelector(selectCurrentPreferences);
  const loading = useHouseholdLoading();
  const today = useToday();
  const hour = useHouseholdHour();
  const commit = useCommit();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardWidgetConfig[] | null>(null);

  const savedLayout = user && household ? data.dashboardLayouts[layoutId(user.id, household.id)] : undefined;
  const widgets = useMemo(() => resolveWidgets(savedLayout), [savedLayout]);
  const enabled = household?.enabledModules ?? [];
  const isAvailable = (key: DashboardWidgetKey) => {
    const module = WIDGET_MODULE[key];
    return !module || enabled.includes(module);
  };

  // Leave edit mode when switching household.
  useEffect(() => {
    setEditing(false);
    setDraft(null);
  }, [household?.id]);

  const preferences = (storedPreferences ?? defaultPreferences(user?.id ?? '', '')).notifications;
  const summary = useMemo(() => computeSummary(data, today, preferences), [data, today, preferences]);

  if (!household || !user) return null;

  const saveLayout = async (next: DashboardWidgetConfig[]) => {
    const now = nowIso();
    const ok = await commit(
      {
        put: {
          dashboardLayouts: [
            {
              id: layoutId(user.id, household.id),
              householdId: household.id,
              userId: user.id,
              widgets: next,
              createdAt: savedLayout?.createdAt ?? now,
              updatedAt: now,
            },
          ],
        },
      },
      { action: 'view', success: 'Dashboard layout saved' },
    );
    if (ok) {
      setEditing(false);
      setDraft(null);
    }
  };

  const active = (editing ? draft : null) ?? widgets;
  const availableWidgets = active.filter((widget) => isAvailable(widget.key));
  const hiddenWidgets = availableWidgets.filter((widget) => widget.hidden);
  const firstName = user.name.split(' ')[0];

  const cards = [
    enabled.includes('tasks') && (
      <StatCard
        key="tasks"
        label="Pending tasks"
        value={summary.tasks.open}
        icon={<CheckSquare size={18} />}
        tone={summary.tasks.overdue > 0 ? 'danger' : 'primary'}
        detail={
          summary.tasks.overdue > 0
            ? `${summary.tasks.overdue} overdue · ${summary.tasks.dueToday} due today`
            : `${summary.tasks.dueToday} due today`
        }
        to={paths.tasks({ status: summary.tasks.overdue > 0 ? 'overdue' : 'open' })}
      />
    ),
    enabled.includes('shopping') && (
      <StatCard
        key="shopping"
        label="Shopping items left"
        value={summary.shopping.remaining}
        icon={<ShoppingCart size={18} />}
        detail={summary.shopping.lists > 0 ? `Across ${summary.shopping.lists} list${summary.shopping.lists === 1 ? '' : 's'}` : 'All lists done'}
        to={paths.shopping()}
      />
    ),
    enabled.includes('finance') && (
      <StatCard
        key="bills"
        label="Bills due soon"
        value={summary.bills.attention}
        icon={<Receipt size={18} />}
        tone={summary.bills.overdue > 0 ? 'danger' : summary.bills.attention > 0 ? 'warning' : 'primary'}
        detail={
          summary.bills.attention > 0 ? (
            <>
              {summary.bills.overdue > 0 ? `${summary.bills.overdue} overdue · ` : ''}
              <Money minor={summary.bills.totalMinor} /> total
            </>
          ) : (
            `Nothing due in ${preferences.billLeadDays} days`
          )
        }
        to={paths.bills({ status: summary.bills.overdue > 0 ? 'overdue' : 'due-soon' })}
      />
    ),
    enabled.includes('inventory') && (
      <StatCard
        key="inventory"
        label="Low-stock items"
        value={summary.inventory.low + summary.inventory.out}
        icon={<PackageSearch size={18} />}
        tone={summary.inventory.out > 0 ? 'terracotta' : summary.inventory.low > 0 ? 'warning' : 'primary'}
        detail={[
          summary.inventory.out > 0 ? `${summary.inventory.out} out of stock` : null,
          summary.inventory.expiring > 0 ? `${summary.inventory.expiring} expiring` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Stock levels look fine'}
        to={paths.inventory({ stock: 'low' })}
      />
    ),
    enabled.includes('finance') && (
      <StatCard
        key="spending"
        label="Spent this month"
        value={<Money minor={summary.spending.monthMinor} compact={summary.spending.monthMinor >= 10_000_000} />}
        icon={<Wallet size={18} />}
        detail={
          summary.spending.budgetMinor !== undefined ? (
            <>
              of <Money minor={summary.spending.budgetMinor} /> budget
            </>
          ) : (
            `${summary.spending.count} expense${summary.spending.count === 1 ? '' : 's'} recorded`
          )
        }
        tone={summary.spending.budgetMinor !== undefined && summary.spending.monthMinor > summary.spending.budgetMinor ? 'danger' : 'primary'}
        to={paths.expenses({ month: today.slice(0, 7) })}
      />
    ),
    enabled.includes('maintenance') && (
      <StatCard
        key="maintenance"
        label="Upcoming maintenance"
        value={summary.maintenance.upcoming + summary.maintenance.overdue}
        icon={<Wrench size={18} />}
        tone={summary.maintenance.overdue > 0 ? 'danger' : 'primary'}
        detail={summary.maintenance.overdue > 0 ? `${summary.maintenance.overdue} overdue` : 'In the next two weeks'}
        to={paths.maintenance({ due: summary.maintenance.overdue > 0 ? 'overdue' : 'upcoming' })}
      />
    ),
  ].filter(Boolean);

  return (
    <>
      <Stack
        component="header"
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {formatDate(today, 'EEEE, d MMMM')} · {household.name}
          </Typography>
          <Typography variant="h1" sx={{ mt: 0.5 }}>
            {greetingFor(hour)}, {firstName}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Here’s what’s happening around your home today.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {!editing && (
            <Button variant="outlined" startIcon={<LayoutGrid size={17} />} onClick={() => { setDraft(widgets); setEditing(true); }} disabled={loading}>
              Customize
            </Button>
          )}
          <QuickAddMenu />
        </Stack>
      </Stack>

      <Box
        component="section"
        aria-label="Summary"
        sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } }}
      >
        {loading ? Array.from({ length: 6 }, (_, index) => <DashboardMetricSkeleton key={index} />) : cards}
      </Box>

      <AnimatePresence initial={false}>
        {editing && draft && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={motionTokens.base}>
            <Box
              role="region"
              aria-label="Customize dashboard"
              sx={(t) => ({ mb: 2.5, p: 2, borderRadius: 3, backgroundColor: t.tokens.sage, color: t.tokens.sageText })}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle1">Customize your dashboard</Typography>
                  <Typography variant="body2">
                    Drag widgets to reorder{isDesktop ? ', choose half or full width,' : ''} or hide the ones you don’t need.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                  <Button color="inherit" startIcon={<RotateCcw size={16} />} onClick={() => setDraft(DEFAULT_WIDGETS.map((widget) => ({ ...widget })))}>
                    Reset to default
                  </Button>
                  <Button color="inherit" onClick={() => { setEditing(false); setDraft(null); }}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={() => saveLayout(draft)}>
                    Save layout
                  </Button>
                </Stack>
              </Stack>
              {hiddenWidgets.length > 0 && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Hidden:
                  </Typography>
                  {hiddenWidgets.map((widget) => (
                    <Chip
                      key={widget.key}
                      icon={<Eye size={14} />}
                      label={`Show ${WIDGET_TITLES[widget.key]}`}
                      onClick={() => setDraft(draft.map((entry) => (entry.key === widget.key ? { ...entry, hidden: false } : entry)))}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <SectionCard title="Today’s tasks">
            <TaskListSkeleton rows={4} />
          </SectionCard>
          <SectionCard title="Bills due soon">
            <TaskListSkeleton rows={4} />
          </SectionCard>
          <Box sx={{ gridColumn: { md: 'span 2' } }}>
            <DashboardChartSkeleton />
          </Box>
        </Box>
      ) : editing && draft ? (
        <DashboardCustomizer
          widgets={draft.filter((widget) => isAvailable(widget.key))}
          onChange={(next) => setDraft([...next, ...draft.filter((widget) => !isAvailable(widget.key))])}
          renderWidget={renderWidget}
          allowResize={isDesktop}
        />
      ) : availableWidgets.every((widget) => widget.hidden) ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">All widgets are hidden.</Typography>
          <Button sx={{ mt: 1 }} onClick={() => { setDraft(widgets); setEditing(true); }}>
            Customize dashboard
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
          {availableWidgets
            .filter((widget) => !widget.hidden)
            .map((widget) => (
              <Box key={widget.key} sx={{ gridColumn: { md: widget.size === 'wide' ? 'span 2' : 'span 1' }, minWidth: 0 }}>
                {renderWidget(widget.key)}
              </Box>
            ))}
        </Box>
      )}
    </>
  );
}
