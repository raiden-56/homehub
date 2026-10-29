import { Stack } from '@mui/material';
import { AlertCircle, Archive, CalendarClock, PackageX, TrendingDown } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import type { InventoryItem } from '@/types/models';
import { relativeDay } from '@/lib/dates';
import { EXPIRY_LABELS, STOCK_LABELS, expiryStatus, stockStatus } from '../logic';

interface InventoryStatusChipsProps {
  item: InventoryItem;
  today: string;
  warningDays: number;
  /** Also show a positive "In stock" chip when nothing needs attention. */
  showOk?: boolean;
}

/** Stock and expiry status, always as labelled chips (never colour alone). */
export function InventoryStatusChips({ item, today, warningDays, showOk }: InventoryStatusChipsProps) {
  const stock = stockStatus(item);
  const expiry = expiryStatus(item, today, warningDays);
  const chips = [];
  if (item.archived) chips.push(<StatusChip key="archived" tone="neutral" label="Archived" icon={<Archive />} />);
  if (stock === 'out') chips.push(<StatusChip key="stock" tone="danger" label={STOCK_LABELS.out} icon={<PackageX />} />);
  if (stock === 'low') chips.push(<StatusChip key="stock" tone="warning" label={STOCK_LABELS.low} icon={<TrendingDown />} />);
  if (expiry === 'expired') chips.push(<StatusChip key="expiry" tone="danger" label={EXPIRY_LABELS.expired} icon={<AlertCircle />} />);
  if (expiry === 'soon' && item.expiryDate) {
    chips.push(
      <StatusChip
        key="expiry"
        tone="terracotta"
        label={`Expires ${relativeDay(item.expiryDate, today).toLowerCase()}`}
        icon={<CalendarClock />}
      />,
    );
  }
  if (chips.length === 0 && showOk) chips.push(<StatusChip key="ok" tone="success" label={STOCK_LABELS.ok} />);
  if (chips.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
      {chips}
    </Stack>
  );
}
