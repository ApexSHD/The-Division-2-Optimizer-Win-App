import type { ReactNode } from "react";

interface SidePanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function SidePanel({ open, title, onClose, footer, children }: SidePanelProps) {
  return (
    <div className={`panel ${open ? "open" : ""}`} role="dialog" aria-label={title}>
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        <button className="btn" onClick={onClose} aria-label="Panel schließen">✕</button>
      </div>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-footer">{footer}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
