import { Box, ButtonBase, Chip, Stack, Typography } from '@mui/material';
import { useAppSelector, useToday } from '@/app/hooks';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate } from '@/lib/dates';
import type { HouseholdDocument } from '@/types/models';
import { documentExpiryLabel, documentExpiryStatus, formatFileSize, resolveLink } from '../logic';
import { FileTypeIcon } from './FileTypeIcon';

export function DocumentRow({ document, onOpen }: { document: HouseholdDocument; onOpen: () => void }) {
  const data = useAppSelector((state) => state.data);
  const today = useToday();
  const expiry = documentExpiryStatus(document, today);
  const expiryLabel = documentExpiryLabel(document, today);
  const linked = document.links
    .map((link) => resolveLink(link, data, today))
    .filter((target): target is NonNullable<typeof target> => target !== null);

  return (
    <Box component="li" sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <ButtonBase
        onClick={onOpen}
        aria-label={`Open ${document.title}`}
        sx={{
          width: '100%',
          textAlign: 'left',
          px: 2,
          py: 1.5,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'flex-start',
          transition: 'background-color 140ms ease',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <FileTypeIcon mimeType={document.mimeType} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {document.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" noWrap>
            {document.category} · {formatFileSize(document.size)} · {document.fileName}
          </Typography>
          {(linked.length > 0 || expiryLabel) && (
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.75 }}>
              {expiryLabel && (
                <StatusChip
                  tone={expiry === 'expired' ? 'danger' : expiry === 'expiring' ? 'warning' : 'neutral'}
                  label={expiryLabel}
                />
              )}
              {linked.slice(0, 2).map((target) => (
                <Chip key={`${target.type}:${target.id}`} size="small" variant="outlined" label={target.label} sx={{ maxWidth: 180 }} />
              ))}
              {linked.length > 2 && <Chip size="small" variant="outlined" label={`+${linked.length - 2} more`} />}
            </Stack>
          )}
        </Box>
        <Stack alignItems="flex-end" spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' }, flexShrink: 0 }}>
          <MemberAvatar userId={document.uploadedBy} size={26} />
          <Typography variant="caption" color="text.secondary">
            {formatDate(document.createdAt.slice(0, 10), 'd MMM yyyy')}
          </Typography>
        </Stack>
      </ButtonBase>
    </Box>
  );
}
