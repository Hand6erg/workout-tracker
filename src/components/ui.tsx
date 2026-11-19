import { useEffect, useState, type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <button className="btn-ghost" onClick={onClose} aria-label="Luk">
            ✕
          </button>
          <h2>{title}</h2>
          <span style={{ width: 40 }} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** Knap der kræver to tryk – undgår browserens confirm()-dialog */
export function ConfirmButton({
  children,
  confirmText = 'Tryk igen for at bekræfte',
  onConfirm,
  className = 'btn-danger',
}: {
  children: ReactNode;
  confirmText?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'Alle',
  label,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T | null) => void;
  allLabel?: string;
  /** Tilgængeligt navn til gruppen af knapper */
  label?: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      <button className={`chip ${value === null ? 'on' : ''}`} onClick={() => onChange(null)}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button key={o} className={`chip ${value === o ? 'on' : ''}`} onClick={() => onChange(value === o ? null : o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
