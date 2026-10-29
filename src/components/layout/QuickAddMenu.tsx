import { useState } from 'react';
import {
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CalendarPlus,
  CheckSquare,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useActiveHousehold, useAppDispatch, useCan } from '@/app/hooks';
import { quickAddOpened, type QuickAddKind } from '@/store/uiSlice';
import type { ModuleKey } from '@/types/models';

export const QUICK_ACTIONS: { kind: QuickAddKind; label: string; icon: LucideIcon; module: ModuleKey }[] = [
  { kind: 'inventoryItem', label: 'Add inventory item', icon: Package, module: 'inventory' },
  { kind: 'shoppingItem', label: 'Add shopping item', icon: ShoppingCart, module: 'shopping' },
  { kind: 'task', label: 'Create task', icon: CheckSquare, module: 'tasks' },
  { kind: 'expense', label: 'Record expense', icon: Wallet, module: 'finance' },
  { kind: 'bill', label: 'Add bill', icon: Receipt, module: 'finance' },
  { kind: 'maintenance', label: 'Schedule maintenance', icon: Wrench, module: 'maintenance' },
  { kind: 'event', label: 'Create calendar event', icon: CalendarPlus, module: 'calendar' },
];

export function QuickAddMenu({ label = 'Add new' }: { label?: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const dispatch = useAppDispatch();
  const canEdit = useCan('edit');
  const household = useActiveHousehold();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const actions = QUICK_ACTIONS.filter((action) => household?.enabledModules.includes(action.module) ?? true);

  const trigger = compact ? (
    <IconButton
      color="primary"
      onClick={(event) => setAnchor(event.currentTarget)}
      aria-label={label}
      aria-haspopup="menu"
      disabled={!canEdit}
      sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
    >
      <Plus size={20} />
    </IconButton>
  ) : (
    <Button
      variant="contained"
      startIcon={<Plus size={18} />}
      onClick={(event) => setAnchor(event.currentTarget)}
      aria-haspopup="menu"
      disabled={!canEdit}
    >
      {label}
    </Button>
  );

  return (
    <>
      {canEdit ? (
        trigger
      ) : (
        <Tooltip title="Viewers can’t add records">
          <span>{trigger}</span>
        </Tooltip>
      )}
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 0.5 } } }}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <MenuItem
              key={action.kind}
              onClick={() => {
                setAnchor(null);
                dispatch(quickAddOpened(action.kind));
              }}
            >
              <ListItemIcon>
                <Icon size={17} />
              </ListItemIcon>
              <ListItemText primary={action.label} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
