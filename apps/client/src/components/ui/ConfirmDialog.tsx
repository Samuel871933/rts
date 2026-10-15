import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure?" on top of whatever is open. */
export function ConfirmDialog({ title, children, confirmLabel, tone = 'primary', busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      stacked
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
