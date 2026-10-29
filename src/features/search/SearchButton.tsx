import { useEffect } from 'react';
import { Box, ButtonBase, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Search } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { searchToggled } from '@/store/uiSlice';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Opens global search; also binds Ctrl/⌘+K. */
export function SearchButton() {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        dispatch(searchToggled(true));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const open = () => dispatch(searchToggled(true));

  if (!wide) {
    return (
      <Tooltip title="Search">
        <IconButton onClick={open} aria-label="Search household" aria-keyshortcuts="Control+K Meta+K">
          <Search size={20} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <ButtonBase
      onClick={open}
      aria-label="Search household"
      aria-keyshortcuts="Control+K Meta+K"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: 260,
        height: 38,
        px: 1.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.secondary',
        justifyContent: 'flex-start',
        transition: 'border-color 160ms ease',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Search size={16} aria-hidden />
      <Typography variant="body2" sx={{ flex: 1, textAlign: 'left' }}>
        Search everything…
      </Typography>
      <Box
        component="kbd"
        sx={{ fontFamily: 'inherit', fontSize: 11, px: 0.75, py: 0.25, borderRadius: 1, border: 1, borderColor: 'divider' }}
      >
        {isMac ? '⌘K' : 'Ctrl K'}
      </Box>
    </ButtonBase>
  );
}
