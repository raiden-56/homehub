import { useState } from 'react';
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Archive, ArchiveRestore, MinusCircle, MoreVertical, Pencil, PlusCircle, ShoppingCart, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { InventoryItem } from '@/types/models';
import type { AdjustMode } from './AdjustQuantityDialog';

export interface ItemActionHandlers {
  onEdit: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem, mode: AdjustMode) => void;
  onAddToList: (items: InventoryItem[]) => void;
  onArchive: (items: InventoryItem[]) => void;
  onRestore: (items: InventoryItem[]) => void;
  onDelete: (items: InventoryItem[]) => void;
}

/** Overflow menu with every action available on a single inventory item. */
export function ItemActionsMenu({ item, handlers }: { item: InventoryItem; handlers: ItemActionHandlers }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const run = (action: () => void) => () => {
    setAnchor(null);
    action();
  };
  return (
    <>
      <IconButton
        aria-label={`More actions for ${item.name}`}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertical size={18} />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={(event) => event.stopPropagation()}>
        {!item.archived && [
          <MenuItem key="consume" onClick={run(() => handlers.onAdjust(item, 'consume'))}>
            <ListItemIcon><MinusCircle size={16} /></ListItemIcon>
            <ListItemText primary="Record use" />
          </MenuItem>,
          <MenuItem key="restock" onClick={run(() => handlers.onAdjust(item, 'restock'))}>
            <ListItemIcon><PlusCircle size={16} /></ListItemIcon>
            <ListItemText primary="Restock" />
          </MenuItem>,
          <MenuItem key="adjust" onClick={run(() => handlers.onAdjust(item, 'adjust'))}>
            <ListItemIcon><SlidersHorizontal size={16} /></ListItemIcon>
            <ListItemText primary="Set exact quantity" />
          </MenuItem>,
          <MenuItem key="list" onClick={run(() => handlers.onAddToList([item]))}>
            <ListItemIcon><ShoppingCart size={16} /></ListItemIcon>
            <ListItemText primary="Add to shopping list" />
          </MenuItem>,
          <Divider key="divider" />,
        ]}
        <MenuItem onClick={run(() => handlers.onEdit(item))}>
          <ListItemIcon><Pencil size={16} /></ListItemIcon>
          <ListItemText primary="Edit" />
        </MenuItem>
        {item.archived ? (
          <MenuItem onClick={run(() => handlers.onRestore([item]))}>
            <ListItemIcon><ArchiveRestore size={16} /></ListItemIcon>
            <ListItemText primary="Restore" />
          </MenuItem>
        ) : (
          <MenuItem onClick={run(() => handlers.onArchive([item]))}>
            <ListItemIcon><Archive size={16} /></ListItemIcon>
            <ListItemText primary="Archive" />
          </MenuItem>
        )}
        <MenuItem onClick={run(() => handlers.onDelete([item]))} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={16} /></ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>
    </>
  );
}
