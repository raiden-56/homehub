import { Box } from '@mui/material';
import { File, FileImage, FileText, FileType2 } from 'lucide-react';
import { documentKind } from '../logic';

const ICONS = { pdf: FileType2, image: FileImage, text: FileText, other: File } as const;
const LABELS = { pdf: 'PDF', image: 'Image', text: 'Text', other: 'File' } as const;

/** Small file-type badge; the type is also exposed as text for assistive tech. */
export function FileTypeIcon({ mimeType, size = 40 }: { mimeType: string; size?: number }) {
  const kind = documentKind(mimeType);
  const Icon = ICONS[kind];
  return (
    <Box
      role="img"
      aria-label={`${LABELS[kind]} file`}
      sx={(theme) => ({
        width: size,
        height: size * 1.15,
        borderRadius: 1.5,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        backgroundColor: kind === 'pdf' ? theme.tokens.terracottaSoft : theme.tokens.sage,
        color: kind === 'pdf' ? theme.tokens.terracottaText : theme.tokens.sageText,
      })}
    >
      <Icon size={size * 0.5} aria-hidden />
    </Box>
  );
}
