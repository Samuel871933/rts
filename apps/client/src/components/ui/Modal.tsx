import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Bottom row (actions). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Above another modal (confirmation over the settings). */
  stacked?: boolean;
}

/**
 * Dialog over the page. While open it owns the keyboard: Escape closes it, and no key reaches
 * the game's hotkeys (captured on window before any other listener).
 */
export function Modal({ title, onClose, children, footer, size = 'md', stacked }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A stacked dialog sits on top: only the topmost one reacts.
      const dialogs = document.querySelectorAll('[data-modal]');
      if (dialogs[dialogs.length - 1] !== panelRef.current) return;
      e.stopPropagation();
      // A child is reading the next key (key binding editor): Escape is its "cancel".
      if (document.body.dataset.keyCapture) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return createPortal(
    <div className={`${styles.backdrop} ${stacked ? styles.stacked : ''}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className={`${styles.panel} ${styles[size]}`} role="dialog" aria-modal aria-label={title} tabIndex={-1} data-modal>
        <header className={styles.header}>
          <h2>{title}</h2>
          <button className={styles.close} onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
