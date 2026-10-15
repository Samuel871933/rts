import { DEFAULT_KEYBINDINGS, RESERVED_KEYS, type BindingId } from '@macrogod/shared';
import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { keyLabel } from '../input/hotkeys';
import { rebind, saveKeybindings, useKeybindings } from '../input/useKeybindings';
import { BINDING_GROUPS, BINDING_LABELS } from './bindingGroups';
import styles from './SettingsModal.module.css';

const FIXED_KEYS = [
  { keys: '1 – 5', label: 'Sélectionner un champion' },
  { keys: 'Tab', label: 'Toute l’équipe' },
  { keys: 'Échap', label: 'Fermer / désélectionner' },
];

/** Click a key, press the new one. A key already used elsewhere swaps with it. */
export function KeybindingsEditor() {
  const keys = useKeybindings();
  const [listening, setListening] = useState<BindingId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    // Tells the modal not to treat this key (Escape) as "close".
    document.body.dataset.keyCapture = '1';
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return setListening(null);
      const key = e.key.toLowerCase();
      if (key.length !== 1 || RESERVED_KEYS.includes(key)) {
        setNotice(`« ${keyLabel(e.key)} » n’est pas utilisable : choisis une lettre ou un symbole.`);
        return;
      }
      const swapped = (Object.keys(keys) as BindingId[]).find((b) => b !== listening && keys[b] === key);
      setNotice(
        swapped
          ? `${keyLabel(key)} était utilisée par « ${BINDING_LABELS[swapped]} » : elle prend ${keyLabel(keys[listening])}.`
          : null,
      );
      setListening(null);
      saveKeybindings(rebind(keys, listening, key)).catch(() => setNotice('Enregistrement impossible, réessaie.'));
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      delete document.body.dataset.keyCapture;
    };
  }, [listening, keys]);

  const isDefault = (Object.keys(DEFAULT_KEYBINDINGS) as BindingId[]).every((b) => keys[b] === DEFAULT_KEYBINDINGS[b]);

  return (
    <div className={styles.bindings}>
      <div className={styles.bindingsIntro}>
        <p>Clique sur une touche puis appuie sur la nouvelle. Enregistré sur ton compte.</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDefault}
          onClick={() => {
            setNotice(null);
            saveKeybindings({ ...DEFAULT_KEYBINDINGS }).catch(() => setNotice('Enregistrement impossible, réessaie.'));
          }}
        >
          <RotateCcw size={13} /> Touches par défaut
        </Button>
      </div>
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.groups}>
        {BINDING_GROUPS.map((group) => (
          <section key={group.title} className={styles.group}>
            <h3>{group.title}</h3>
            {group.items.map((item) => (
              <div key={item.id} className={styles.bindingRow}>
                <span>{item.label}</span>
                <button
                  className={`${styles.keyButton} ${listening === item.id ? styles.listening : ''}`}
                  onClick={() => {
                    setNotice(null);
                    setListening(listening === item.id ? null : item.id);
                  }}
                >
                  {listening === item.id ? 'Appuie…' : keyLabel(keys[item.id])}
                </button>
              </div>
            ))}
          </section>
        ))}
        <section className={styles.group}>
          <h3>Fixes</h3>
          {FIXED_KEYS.map((f) => (
            <div key={f.keys} className={`${styles.bindingRow} ${styles.fixedRow}`}>
              <span>{f.label}</span>
              <kbd className={styles.fixedKey}>{f.keys}</kbd>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
