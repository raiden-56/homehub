import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Snackbar, useMediaQuery, useTheme } from '@mui/material';

export interface ToastOptions {
  message: string;
  severity?: 'success' | 'info' | 'warning' | 'error';
  action?: { label: string; onClick: () => void };
  /** Milliseconds; errors stay longer by default. */
  duration?: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface QueuedToast extends ToastOptions {
  key: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [current, setCurrent] = useState<QueuedToast | null>(null);
  const [open, setOpen] = useState(false);
  const queue = useRef<QueuedToast[]>([]);
  const counter = useRef(0);

  const showNext = useCallback(() => {
    const next = queue.current.shift();
    if (next) {
      setCurrent(next);
      setOpen(true);
    } else {
      setCurrent(null);
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      counter.current += 1;
      const toast = { ...options, key: counter.current };
      if (open || current) {
        queue.current.push(toast);
        setOpen(false);
      } else {
        setCurrent(toast);
        setOpen(true);
      }
    },
    [open, current],
  );

  const value = useMemo(() => ({ show }), [show]);
  const severity = current?.severity ?? 'info';

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={current?.duration ?? (severity === 'error' ? 8000 : current?.action ? 6000 : 3500)}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setOpen(false);
        }}
        slotProps={{ transition: { onExited: showNext } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'left' }}
        sx={{ bottom: { xs: 'calc(76px + env(safe-area-inset-bottom))', md: 24 } }}
      >
        <Alert
          variant="filled"
          severity={severity}
          onClose={() => setOpen(false)}
          action={
            current?.action ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  current.action?.onClick();
                  setOpen(false);
                }}
              >
                {current.action.label}
              </Button>
            ) : undefined
          }
          sx={{ minWidth: { sm: 320 }, maxWidth: 520, boxShadow: 3 }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
