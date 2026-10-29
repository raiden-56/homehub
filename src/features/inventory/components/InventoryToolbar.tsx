import { Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { LayoutGrid, List as ListIcon, X } from 'lucide-react';
import { SearchField } from '@/components/ui/SearchField';
import type { InventoryCategory, InventoryLocation } from '@/types/models';
import { SORT_LABELS, type InventoryFilterState, type InventorySort } from '../logic';

export type InventoryViewMode = 'list' | 'grid';

interface InventoryToolbarProps {
  filters: InventoryFilterState;
  sort: InventorySort;
  view: InventoryViewMode;
  categories: InventoryCategory[];
  locations: InventoryLocation[];
  onChange: (key: string, value: string | undefined) => void;
  onViewChange: (view: InventoryViewMode) => void;
  onClear: () => void;
  hasFilters: boolean;
}

/** Search, filters, sort and view toggle. Filter values live in the URL. */
export function InventoryToolbar({
  filters,
  sort,
  view,
  categories,
  locations,
  onChange,
  onViewChange,
  onClear,
  hasFilters,
}: InventoryToolbarProps) {
  const select = (label: string, key: string, value: string | undefined, options: { value: string; label: string }[], allLabel: string) => (
    <TextField
      select
      label={label}
      value={value ?? ''}
      onChange={(event) => onChange(key, event.target.value || undefined)}
      sx={{ minWidth: { sm: 150 } }}
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <SearchField
          value={filters.q}
          onChange={(value) => onChange('q', value || undefined)}
          placeholder="Search by name, barcode or note"
          label="Search inventory"
          sx={{ maxWidth: { md: 360 } }}
        />
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filters.archived ? 'archived' : 'active'}
            onChange={(_, value: string | null) => value && onChange('archived', value === 'archived' ? '1' : undefined)}
            aria-label="Show active or archived items"
          >
            <ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="archived">Archived</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: InventoryViewMode | null) => value && onViewChange(value)}
            aria-label="Layout"
          >
            <ToggleButton value="list" aria-label="List view" title="List view">
              <ListIcon size={16} />
            </ToggleButton>
            <ToggleButton value="grid" aria-label="Grid view" title="Grid view">
              <LayoutGrid size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(5, minmax(0, 1fr)) auto' },
          alignItems: 'center',
        }}
      >
        {select('Category', 'category', filters.category, categories.map((c) => ({ value: c.id, label: c.name })), 'All categories')}
        {select('Location', 'location', filters.location, locations.map((l) => ({ value: l.id, label: l.name })), 'All locations')}
        {select(
          'Stock',
          'stock',
          filters.stock,
          [
            { value: 'low', label: 'Low or out' },
            { value: 'out', label: 'Out of stock' },
          ],
          'Any stock level',
        )}
        {select(
          'Expiry',
          'expiry',
          filters.expiry,
          [
            { value: 'soon', label: 'Expiring soon' },
            { value: 'expired', label: 'Expired' },
          ],
          'Any expiry',
        )}
        <TextField select label="Sort by" value={sort} onChange={(event) => onChange('sort', event.target.value === 'name' ? undefined : event.target.value)}>
          {(Object.keys(SORT_LABELS) as InventorySort[]).map((key) => (
            <MenuItem key={key} value={key}>
              {SORT_LABELS[key]}
            </MenuItem>
          ))}
        </TextField>
        {hasFilters && (
          <Button color="inherit" startIcon={<X size={16} />} onClick={onClear} sx={{ justifySelf: 'start' }}>
            Clear filters
          </Button>
        )}
      </Box>
    </Stack>
  );
}
