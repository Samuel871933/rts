import type { InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, ...rest }: TextFieldProps) {
  const inputId = id ?? `field-${rest.name}`;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} className={error ? styles.invalid : undefined} aria-invalid={!!error} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
