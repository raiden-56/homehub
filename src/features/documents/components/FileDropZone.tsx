import { useId, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Upload } from 'lucide-react';
import { ACCEPT_ATTRIBUTE, SUPPORTED_TYPES_LABEL } from '../logic';

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  error?: string | null;
  /** Main prompt, e.g. "Choose a file or drag it here". */
  label?: string;
}

/** Click, keyboard (Enter/Space) or drag-and-drop file chooser. Validation is done by the caller. */
export function FileDropZone({ onFiles, multiple, error, label }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const prompt = label ?? (multiple ? 'Choose files or drag them here' : 'Choose a file or drag it here');

  const handle = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <Box>
      <Box
        role="button"
        tabIndex={0}
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handle(event.dataTransfer.files);
        }}
        sx={(theme) => ({
          border: '2px dashed',
          borderColor: error ? theme.palette.error.main : dragging ? theme.palette.primary.main : theme.palette.divider,
          backgroundColor: dragging ? theme.tokens.sage : theme.tokens.surfaceMuted,
          borderRadius: 3,
          px: 2,
          py: 3,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 160ms ease, background-color 160ms ease',
          '&:hover': { borderColor: theme.palette.primary.main },
          '&:focus-visible': { outline: `2px solid ${theme.tokens.focus}`, outlineOffset: 2 },
        })}
      >
        <Box sx={{ color: 'primary.main', mb: 0.5 }}>
          <Upload size={22} aria-hidden />
        </Box>
        <Typography sx={{ fontWeight: 600 }}>{prompt}</Typography>
        <Typography id={hintId} variant="caption" color="text.secondary">
          {SUPPORTED_TYPES_LABEL} · up to 10 MB
        </Typography>
      </Box>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={ACCEPT_ATTRIBUTE}
        aria-label={prompt}
        onChange={(event) => {
          handle(event.target.files);
          event.target.value = '';
        }}
      />
      {error && (
        <Typography role="alert" variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
