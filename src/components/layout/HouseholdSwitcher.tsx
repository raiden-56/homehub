import { useState } from 'react';
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { Check, ChevronsUpDown, Home, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useActiveHousehold, useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectMyHouseholds } from '@/store/selectors';
import { switchHousehold } from '@/data/actions';
import { toUserMessage } from '@/data/errors';
import { ROLE_LABELS } from '@/lib/permissions';
import { useToast } from '@/components/feedback/ToastProvider';
import { paths } from '@/app/paths';

/** Lists the households the active profile belongs to and switches between them. */
export function HouseholdSwitcher({ fullWidth, onSwitched }: { fullWidth?: boolean; onSwitched?: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const households = useAppSelector(selectMyHouseholds);
  const active = useActiveHousehold();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const choose = async (householdId: string) => {
    setAnchor(null);
    if (householdId === active?.id) return;
    try {
      await dispatch(switchHousehold(householdId));
      navigate(paths.overview());
      onSwitched?.();
    } catch (error) {
      toast.show({ message: toUserMessage(error), severity: 'error' });
    }
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={(event) => setAnchor(event.currentTarget)}
        endIcon={<ChevronsUpDown size={16} aria-hidden />}
        startIcon={<Home size={16} aria-hidden />}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        aria-label={`Household: ${active?.name ?? 'none'}. Switch household`}
        fullWidth={fullWidth}
        sx={{
          justifyContent: 'space-between',
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          maxWidth: fullWidth ? undefined : 240,
          '& .MuiButton-endIcon': { ml: 'auto', pl: 1 },
        }}
      >
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, textAlign: 'left' }}>
          {active?.name ?? 'Choose household'}
        </Typography>
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { minWidth: 260 } } }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 2, display: 'block' }}>
          Your households
        </Typography>
        {households.map(({ household, role }) => (
          <MenuItem key={household.id} onClick={() => choose(household.id)} selected={household.id === active?.id}>
            <ListItemIcon>{household.id === active?.id ? <Check size={16} /> : null}</ListItemIcon>
            <ListItemText
              primary={household.name}
              secondary={`${ROLE_LABELS[role]}${household.isDemo ? ' · Demo data' : ''}`}
            />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate(paths.onboarding());
          }}
        >
          <ListItemIcon>
            <Plus size={16} />
          </ListItemIcon>
          <ListItemText primary="Create a household" />
        </MenuItem>
      </Menu>
    </>
  );
}
