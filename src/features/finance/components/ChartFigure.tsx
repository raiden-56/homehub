import { useId, useState, type ReactNode } from 'react';
import { Box, Button, Collapse, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import { chartOther, chartSeries, chartSeriesDark } from '@/theme/tokens';
import { useCurrency } from '@/app/hooks';
import { formatMoney, minorUnitDigits } from '@/lib/money';

/** Categorical series colours (assign in order; fold anything past the sixth into the "other" colour). */
export function useChartColors(): string[] {
  const theme = useTheme();
  return theme.palette.mode === 'dark' ? chartSeriesDark : chartSeries;
}

export function useChartOtherColor(): string {
  const theme = useTheme();
  return theme.palette.mode === 'dark' ? chartOther.dark : chartOther.light;
}

interface ChartFigureProps {
  /** Short text summary read by screen readers and shown beneath the chart. */
  summary: string;
  height: number;
  children: ReactNode;
  /** Data table alternative, revealed with a toggle. */
  table?: { columns: string[]; rows: ReactNode[][] };
}

/** Formats a major-unit chart axis value (from `toMajor`) as compact money. */
export function useAxisMoney(): (major: number) => string {
  const currency = useCurrency();
  return (major: number) => formatMoney(Math.round(major * 10 ** minorUnitDigits(currency)), currency, { compact: true });
}

/** Wraps a chart with an accessible label, a visible text summary and an optional data table. */
export function ChartFigure({ summary, height, children, table }: ChartFigureProps) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Box role="img" aria-label={summary} sx={{ width: '100%', height }}>
        {children}
      </Box>
      <Box component="figcaption" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {summary}
        </Typography>
        {table && (
          <>
            <Button size="small" onClick={() => setShowTable((value) => !value)} aria-expanded={showTable} aria-controls={id} sx={{ ml: 1 }}>
              {showTable ? 'Hide data table' : 'Show data table'}
            </Button>
            <Collapse in={showTable} id={id}>
              <Box sx={{ overflowX: 'auto', mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {table.columns.map((column, index) => (
                        <TableCell key={column} align={index === 0 ? 'left' : 'right'}>
                          {column}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {table.rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, index) => (
                          <TableCell key={index} align={index === 0 ? 'left' : 'right'}>
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </>
        )}
      </Box>
    </Box>
  );
}
