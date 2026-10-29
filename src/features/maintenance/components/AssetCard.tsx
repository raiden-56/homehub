import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate, relativeDay } from '@/lib/dates';
import type { Asset, MaintenanceTask } from '@/types/models';
import { WARRANTY_LABELS, warrantyStatus } from '../logic';
import { AssetIcon, WARRANTY_TONES, useLeadDays } from '../ui';

export function AssetCard({ asset, nextTask }: { asset: Asset; nextTask?: MaintenanceTask }) {
  const today = useToday();
  const leadDays = useLeadDays();
  const warranty = warrantyStatus(asset, today, leadDays.warranty);
  const warrantyText =
    warranty === 'none'
      ? WARRANTY_LABELS.none
      : `${warranty === 'expired' ? 'Warranty ended' : 'Warranty until'} ${formatDate(asset.warrantyExpiry!, 'd MMM yyyy')}`;

  return (
    <Card
      sx={{
        height: '100%',
        opacity: asset.archived ? 0.75 : 1,
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        '&:hover': { borderColor: 'primary.main', boxShadow: '0 6px 18px rgba(36, 69, 45, 0.08)' },
      }}
    >
      <CardActionArea component={RouterLink} to={paths.asset(asset.id)} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <AssetIcon category={asset.category} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 650 }} noWrap>
              {asset.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" noWrap>
              {[asset.manufacturer, asset.model].filter(Boolean).join(' ') || asset.category}
              {asset.location ? ` · ${asset.location}` : ''}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 0.75 }}>
          <StatusChip tone={WARRANTY_TONES[warranty]} label={warranty === 'none' ? WARRANTY_LABELS.none : WARRANTY_LABELS[warranty]} />
          {asset.archived && <StatusChip tone="neutral" label="Archived" />}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {warrantyText}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {nextTask
            ? `Next: ${nextTask.name} · ${relativeDay(nextTask.dueDate, today).toLowerCase()}`
            : 'No maintenance scheduled'}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
