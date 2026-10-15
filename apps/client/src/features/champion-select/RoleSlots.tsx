import { CHAMPIONS_BY_ID, ROLES, type Role } from '@macrogod/shared';
import { X } from 'lucide-react';
import { ChampionIcon } from '../../components/ui/ChampionIcon';
import { ROLE_LABELS } from '../../i18n/labels';
import styles from './ChampionSelect.module.css';

interface RoleSlotsProps {
  slots: Record<Role, string | null>;
  activeRole: Role | null;
  onSelectRole: (role: Role) => void;
  onClear: (role: Role) => void;
}

export function RoleSlots({ slots, activeRole, onSelectRole, onClear }: RoleSlotsProps) {
  return (
    <div className={styles.slots}>
      {ROLES.map((role) => {
        const championId = slots[role];
        return (
          <div key={role} className={`${styles.slot} ${activeRole === role ? styles.activeSlot : ''}`}>
            <button className={styles.slotMain} onClick={() => onSelectRole(role)}>
              {championId ? (
                <ChampionIcon championId={championId} size={52} />
              ) : (
                <span className={styles.slotEmpty}>+</span>
              )}
              <span className={styles.slotText}>
                <span className={styles.slotRole}>{ROLE_LABELS[role]}</span>
                <span>{championId ? CHAMPIONS_BY_ID[championId].name : 'Choisir…'}</span>
              </span>
            </button>
            {championId && (
              <button className={styles.slotClear} onClick={() => onClear(role)} aria-label={`Retirer ${ROLE_LABELS[role]}`}>
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
