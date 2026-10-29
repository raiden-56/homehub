import type { ReactNode } from 'react';
import { Box, Card, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { ArrowDown, ArrowUp, EyeOff, GripVertical } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DashboardWidgetConfig, DashboardWidgetKey } from '@/types/models';
import { WIDGET_TITLES } from './layout';

interface CustomizerProps {
  widgets: DashboardWidgetConfig[];
  onChange: (widgets: DashboardWidgetConfig[]) => void;
  renderWidget: (key: DashboardWidgetKey) => ReactNode;
  allowResize: boolean;
}

/**
 * Edit mode for the dashboard: drag (pointer or keyboard) to reorder, hide widgets, and toggle
 * width. Move up/down buttons provide a non-drag alternative.
 */
export function DashboardCustomizer({ widgets, onChange, renderWidget, allowResize }: CustomizerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visible = widgets.filter((widget) => !widget.hidden);

  const move = (key: DashboardWidgetKey, direction: -1 | 1) => {
    const visibleIndex = visible.findIndex((widget) => widget.key === key);
    const target = visible[visibleIndex + direction];
    if (!target) return;
    const from = widgets.findIndex((widget) => widget.key === key);
    const to = widgets.findIndex((widget) => widget.key === target.key);
    onChange(arrayMove(widgets, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = widgets.findIndex((widget) => widget.key === active.id);
    const to = widgets.findIndex((widget) => widget.key === over.id);
    onChange(arrayMove(widgets, from, to));
  };

  const update = (key: DashboardWidgetKey, patch: Partial<DashboardWidgetConfig>) =>
    onChange(widgets.map((widget) => (widget.key === key ? { ...widget, ...patch } : widget)));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${WIDGET_TITLES[active.id as DashboardWidgetKey]}.`,
          onDragOver: ({ active, over }) =>
            over ? `${WIDGET_TITLES[active.id as DashboardWidgetKey]} is over ${WIDGET_TITLES[over.id as DashboardWidgetKey]}.` : '',
          onDragEnd: ({ active, over }) =>
            over
              ? `${WIDGET_TITLES[active.id as DashboardWidgetKey]} moved to the position of ${WIDGET_TITLES[over.id as DashboardWidgetKey]}.`
              : `${WIDGET_TITLES[active.id as DashboardWidgetKey]} dropped.`,
          onDragCancel: ({ active }) => `Moving ${WIDGET_TITLES[active.id as DashboardWidgetKey]} was cancelled.`,
        },
      }}
    >
      <SortableContext items={visible.map((widget) => widget.key)} strategy={rectSortingStrategy}>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
          {visible.map((widget, index) => (
            <SortableWidget
              key={widget.key}
              widget={widget}
              first={index === 0}
              last={index === visible.length - 1}
              allowResize={allowResize}
              onHide={() => update(widget.key, { hidden: true })}
              onResize={(size) => update(widget.key, { size })}
              onMove={(direction) => move(widget.key, direction)}
            >
              {renderWidget(widget.key)}
            </SortableWidget>
          ))}
        </Box>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({
  widget,
  children,
  first,
  last,
  allowResize,
  onHide,
  onResize,
  onMove,
}: {
  widget: DashboardWidgetConfig;
  children: ReactNode;
  first: boolean;
  last: boolean;
  allowResize: boolean;
  onHide: () => void;
  onResize: (size: DashboardWidgetConfig['size']) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: widget.key,
  });
  const title = WIDGET_TITLES[widget.key];
  return (
    <Box
      ref={setNodeRef}
      sx={{
        gridColumn: { md: widget.size === 'wide' && allowResize ? 'span 2' : 'span 1' },
        transform: CSS.Translate.toString(transform),
        transition: transition ?? 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        zIndex: isDragging ? 2 : undefined,
        position: 'relative',
      }}
    >
      <Card
        sx={(theme) => ({
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isOver && !isDragging ? theme.palette.primary.main : theme.palette.divider,
          backgroundColor: isDragging ? theme.tokens.sage : 'transparent',
          boxShadow: isDragging ? '0 12px 28px rgba(36, 69, 45, 0.16)' : 'none',
          p: 1,
          transition: 'border-color 160ms ease, background-color 160ms ease',
        })}
      >
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 0.5, pb: 1 }}>
          <Tooltip title="Drag to reorder (or focus and press Space, then arrow keys)">
            <IconButton
              ref={setActivatorNodeRef}
              size="small"
              aria-label={`Reorder ${title}`}
              sx={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
              {...attributes}
              {...listeners}
            >
              <GripVertical size={18} />
            </IconButton>
          </Tooltip>
          <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {title}
          </Typography>
          <IconButton size="small" aria-label={`Move ${title} earlier`} onClick={() => onMove(-1)} disabled={first}>
            <ArrowUp size={16} />
          </IconButton>
          <IconButton size="small" aria-label={`Move ${title} later`} onClick={() => onMove(1)} disabled={last}>
            <ArrowDown size={16} />
          </IconButton>
          {allowResize && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={widget.size}
              onChange={(_, value: DashboardWidgetConfig['size'] | null) => value && onResize(value)}
              aria-label={`Width of ${title}`}
            >
              <ToggleButton value="regular" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
                Half
              </ToggleButton>
              <ToggleButton value="wide" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
                Full
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <Tooltip title="Hide widget">
            <IconButton size="small" aria-label={`Hide ${title}`} onClick={onHide}>
              <EyeOff size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ pointerEvents: 'none', opacity: 0.85, maxHeight: 340, overflow: 'hidden' }} aria-hidden inert>
          {children}
        </Box>
      </Card>
    </Box>
  );
}
