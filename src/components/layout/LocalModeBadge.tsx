import { useState } from 'react';
import {
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { HardDrive } from 'lucide-react';
import { useActiveHousehold } from '@/app/hooks';

/**
 * Persistent, honest indicator that the app runs in local mode: data lives in this browser,
 * profiles are not password protected, and nothing syncs between devices.
 */
export function LocalModeBadge({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const household = useActiveHousehold();
  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        aria-label="About local mode"
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: compact ? 1 : 1.25,
          py: 0.75,
          borderRadius: 2,
          backgroundColor: theme.tokens.amberSoft,
          color: theme.tokens.amberText,
          textAlign: 'left',
          width: compact ? undefined : '100%',
        })}
      >
        <HardDrive size={15} aria-hidden />
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {compact ? 'Local' : household?.isDemo ? 'Local demo mode · sample data' : 'Local mode · this browser only'}
        </Typography>
      </ButtonBase>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth aria-labelledby="local-mode-title">
        <DialogTitle id="local-mode-title">About local mode</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              HomeHub is running without a server. Everything you enter is saved in this browser’s private storage
              (IndexedDB) and survives reloads.
            </Typography>
            <Typography variant="body2">
              <strong>Not synchronised:</strong> changes appear in other HomeHub tabs in this browser, but not on other
              devices.
            </Typography>
            <Typography variant="body2">
              <strong>Not secured:</strong> profiles have no passwords. Anyone using this browser profile can open them.
              Role permissions are enforced by the app’s data layer, but local data is not protected from someone with
              access to this device.
            </Typography>
            {household?.isDemo && (
              <Typography variant="body2">
                <strong>{household.name}</strong> contains sample data so you can explore. You can delete it from
                Settings → Data.
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Use Settings → Data to export a backup file.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
