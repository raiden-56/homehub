import { Box, Card, Skeleton, Stack } from '@mui/material';

/**
 * Loading placeholders. Each mirrors the layout of the content it stands in for, so swapping
 * to real data does not shift the page.
 */

function Rows({ count, children }: { count: number; children: (index: number) => React.ReactNode }) {
  return <>{Array.from({ length: count }, (_, index) => children(index))}</>;
}

function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box role="status" aria-live="polite" aria-busy="true">
      <Box component="span" sx={visuallyHidden}>
        {label}
      </Box>
      {children}
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export function DashboardMetricSkeleton() {
  return (
    <Card sx={{ p: 2, height: '100%' }} aria-hidden>
      <Stack direction="row" spacing={1.5}>
        <Skeleton variant="rounded" width={36} height={36} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="45%" height={30} />
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={14} />
        </Box>
      </Stack>
    </Card>
  );
}

export function DashboardChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Card sx={{ p: 2.5 }} aria-hidden>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Skeleton width={160} height={24} />
        <Skeleton variant="rounded" width={110} height={32} />
      </Stack>
      <Stack direction="row" alignItems="flex-end" spacing={1.5} sx={{ height }}>
        {[55, 80, 45, 95, 70, 60].map((value, index) => (
          <Skeleton key={index} variant="rounded" sx={{ flex: 1, height: `${value}%` }} />
        ))}
      </Stack>
    </Card>
  );
}

export function InventoryRowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading inventory">
      <Rows count={rows}>
        {(index) => (
          <Stack
            key={index}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Skeleton variant="rounded" width={20} height={20} />
            <Box sx={{ flex: 2 }}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="35%" height={14} />
            </Box>
            <Skeleton sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} height={20} />
            <Skeleton sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} height={20} />
            <Skeleton variant="rounded" width={72} height={24} />
          </Stack>
        )}
      </Rows>
    </LoadingRegion>
  );
}

export function InventoryCardSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <LoadingRegion label="Loading inventory">
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        <Rows count={cards}>
          {(index) => (
            <Card key={index} sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Skeleton width="55%" height={22} />
                <Skeleton variant="rounded" width={60} height={22} />
              </Stack>
              <Skeleton width="40%" height={16} />
              <Skeleton width="30%" height={34} sx={{ mt: 1.5 }} />
              <Skeleton variant="rounded" height={8} sx={{ mt: 1 }} />
            </Card>
          )}
        </Rows>
      </Box>
    </LoadingRegion>
  );
}

export function ShoppingListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading shopping list">
      <Rows count={rows}>
        {(index) => (
          <Stack key={index} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.25 }}>
            <Skeleton variant="rounded" width={22} height={22} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width={`${50 + ((index * 13) % 30)}%`} height={20} />
              <Skeleton width="25%" height={14} />
            </Box>
            <Skeleton width={56} height={20} />
          </Stack>
        )}
      </Rows>
    </LoadingRegion>
  );
}

export function TaskListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading tasks">
      <Rows count={rows}>
        {(index) => (
          <Stack
            key={index}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Skeleton variant="circular" width={22} height={22} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width={`${45 + ((index * 17) % 35)}%`} height={20} />
              <Stack direction="row" spacing={1}>
                <Skeleton width={70} height={14} />
                <Skeleton width={50} height={14} />
              </Stack>
            </Box>
            <Skeleton variant="rounded" width={56} height={22} />
            <Skeleton variant="circular" width={28} height={28} />
          </Stack>
        )}
      </Rows>
    </LoadingRegion>
  );
}

export function BillListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading bills">
      <Rows count={rows}>
        {(index) => (
          <Stack
            key={index}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Skeleton variant="rounded" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="45%" height={20} />
              <Skeleton width="30%" height={14} />
            </Box>
            <Skeleton width={72} height={22} />
            <Skeleton variant="rounded" width={70} height={24} />
          </Stack>
        )}
      </Rows>
    </LoadingRegion>
  );
}

export function AssetCardSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <LoadingRegion label="Loading assets">
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        <Rows count={cards}>
          {(index) => (
            <Card key={index} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5}>
                <Skeleton variant="rounded" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="65%" height={22} />
                  <Skeleton width="45%" height={16} />
                </Box>
              </Stack>
              <Skeleton variant="rounded" width={110} height={24} sx={{ mt: 2 }} />
              <Skeleton width="55%" height={16} sx={{ mt: 1 }} />
            </Card>
          )}
        </Rows>
      </Box>
    </LoadingRegion>
  );
}

export function CalendarSkeleton() {
  return (
    <LoadingRegion label="Loading calendar">
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
          <Skeleton width={180} height={30} />
          <Skeleton variant="rounded" width={200} height={34} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
          <Rows count={35}>
            {(index) => <Skeleton key={index} variant="rounded" sx={{ height: { xs: 52, md: 92 } }} />}
          </Rows>
        </Box>
      </Card>
    </LoadingRegion>
  );
}

export function DocumentListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading documents">
      <Rows count={rows}>
        {(index) => (
          <Stack
            key={index}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Skeleton variant="rounded" width={40} height={48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="50%" height={20} />
              <Skeleton width="30%" height={14} />
            </Box>
            <Skeleton width={80} height={18} sx={{ display: { xs: 'none', sm: 'block' } }} />
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>
        )}
      </Rows>
    </LoadingRegion>
  );
}

/** Generic page placeholder used while a lazily-loaded route chunk downloads. */
export function PageSkeleton() {
  return (
    <LoadingRegion label="Loading page">
      <Skeleton width={220} height={38} />
      <Skeleton width={320} height={20} sx={{ mb: 3 }} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
        <DashboardMetricSkeleton />
        <DashboardMetricSkeleton />
        <DashboardMetricSkeleton />
      </Box>
      <Card sx={{ mt: 2 }}>
        <TaskListSkeleton rows={4} />
      </Card>
    </LoadingRegion>
  );
}
