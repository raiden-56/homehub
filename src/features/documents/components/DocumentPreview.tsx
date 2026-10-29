import { useEffect, useState } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { FileQuestion } from 'lucide-react';
import { getDocumentBlob } from '@/data/db';
import type { HouseholdDocument } from '@/types/models';
import { documentKind, TEXT_PREVIEW_BYTES } from '../logic';

type PreviewState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'url'; url: string }
  | { status: 'text'; text: string; truncated: boolean };

/** Renders an in-browser preview of a stored file. Object URLs are revoked on unmount. */
export function DocumentPreview({ document }: { document: Pick<HouseholdDocument, 'id' | 'mimeType' | 'title'> }) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const kind = documentKind(document.mimeType);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setState({ status: 'loading' });
    getDocumentBlob(document.id)
      .then(async (record) => {
        if (cancelled) return;
        if (!record || !(record.blob instanceof Blob)) {
          setState({ status: 'missing' });
          return;
        }
        if (kind === 'text') {
          const text = await record.blob.slice(0, TEXT_PREVIEW_BYTES).text();
          if (!cancelled) setState({ status: 'text', text, truncated: record.blob.size > TEXT_PREVIEW_BYTES });
          return;
        }
        const blob = record.blob.type ? record.blob : new Blob([record.blob], { type: document.mimeType });
        url = URL.createObjectURL(blob);
        setState({ status: 'url', url });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [document.id, document.mimeType, kind, attempt]);

  const frame = { borderRadius: 3, border: 1, borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.default' } as const;

  if (state.status === 'loading') {
    return (
      <Box role="status" aria-label="Loading preview">
        <Skeleton variant="rounded" height={kind === 'text' ? 160 : 280} />
      </Box>
    );
  }
  if (state.status === 'missing') {
    return (
      <Stack alignItems="center" spacing={1} sx={{ ...frame, py: 4, px: 2, textAlign: 'center' }} role="alert">
        <FileQuestion size={24} aria-hidden />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          The file couldn’t be loaded
        </Typography>
        <Typography variant="caption" color="text.secondary">
          It may have been removed from this browser’s storage.
        </Typography>
        <Button size="small" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </Button>
      </Stack>
    );
  }
  if (state.status === 'text') {
    return (
      <Box sx={frame}>
        <Box
          component="pre"
          tabIndex={0}
          aria-label={`Text preview of ${document.title}`}
          sx={{ m: 0, p: 2, maxHeight: 360, overflow: 'auto', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {state.text}
        </Box>
        {state.truncated && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pb: 1 }}>
            Showing the first 200 KB. Download the file to see everything.
          </Typography>
        )}
      </Box>
    );
  }
  if (kind === 'image') {
    return (
      <Box sx={{ ...frame, display: 'grid', placeItems: 'center' }}>
        <Box component="img" src={state.url} alt={`Preview of ${document.title}`} sx={{ maxWidth: '100%', maxHeight: 420, display: 'block' }} />
      </Box>
    );
  }
  if (kind === 'pdf') {
    return (
      <Box sx={frame}>
        <Box component="iframe" src={state.url} title={`Preview of ${document.title}`} sx={{ width: '100%', height: { xs: 360, sm: 460 }, border: 0, display: 'block' }} />
      </Box>
    );
  }
  return (
    <Typography variant="body2" color="text.secondary">
      Preview isn’t available for this file type. Download it to view.
    </Typography>
  );
}
