import { Flag, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { KeybindingsEditor } from './KeybindingsEditor';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  onClose: () => void;
  /** Back to the main menu; the match keeps running. */
  onLeave: () => void;
  /** Surrender: the match is lost. */
  onSurrender: () => Promise<void>;
}

type Confirm = 'leave' | 'surrender' | null;

/** In-game settings: the player's hotkeys, and leaving / surrendering the match. */
export function SettingsModal({ onClose, onLeave, onSurrender }: SettingsModalProps) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Modal
        title="Réglages"
        onClose={onClose}
        size="lg"
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" onClick={() => setConfirm('leave')}>
              <LogOut size={15} /> Quitter
            </Button>
            <Button variant="danger" onClick={() => setConfirm('surrender')}>
              <Flag size={15} /> Abandonner
            </Button>
            <Button variant="primary" onClick={onClose}>
              Reprendre
            </Button>
          </div>
        }
      >
        <h3 className={styles.sectionTitle}>Touches</h3>
        <KeybindingsEditor />
      </Modal>

      {confirm === 'leave' && (
        <ConfirmDialog title="Quitter la partie ?" confirmLabel="Quitter" onConfirm={onLeave} onCancel={() => setConfirm(null)}>
          <p className={styles.confirmText}>
            Tu reviens au menu principal. La partie continue en temps réel sans toi : tu pourras la reprendre depuis
            l’accueil.
          </p>
        </ConfirmDialog>
      )}
      {confirm === 'surrender' && (
        <ConfirmDialog
          title="Abandonner la partie ?"
          confirmLabel="Abandonner"
          tone="danger"
          busy={busy}
          onConfirm={() => {
            setBusy(true);
            void onSurrender();
          }}
          onCancel={() => setConfirm(null)}
        >
          <p className={styles.confirmText}>La partie s’arrête et compte comme une défaite. Cette action est définitive.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
