import { Box, Stack, Typography } from '@mui/material';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 32 32"
      aria-hidden
      sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}
    >
      <rect width="32" height="32" rx="9" fill="#355E3B" />
      <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1z" fill="#F7F5EF" />
      <circle cx="22.5" cy="10" r="2" fill="#D5A044" />
    </Box>
  );
}

export function Logo({ subtitle, collapsed }: { subtitle?: string; collapsed?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <LogoMark />
      {!collapsed && (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.0625rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            HomeHub
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap component="p" sx={{ lineHeight: 1.3 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
}
