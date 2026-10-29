import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Plus, Refrigerator, ShieldAlert } from 'lucide-react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useCan, useCollection, useHouseholdLoading, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { AssetCardSkeleton } from '@/components/ui/Skeletons';
import { ASSET_CATEGORIES } from '@/lib/constants';
import { formatDate, relativeDay } from '@/lib/dates';
import type { Asset, MaintenanceTask } from '@/types/models';
import { WARRANTY_LABELS, warrantyStatus, type WarrantyStatus } from './logic';
import { WARRANTY_TONES, useLeadDays } from './ui';
import { MaintenanceTabs } from './components/MaintenanceTabs';
import { AssetCard } from './components/AssetCard';
import { AssetDialog } from './components/AssetDialog';

type WarrantyFilter = '' | 'active' | 'expiring' | 'expired';
const ALERT_LIMIT = 5;

export default function AssetsPage() {
  const assets = useCollection('assets');
  const tasks = useCollection('maintenanceTasks');
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const today = useToday();
  const leadDays = useLeadDays();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const warrantyParam = searchParams.get('warranty');
  const warranty: WarrantyFilter =
    warrantyParam === 'active' || warrantyParam === 'expiring' || warrantyParam === 'expired' ? warrantyParam : '';
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const archived = searchParams.get('archived') === 'true';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const nextTaskByAsset = useMemo(() => {
    const map = new Map<string, MaintenanceTask>();
    for (const task of tasks) {
      if (!task.assetId || task.status !== 'scheduled') continue;
      const current = map.get(task.assetId);
      if (!current || task.dueDate < current.dueDate) map.set(task.assetId, task);
    }
    return map;
  }, [tasks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return assets
      .filter((asset) => asset.archived === archived)
      .filter((asset) => !category || asset.category === category)
      .filter((asset) => !warranty || warrantyStatus(asset, today, leadDays.warranty) === warranty)
      .filter(
        (asset) =>
          !query ||
          [asset.name, asset.manufacturer, asset.model, asset.serialNumber, asset.location, asset.category]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets, archived, category, warranty, q, today, leadDays.warranty]);

  const alertGroups = useMemo(() => {
    const groups: Record<Exclude<WarrantyStatus, 'none'>, Asset[]> = { expiring: [], expired: [], active: [] };
    for (const asset of assets) {
      if (asset.archived) continue;
      const status = warrantyStatus(asset, today, leadDays.warranty);
      if (status !== 'none') groups[status].push(asset);
    }
    for (const list of Object.values(groups)) list.sort((a, b) => (a.warrantyExpiry ?? '').localeCompare(b.warrantyExpiry ?? ''));
    groups.expired.reverse();
    return groups;
  }, [assets, today, leadDays.warranty]);

  const categories = [...new Set([...ASSET_CATEGORIES, ...assets.map((asset) => asset.category)])];
  const hasWarrantyInfo = alertGroups.expiring.length + alertGroups.expired.length + alertGroups.active.length > 0;

  const addButton = (
    <Tooltip title={canEdit ? '' : 'Viewers can’t add assets'}>
      <span>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setDialogOpen(true)} disabled={!canEdit}>
          Add asset
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Appliances and equipment, with warranties, service history and manuals."
        actions={addButton}
      >
        <MaintenanceTabs value="assets" />
      </PageHeader>

      {!loading && hasWarrantyInfo && (
        <SectionCard title="Warranty alerts" icon={<ShieldAlert size={17} />} subtitle={`Expiring soon means within ${leadDays.warranty} days`} sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {(['expiring', 'expired', 'active'] as const).map((status) => {
              const list = alertGroups[status];
              return (
                <Box key={status}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <StatusChip tone={WARRANTY_TONES[status]} label={`${status === 'expiring' ? 'Expiring soon' : status === 'expired' ? 'Expired' : 'Active'} · ${list.length}`} />
                  </Stack>
                  {list.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {status === 'expiring' ? 'Nothing expiring soon.' : status === 'expired' ? 'No expired warranties.' : 'No active warranties.'}
                    </Typography>
                  ) : (
                    <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                      {list.slice(0, ALERT_LIMIT).map((asset) => (
                        <Box component="li" key={asset.id}>
                          <Link component={RouterLink} to={paths.asset(asset.id)} underline="hover" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {asset.name}
                          </Link>
                          <Typography variant="caption" color="text.secondary" component="p">
                            {status === 'expired' ? 'Ended' : 'Ends'} {formatDate(asset.warrantyExpiry!, 'd MMM yyyy')}
                            {status === 'expiring' ? ` (${relativeDay(asset.warrantyExpiry!, today).toLowerCase()})` : ''}
                          </Typography>
                        </Box>
                      ))}
                      {list.length > ALERT_LIMIT && (
                        <Box component="li">
                          <Link component="button" type="button" variant="body2" onClick={() => setParam('warranty', status)}>
                            View all {list.length}
                          </Link>
                        </Box>
                      )}
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Box>
        </SectionCard>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} sx={{ mb: 2 }}>
        <SearchField value={q} onChange={(value) => setParam('q', value)} placeholder="Search name, brand, model, serial" sx={{ maxWidth: { lg: 320 } }} />
        <TextField select label="Category" value={category} onChange={(event) => setParam('category', event.target.value)} sx={{ minWidth: 180, maxWidth: { lg: 220 } }}>
          <MenuItem value="">All categories</MenuItem>
          {categories.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={warranty}
          onChange={(_, value: WarrantyFilter | null) => setParam('warranty', value ?? '')}
          aria-label="Filter by warranty"
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="active">{WARRANTY_LABELS.active}</ToggleButton>
          <ToggleButton value="expiring">Expiring</ToggleButton>
          <ToggleButton value="expired">Expired</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch checked={archived} onChange={(event) => setParam('archived', event.target.checked ? 'true' : '')} />}
          label="Show archived"
        />
      </Stack>

      {loading ? (
        <AssetCardSkeleton />
      ) : assets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Refrigerator size={24} />}
            title="No assets yet"
            description="Add appliances and equipment to track warranties, service history and manuals."
            action={canEdit ? addButton : undefined}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<Refrigerator size={20} />}
            title={archived ? 'No archived assets' : 'No assets match'}
            description="Try a different search or filter."
            action={<Button onClick={() => setSearchParams({}, { replace: true })}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} nextTask={nextTaskByAsset.get(asset.id)} />
          ))}
        </Box>
      )}

      <AssetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
