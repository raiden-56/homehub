import { useEffect, useState } from 'react';
import { IconButton, InputAdornment, TextField, type SxProps, type Theme } from '@mui/material';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Debounce delay before `onChange` fires. */
  delay?: number;
  label?: string;
  sx?: SxProps<Theme>;
}

/** Debounced search input with a clear button. */
export function SearchField({ value, onChange, placeholder = 'Search', delay = 200, label, sx }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) return;
    const id = window.setTimeout(() => onChange(draft), delay);
    return () => window.clearTimeout(id);
  }, [draft, value, delay, onChange]);

  return (
    <TextField
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      sx={sx}
      type="search"
      slotProps={{
        htmlInput: { 'aria-label': label ?? placeholder },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} aria-hidden />
            </InputAdornment>
          ),
          endAdornment: draft ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="Clear search"
                onClick={() => {
                  setDraft('');
                  onChange('');
                }}
                edge="end"
              >
                <X size={14} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}
