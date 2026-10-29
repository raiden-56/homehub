import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Archive, ArchiveRestore, Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ShoppingList } from '@/types/models';
import { paths } from '@/app/paths';
import { useListActions } from '../listActions';

interface ListActionsMenuProps {
  list: ShoppingList;
  onRename: () => void;
  /** Called after the list is deleted (e.g. to leave its page). */
  onDeleted?: () => void;
}

export function ListActionsMenu({ list, onRename, onDeleted }: ListActionsMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const actions = useListActions();
  const navigate = useNavigate();
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        aria-label={`Actions for ${list.name}`}
        aria-haspopup="menu"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertical size={18} />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} onClick={(event) => event.stopPropagation()}>
        <MenuItem onClick={() => { close(); onRename(); }}>
          <ListItemIcon><Pencil size={16} /></ListItemIcon>
          <ListItemText primary="Rename" />
        </MenuItem>
        <MenuItem
          onClick={async () => {
            close();
            const id = await actions.duplicate(list);
            if (id) navigate(paths.shoppingList(id));
          }}
        >
          <ListItemIcon><Copy size={16} /></ListItemIcon>
          <ListItemText primary="Duplicate" secondary="Copies items still to buy" />
        </MenuItem>
        <MenuItem onClick={() => { close(); void actions.setArchived(list, !list.archived); }}>
          <ListItemIcon>{list.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</ListItemIcon>
          <ListItemText primary={list.archived ? 'Restore' : 'Archive'} />
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={async () => {
            close();
            if (await actions.remove(list)) onDeleted?.();
          }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={16} /></ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>
    </>
  );
}
