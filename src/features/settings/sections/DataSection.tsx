import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { DatabaseBackup, Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from 'react-redux';
import { useActiveHousehold, useAppDispatch, useAppSelector, useCan } from '@/app/hooks';
import type { RootState } from '@/app/store';
import { SectionCard } from '@/components/ui/SectionCard';
import { useToast } from '@/components/feedback/ToastProvider';
import { toUserMessage } from '@/data/errors';
import { downloadBlob, downloadCsv, slugify } from '@/lib/download';
import { formatTimestamp, todayIn } from '@/lib/dates';
import { minorToInput } from '@/lib/money';
import { paths } from '@/app/paths';
import { buildBackup, buildJsonExport, parseBackup, restoreBackup, type ParsedBackup } from '../backup';

export function DataSection() {
  const household = useActiveHousehold();
  const data = useAppSelector((state) => state.data);
  const canRestoreHere = useCan('deleteHousehold');
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);

  if (!household) return null;
  const stamp = todayIn(household.timeZone);
  const base = `homehub-${slugify(household.name)}-${stamp}`;
  const currency = household.currency;
  const userName = (id: string | undefined) => (id ? (data.users[id]?.name ?? 'Former member') : '');

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      toast.show({ message: toUserMessage(error), severity: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const csvExports: { key: string; label: string; run: () => void; count: number }[] = [
    {
      key: 'inventory',
      label: 'Inventory',
      count: Object.keys(data.inventoryItems).length,
      run: () =>
        downloadCsv(
          `${base}-inventory.csv`,
          ['Name', 'Category', 'Location', 'Quantity', 'Unit', 'Minimum', 'Purchase price', 'Purchase date', 'Expiry date', 'Barcode', 'Archived', 'Notes'],
          Object.values(data.inventoryItems).map((item) => [
            item.name,
            data.inventoryCategories[item.categoryId]?.name,
            data.inventoryLocations[item.locationId]?.name,
            item.quantity,
            item.unit,
            item.minQuantity,
            minorToInput(item.purchasePriceMinor, currency),
            item.purchaseDate,
            item.expiryDate,
            item.barcode,
            item.archived ? 'yes' : 'no',
            item.notes,
          ]),
        ),
    },
    {
      key: 'expenses',
      label: 'Expenses',
      count: Object.keys(data.expenses).length,
      run: () =>
        downloadCsv(
          `${base}-expenses.csv`,
          ['Date', 'Description', 'Category', `Amount (${currency})`, 'Paid by', 'Payment method', 'Source', 'Split', 'Notes'],
          Object.values(data.expenses)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((expense) => [
              expense.date,
              expense.description,
              expense.category,
              minorToInput(expense.amountMinor, currency),
              userName(expense.payerId),
              expense.paymentMethod,
              expense.source,
              expense.split ? expense.split.shares.map((share) => `${userName(share.userId)}: ${minorToInput(share.shareMinor, currency)}`).join('; ') : '',
              expense.notes,
            ]),
        ),
    },
    {
      key: 'bills',
      label: 'Bills',
      count: Object.keys(data.billOccurrences).length,
      run: () =>
        downloadCsv(
          `${base}-bills.csv`,
          ['Bill', 'Category', 'Due date', `Amount (${currency})`, 'State', 'Paid on', `Paid amount (${currency})`, 'Paid by'],
          Object.values(data.billOccurrences)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((occurrence) => {
              const bill = data.bills[occurrence.billId];
              return [
                bill?.name,
                bill?.category,
                occurrence.dueDate,
                minorToInput(occurrence.amountMinor, currency),
                occurrence.state,
                occurrence.paidAt,
                minorToInput(occurrence.paidAmountMinor, currency),
                userName(occurrence.paidBy),
              ];
            }),
        ),
    },
    {
      key: 'tasks',
      label: 'Tasks',
      count: Object.keys(data.tasks).length,
      run: () =>
        downloadCsv(
          `${base}-tasks.csv`,
          ['Title', 'Category', 'Assigned to', 'Due date', 'Priority', 'Status', 'Completed at', 'Completed by'],
          Object.values(data.tasks).map((task) => [
            task.title,
            task.category,
            userName(task.assigneeId),
            task.dueDate,
            task.priority,
            task.status,
            task.completedAt,
            userName(task.completedBy),
          ]),
        ),
    },
    {
      key: 'maintenance',
      label: 'Maintenance history',
      count: Object.keys(data.maintenanceRecords).length,
      run: () =>
        downloadCsv(
          `${base}-maintenance.csv`,
          ['Completed', 'Asset', 'Work performed', 'Provider', `Cost (${currency})`, 'Notes'],
          Object.values(data.maintenanceRecords)
            .sort((a, b) => a.completedDate.localeCompare(b.completedDate))
            .map((record) => [
              record.completedDate,
              record.assetId ? data.assets[record.assetId]?.name : '',
              record.workPerformed,
              record.provider,
              minorToInput(record.actualCostMinor, currency),
              record.notes,
            ]),
        ),
    },
  ];

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('parse');
    setParsed(await parseBackup(file, store.getState()));
    setBusy(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const confirmRestore = () =>
    run('restore', async () => {
      if (!parsed?.ok) return;
      await dispatch(restoreBackup(parsed.backup));
      setParsed(null);
      toast.show({ message: `Restored ${parsed.summary.householdName}`, severity: 'success' });
      navigate(paths.overview());
    });

  const documentCount = Object.keys(data.documents).length;

  return (
    <>
      <SectionCard title="Export" subtitle="Download your household’s data" icon={<Download size={17} />}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<FileJson size={18} />}
              disabled={busy !== null}
              onClick={() => run('json', async () => downloadBlob(await buildJsonExport(store.getState(), household.id), `${base}.json`))}
            >
              Export all data (JSON)
            </Button>
            <Typography variant="body2" color="text.secondary">
              Every record in {household.name}, without document files.
            </Typography>
          </Stack>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Spreadsheet exports (CSV)
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {csvExports.map((entry) => (
                <Button key={entry.key} size="small" variant="outlined" startIcon={<FileSpreadsheet size={16} />} onClick={entry.run} disabled={entry.count === 0}>
                  {entry.label} ({entry.count})
                </Button>
              ))}
            </Stack>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {documentCount > 0
              ? `Your ${documentCount} document file${documentCount === 1 ? ' is' : 's are'} included in backups below, and each can be downloaded from Documents.`
              : 'Document files are included in backups.'}
          </Typography>
        </Stack>
      </SectionCard>

      <SectionCard title="Backup & restore" icon={<DatabaseBackup size={17} />}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            A backup is a single file with everything in this household, including document files. Keep it somewhere safe —
            it isn’t encrypted. Invite links are not included.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<DatabaseBackup size={18} />}
              disabled={busy !== null}
              onClick={() => run('backup', async () => downloadBlob(await buildBackup(store.getState(), household.id), `${base}-backup.json`))}
            >
              {busy === 'backup' ? 'Preparing backup…' : 'Download backup'}
            </Button>
            <Button variant="outlined" startIcon={<Upload size={18} />} disabled={busy !== null} onClick={() => fileInput.current?.click()}>
              {busy === 'parse' ? 'Checking file…' : 'Restore from backup…'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              aria-hidden
              onChange={(event) => onFile(event.target.files?.[0])}
            />
          </Stack>
        </Stack>
      </SectionCard>

      <Dialog open={parsed !== null} onClose={() => busy === null && setParsed(null)} maxWidth="sm" fullWidth aria-labelledby="restore-title">
        <DialogTitle id="restore-title">{parsed?.ok ? `Restore ${parsed.summary.householdName}?` : 'This backup can’t be restored'}</DialogTitle>
        <DialogContent>
          {parsed && !parsed.ok && (
            <Alert severity="error">
              <Typography variant="body2" sx={{ mb: 1 }}>
                The file didn’t pass validation. Nothing was changed.
              </Typography>
              <List dense disablePadding>
                {parsed.errors.map((error) => (
                  <ListItem key={error} disableGutters sx={{ py: 0 }}>
                    <ListItemText primary={error} slotProps={{ primary: { variant: 'caption' } }} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
          {parsed?.ok && (
            <Stack spacing={2}>
              <Typography variant="body2">Backup created {formatTimestamp(parsed.summary.exportedAt)}. It contains:</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1 }}>
                {parsed.summary.counts.map((entry) => (
                  <Typography key={entry.label} variant="body2">
                    <strong>{entry.count}</strong> {entry.label.toLowerCase()}
                  </Typography>
                ))}
                <Typography variant="body2">
                  <strong>{parsed.summary.memberCount}</strong> members
                </Typography>
                <Typography variant="body2">
                  <strong>{parsed.summary.fileCount}</strong> files
                </Typography>
              </Box>
              {parsed.summary.existsLocally ? (
                canRestoreHere || parsed.backup.household.id !== household.id ? (
                  <Alert severity="warning">
                    This household already exists here. Restoring <strong>replaces all of its current data</strong> with the
                    backup. Only the owner can do this.
                  </Alert>
                ) : (
                  <Alert severity="error">Only the household owner can restore over existing data.</Alert>
                )
              ) : (
                <Alert severity="info">The household will be added to this device, with you as its owner.</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setParsed(null)} disabled={busy !== null}>
            {parsed?.ok ? 'Cancel' : 'Close'}
          </Button>
          {parsed?.ok && (
            <Button variant="contained" color={parsed.summary.existsLocally ? 'error' : 'primary'} onClick={confirmRestore} disabled={busy !== null}>
              {busy === 'restore' ? 'Restoring…' : parsed.summary.existsLocally ? 'Replace and restore' : 'Restore household'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
