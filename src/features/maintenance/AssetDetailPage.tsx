import { useMemo, useState } from 'react';
import { Box, Button, IconButton, Link, ListItemIcon, ListItemText, Menu, MenuItem, Skeleton, Stack, Typography } from '@mui/material';
import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, ClipboardCheck, EllipsisVertical, History, Pencil, ShieldCheck, Trash2, Wallet, Wrench } from 'lucide-react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useCan, useCollection, useCommit, useHouseholdLoading, useRecord, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { DashboardChartSkeleton } from '@/components/ui/Skeletons';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { formatDate, relativeDay } from '@/lib/dates';
import { nowIso } from '@/lib/ids';
import { LinkedDocuments } from '@/features/documents/components/LinkedDocuments';
import { WARRANTY_LABELS, lifetimeMaintenanceCost, warrantyStatus } from './logic';
import { WARRANTY_TONES, useLeadDays } from './ui';
import { AssetDialog } from './components/AssetDialog';
import { AssetTimeline } from './components/AssetTimeline';
import { CompleteMaintenanceDialog } from './components/CompleteMaintenanceDialog';
import { MaintenanceTaskDialog } from './components/MaintenanceTaskDialog';
import { MaintenanceTaskDrawer } from './components/MaintenanceTaskDrawer';
import { MaintenanceTaskRow } from './components/MaintenanceTaskRow';

export default function AssetDetailPage() {
  const { assetId } = useParams();
  const asset = useRecord('assets', assetId);
  const allTasks = useCollection('maintenanceTasks');
  const allRecords = useCollection('maintenanceRecords');
  const documents = useCollection('documents');
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const today = useToday();
  const leadDays = useLeadDays();
  const commit = useCommit();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const tasks = useMemo(() => allTasks.filter((task) => task.assetId === assetId), [allTasks, assetId]);
  const records = useMemo(
    () => allRecords.filter((record) => record.assetId === assetId).sort((a, b) => b.completedDate.localeCompare(a.completedDate)),
    [allRecords, assetId],
  );
  const upcoming = tasks.filter((task) => task.status === 'scheduled').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const cost = lifetimeMaintenanceCost(records);

  if (loading) {
    return (
      <Box role="status" aria-label="Loading asset">
        <Skeleton width={240} height={38} />
        <Skeleton width={180} height={20} sx={{ mb: 3 }} />
        <DashboardChartSkeleton height={200} />
      </Box>
    );
  }

  if (!asset) {
    return (
      <ErrorState
        kind="not-found"
        title="Asset not found"
        action={
          <Button component={RouterLink} to={paths.assets()}>
            Back to assets
          </Button>
        }
      />
    );
  }

  const warranty = warrantyStatus(asset, today, leadDays.warranty);

  const toggleArchive = async () => {
    setMenuAnchor(null);
    const updated = { ...asset, archived: !asset.archived, updatedAt: nowIso() };
    await commit(
      { put: { assets: [updated] } },
      {
        activity: { entity: 'asset', entityId: asset.id, message: `${updated.archived ? 'Archived' : 'Restored'} asset “${asset.name}”` },
        success: updated.archived ? 'Asset archived' : 'Asset restored',
        undo: { put: { assets: [asset] } },
      },
    );
  };

  const remove = async () => {
    setMenuAnchor(null);
    const parts = [
      tasks.length ? `${tasks.length} maintenance task${tasks.length === 1 ? '' : 's'}` : null,
      records.length ? `${records.length} history record${records.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    const ok = await confirm({
      title: `Delete “${asset.name}”?`,
      description: (
        <>
          {parts.length > 0 ? `This also permanently deletes its ${parts.join(' and ')}. ` : ''}
          Linked documents are kept but unlinked, and expenses already recorded stay in your finances. To keep the history,
          archive the asset instead.
        </>
      ),
      confirmLabel: 'Delete asset',
      destructive: true,
    });
    if (!ok) return;
    const now = nowIso();
    const taskIds = new Set(tasks.map((task) => task.id));
    const unlinked = documents
      .filter((document) => document.links.some((link) => (link.type === 'asset' && link.id === asset.id) || (link.type === 'maintenance' && taskIds.has(link.id))))
      .map((document) => ({
        ...document,
        links: document.links.filter((link) => !((link.type === 'asset' && link.id === asset.id) || (link.type === 'maintenance' && taskIds.has(link.id)))),
        updatedAt: now,
      }));
    navigate(paths.assets());
    await commit(
      {
        put: unlinked.length ? { documents: unlinked } : {},
        remove: {
          assets: [asset.id],
          ...(tasks.length ? { maintenanceTasks: [...taskIds] } : {}),
          ...(records.length ? { maintenanceRecords: records.map((record) => record.id) } : {}),
        },
      },
      { activity: { entity: 'asset', entityId: asset.id, message: `Deleted asset “${asset.name}”` }, success: 'Asset deleted' },
    );
  };

  return (
    <>
      <Link component={RouterLink} to={paths.assets()} underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1.5, fontSize: '0.875rem' }}>
        <ArrowLeft size={16} aria-hidden /> All assets
      </Link>
      <PageHeader
        title={asset.name}
        description={
          <Stack direction="row" spacing={1} alignItems="center" component="span" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            <span>{[asset.category, [asset.manufacturer, asset.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</span>
            {asset.archived && <StatusChip tone="neutral" label="Archived" />}
          </Stack>
        }
        actions={
          canEdit ? (
            <>
              <Button variant="contained" startIcon={<CalendarPlus size={17} />} onClick={() => setScheduleOpen(true)}>
                Schedule maintenance
              </Button>
              <Button variant="outlined" startIcon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <IconButton aria-label="More asset actions" aria-haspopup="menu" onClick={(event) => setMenuAnchor(event.currentTarget)} sx={{ border: 1, borderColor: 'divider' }}>
                <EllipsisVertical size={18} />
              </IconButton>
            </>
          ) : undefined
        }
      />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <SectionCard title="Upcoming maintenance" icon={<Wrench size={17} />} flush>
            {upcoming.length === 0 ? (
              <Stack spacing={1} alignItems="flex-start" sx={{ px: 2.5, pb: 2.5 }}>
                <Typography variant="body2" color="text.secondary">
                  No maintenance scheduled for this asset.
                </Typography>
                {canEdit && (
                  <Button size="small" startIcon={<CalendarPlus size={15} />} onClick={() => setScheduleOpen(true)}>
                    Schedule maintenance
                  </Button>
                )}
              </Stack>
            ) : (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, borderTop: 1, borderColor: 'divider' }}>
                {upcoming.map((task) => (
                  <MaintenanceTaskRow key={task.id} task={task} hideAsset onOpen={() => setOpenTaskId(task.id)} />
                ))}
              </Box>
            )}
          </SectionCard>

          <SectionCard
            title="History"
            icon={<History size={17} />}
            action={
              canEdit ? (
                <Button size="small" startIcon={<ClipboardCheck size={15} />} onClick={() => setLogOpen(true)}>
                  Log past maintenance
                </Button>
              ) : undefined
            }
          >
            <AssetTimeline asset={asset} tasks={tasks} records={records} onOpenTask={setOpenTaskId} />
          </SectionCard>
        </Stack>

        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <SectionCard title="Warranty" icon={<ShieldCheck size={17} />}>
            <StatusChip tone={WARRANTY_TONES[warranty]} label={WARRANTY_LABELS[warranty]} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {asset.warrantyExpiry
                ? `${warranty === 'expired' ? 'Ended' : 'Ends'} ${formatDate(asset.warrantyExpiry, 'd MMM yyyy')} (${relativeDay(asset.warrantyExpiry, today).toLowerCase()})`
                : 'Add the warranty expiry date to get a reminder before it ends.'}
            </Typography>
          </SectionCard>

          <SectionCard title="Lifetime maintenance spending" icon={<Wallet size={17} />}>
            {cost.costedCount === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No costs recorded yet.
              </Typography>
            ) : (
              <>
                <Typography variant="h2" component="p">
                  <Money minor={cost.totalMinor} />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  From {cost.costedCount} recorded service{cost.costedCount === 1 ? '' : 's'}
                  {cost.uncostedCount > 0 ? ` · ${cost.uncostedCount} without a cost` : ''}
                </Typography>
              </>
            )}
          </SectionCard>

          <SectionCard title="Details">
            <Box>
              <DetailRow label="Category">{asset.category}</DetailRow>
              <DetailRow label="Manufacturer">{asset.manufacturer ?? '—'}</DetailRow>
              <DetailRow label="Model">{asset.model ?? '—'}</DetailRow>
              <DetailRow label="Serial number">{asset.serialNumber ?? '—'}</DetailRow>
              <DetailRow label="Location">{asset.location ?? '—'}</DetailRow>
              <DetailRow label="Purchased">{asset.purchaseDate ? formatDate(asset.purchaseDate, 'd MMM yyyy') : '—'}</DetailRow>
              <DetailRow label="Purchase price">
                <Money minor={asset.purchasePriceMinor} />
              </DetailRow>
              {asset.notes && <DetailRow label="Notes">{asset.notes}</DetailRow>}
            </Box>
          </SectionCard>

          <SectionCard>
            <LinkedDocuments link={{ type: 'asset', id: asset.id }} title="Invoices & manuals" />
          </SectionCard>
        </Stack>
      </Box>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setLogOpen(true);
          }}
        >
          <ListItemIcon>
            <ClipboardCheck size={16} />
          </ListItemIcon>
          <ListItemText primary="Log past maintenance" />
        </MenuItem>
        <MenuItem onClick={toggleArchive}>
          <ListItemIcon>{asset.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</ListItemIcon>
          <ListItemText primary={asset.archived ? 'Restore asset' : 'Archive asset'} />
        </MenuItem>
        <MenuItem onClick={remove} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          <ListItemText primary="Delete asset" />
        </MenuItem>
      </Menu>

      {canEdit && (
        <>
          <AssetDialog open={editOpen} onClose={() => setEditOpen(false)} asset={asset} />
          <MaintenanceTaskDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} assetId={asset.id} />
          <CompleteMaintenanceDialog open={logOpen} onClose={() => setLogOpen(false)} assetId={asset.id} />
        </>
      )}
      {openTaskId && <MaintenanceTaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </>
  );
}
