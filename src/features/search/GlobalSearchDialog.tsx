import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  InputAdornment,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CalendarDays,
  CheckSquare,
  CornerDownLeft,
  FileText,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Wallet,
  Wrench,
  Refrigerator,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector, useToday } from '@/app/hooks';
import { searchToggled } from '@/store/uiSlice';
import { QUICK_ACTIONS } from '@/components/layout/QuickAddMenu';
import { quickAddOpened } from '@/store/uiSlice';
import { searchHousehold, type SearchGroup, type SearchResult } from './searchIndex';

const GROUP_ICONS: Record<SearchGroup, LucideIcon> = {
  Inventory: Package,
  Shopping: ShoppingCart,
  Tasks: CheckSquare,
  Bills: Receipt,
  Expenses: Wallet,
  Assets: Refrigerator,
  Maintenance: Wrench,
  Documents: FileText,
  Calendar: CalendarDays,
};

type Option =
  | { kind: 'result'; result: SearchResult }
  | { kind: 'action'; key: string; label: string; icon: LucideIcon; run: () => void };

/** Command palette: searches the active household and offers quick actions. */
export function GlobalSearchDialog() {
  const open = useAppSelector((state) => state.ui.searchOpen);
  const data = useAppSelector((state) => state.data);
  const canEdit = useAppSelector((state) => {
    const membership = Object.values(state.data.memberships).find(
      (entry) => entry.userId === state.session.activeUserId && entry.householdId === state.session.activeHouseholdId,
    );
    return membership?.role !== 'viewer';
  });
  const enabledModules = useAppSelector((state) =>
    state.session.activeHouseholdId ? state.data.households[state.session.activeHouseholdId]?.enabledModules : undefined,
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const today = useToday();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [active, setActive] = useState(0);
  const listId = useId();

  const close = () => {
    dispatch(searchToggled(false));
  };

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => (open ? searchHousehold(data, deferredQuery, today) : []), [open, data, deferredQuery, today]);

  const options: Option[] = useMemo(() => {
    if (deferredQuery.trim().length >= 2) return results.map((result) => ({ kind: 'result', result }));
    if (!canEdit) return [];
    return QUICK_ACTIONS.filter((action) => enabledModules?.includes(action.module) ?? true).map((action) => ({
      kind: 'action',
      key: action.kind,
      label: action.label,
      icon: action.icon,
      run: () => dispatch(quickAddOpened(action.kind)),
    }));
  }, [results, deferredQuery, canEdit, enabledModules, dispatch]);

  useEffect(() => setActive(0), [deferredQuery]);

  const choose = (option: Option) => {
    close();
    if (option.kind === 'result') navigate(option.result.to);
    else option.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const option = options[active];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const optionId = (index: number) => `${listId}-option-${index}`;
  let lastGroup: string | null = null;

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-label="Search household"
      slotProps={{ paper: { sx: { alignSelf: fullScreen ? 'stretch' : 'flex-start', mt: fullScreen ? 0 : '12vh' } } }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <InputBase
          autoFocus
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search items, tasks, bills, documents…"
          inputProps={{
            role: 'combobox',
            'aria-expanded': options.length > 0,
            'aria-controls': listId,
            'aria-activedescendant': options.length > 0 ? optionId(active) : undefined,
            'aria-autocomplete': 'list',
            'aria-label': 'Search household',
          }}
          startAdornment={
            <InputAdornment position="start">
              <Search size={18} aria-hidden />
            </InputAdornment>
          }
          endAdornment={
            fullScreen ? (
              <Typography component="button" onClick={close} variant="body2" sx={{ border: 0, bgcolor: 'transparent', color: 'primary.main', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </Typography>
            ) : undefined
          }
          sx={{ fontSize: '1rem', height: 40 }}
        />
      </Box>
      <Box sx={{ maxHeight: fullScreen ? undefined : '60vh', overflowY: 'auto', flex: 1 }}>
        {deferredQuery.trim().length >= 2 && options.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 6, px: 2, textAlign: 'center' }} role="status">
            <Typography sx={{ fontWeight: 600 }}>No results for “{deferredQuery.trim()}”</Typography>
            <Typography variant="body2" color="text.secondary">
              Try a different word, or check the spelling.
            </Typography>
          </Stack>
        ) : deferredQuery.trim().length < 2 && options.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            Type at least two characters to search this household.
          </Typography>
        ) : (
          <List id={listId} role="listbox" aria-label={deferredQuery.trim().length >= 2 ? 'Search results' : 'Quick actions'} dense sx={{ py: 1 }}>
            {deferredQuery.trim().length < 2 && (
              <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>
                Quick actions
              </ListSubheader>
            )}
            {options.map((option, index) => {
              const header =
                option.kind === 'result' && option.result.group !== lastGroup ? option.result.group : null;
              if (option.kind === 'result') lastGroup = option.result.group;
              const Icon = option.kind === 'result' ? GROUP_ICONS[option.result.group] : option.icon;
              return (
                <Box key={option.kind === 'result' ? `${option.result.group}-${option.result.id}` : option.key} role="presentation">
                  {header && (
                    <ListSubheader disableSticky role="presentation" sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>
                      {header}
                    </ListSubheader>
                  )}
                  <ListItemButton
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(option)}
                    sx={{ mx: 1, borderRadius: 2, minHeight: 44 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                      <Icon size={18} aria-hidden />
                    </ListItemIcon>
                    <ListItemText
                      primary={option.kind === 'result' ? option.result.title : option.label}
                      secondary={option.kind === 'result' ? option.result.subtitle : undefined}
                      slotProps={{ primary: { noWrap: true, fontWeight: 600 }, secondary: { noWrap: true } }}
                    />
                    {index === active && <CornerDownLeft size={14} aria-hidden />}
                  </ListItemButton>
                </Box>
              );
            })}
          </List>
        )}
      </Box>
      {!fullScreen && (
        <Stack direction="row" spacing={2} sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', color: 'text.secondary' }}>
          <Typography variant="caption">↑↓ to move</Typography>
          <Typography variant="caption">Enter to open</Typography>
          <Typography variant="caption">Esc to close</Typography>
        </Stack>
      )}
    </Dialog>
  );
}
