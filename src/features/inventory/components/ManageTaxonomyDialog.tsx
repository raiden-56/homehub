import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useActiveHousehold, useCan, useCollection, useCommit } from '@/app/hooks';
import type { InventoryCategory, InventoryLocation } from '@/types/models';
import { newId, nowIso } from '@/lib/ids';
import { useTaxonomy } from '../hooks';

type Kind = 'categories' | 'locations';

const COPY: Record<Kind, { singular: string; collection: 'inventoryCategories' | 'inventoryLocations' }> = {
  categories: { singular: 'category', collection: 'inventoryCategories' },
  locations: { singular: 'location', collection: 'inventoryLocations' },
};

/** Add, rename and remove inventory categories and storage locations. */
export function ManageTaxonomyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState<Kind>('categories');
  const { categories, locations } = useTaxonomy();
  const items = useCollection('inventoryItems');
  const household = useActiveHousehold();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries: (InventoryCategory | InventoryLocation)[] = tab === 'categories' ? categories : locations;
  const usage = (id: string) => items.filter((item) => (tab === 'categories' ? item.categoryId : item.locationId) === id).length;
  const { singular, collection } = COPY[tab];

  const validate = (name: string, exceptId?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return `Enter a ${singular} name`;
    if (trimmed.length > 40) return 'Use 40 characters or fewer';
    if (entries.some((entry) => entry.id !== exceptId && entry.name.toLowerCase() === trimmed.toLowerCase())) {
      return `That ${singular} already exists`;
    }
    return null;
  };

  const add = async () => {
    if (!household) return;
    const problem = validate(draft);
    setError(problem);
    if (problem) return;
    const now = nowIso();
    const record = { id: newId(), householdId: household.id, name: draft.trim(), createdAt: now, updatedAt: now };
    const ok = await commit({ put: { [collection]: [record] } }, { success: `Added “${record.name}”` });
    if (ok) setDraft('');
  };

  const rename = async () => {
    if (!editing) return;
    const problem = validate(editing.name, editing.id);
    setError(problem);
    if (problem) return;
    const existing = entries.find((entry) => entry.id === editing.id);
    if (!existing) return;
    const ok = await commit(
      { put: { [collection]: [{ ...existing, name: editing.name.trim(), updatedAt: nowIso() }] } },
      { success: `Renamed to “${editing.name.trim()}”` },
    );
    if (ok) setEditing(null);
  };

  const remove = async (entry: InventoryCategory | InventoryLocation) => {
    await commit(
      { remove: { [collection]: [entry.id] } },
      { success: `Removed “${entry.name}”`, undo: { put: { [collection]: [entry] } } },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm" aria-labelledby="taxonomy-title">
      <DialogTitle id="taxonomy-title">Categories & storage locations</DialogTitle>
      <DialogContent>
        <Tabs
          value={tab}
          onChange={(_, value: Kind) => {
            setTab(value);
            setEditing(null);
            setError(null);
            setDraft('');
          }}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="categories" label={`Categories (${categories.length})`} />
          <Tab value="locations" label={`Locations (${locations.length})`} />
        </Tabs>
        {canEdit && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} component="form" onSubmit={(event) => { event.preventDefault(); void add(); }}>
            <TextField
              label={`New ${singular}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              error={!!error && !editing}
              helperText={!editing ? error ?? undefined : undefined}
            />
            <Button type="submit" variant="contained" startIcon={<Plus size={16} />} sx={{ flexShrink: 0, alignSelf: 'flex-start' }}>
              Add
            </Button>
          </Stack>
        )}
        <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {entries.map((entry) => {
            const count = usage(entry.id);
            const isEditing = editing?.id === entry.id;
            return (
              <Stack
                key={entry.id}
                component="li"
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', minHeight: 52 }}
              >
                {isEditing ? (
                  <TextField
                    autoFocus
                    label="Name"
                    value={editing.name}
                    onChange={(event) => setEditing({ id: entry.id, name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void rename();
                      if (event.key === 'Escape') setEditing(null);
                    }}
                    error={!!error}
                    helperText={error ?? undefined}
                  />
                ) : (
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {entry.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {count === 0 ? 'Not used' : `${count} item${count === 1 ? '' : 's'}`}
                    </Typography>
                  </Box>
                )}
                {canEdit &&
                  (isEditing ? (
                    <>
                      <IconButton aria-label="Save name" onClick={() => void rename()}>
                        <Check size={18} />
                      </IconButton>
                      <IconButton aria-label="Cancel rename" onClick={() => { setEditing(null); setError(null); }}>
                        <X size={18} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton aria-label={`Rename ${entry.name}`} onClick={() => { setEditing({ id: entry.id, name: entry.name }); setError(null); }}>
                        <Pencil size={16} />
                      </IconButton>
                      <Tooltip title={count > 0 ? `In use by ${count} item${count === 1 ? '' : 's'} — move them first` : `Delete ${singular}`}>
                        <span>
                          <IconButton aria-label={`Delete ${entry.name}`} onClick={() => void remove(entry)} disabled={count > 0}>
                            <Trash2 size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  ))}
              </Stack>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
