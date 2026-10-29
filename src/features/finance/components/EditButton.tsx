import { Button, Tooltip, type ButtonProps } from '@mui/material';
import { useCan } from '@/app/hooks';

/** A button for changing data; disabled with an explanation for viewers. */
export function EditButton(props: ButtonProps) {
  const canEdit = useCan('edit');
  const button = <Button {...props} disabled={props.disabled || !canEdit} />;
  if (canEdit) return button;
  return (
    <Tooltip title="Viewers can see finances but can’t make changes">
      <span style={{ display: 'inline-flex' }}>{button}</span>
    </Tooltip>
  );
}
