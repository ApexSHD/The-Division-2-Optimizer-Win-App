import { useState } from "react";
import { SidePanel } from "./SidePanel";

export type PreviewRowStatus = "ok" | "warn" | "error";

export interface PreviewRow {
  key: string;
  label: string;
  detail: string;
  status: PreviewRowStatus;
}

export interface ImportPreviewProps {
  open: boolean;
  title: string;
  fileName: string;
  rows: PreviewRow[];
  itemCount: number;
  skippedRows: number;
  existingCount: number;
  onCancel: () => void;
  onConfirm: (mode: "replace" | "merge") => void;
}

const STATUS_LABEL: Record<PreviewRowStatus, string> = {
  ok: "✓ In Ordnung",
  warn: "⚠ Warnung",
  error: "✗ Fehler",
};

export function ImportPreview({
  open,
  title,
  fileName,
  rows,
  itemCount,
  skippedRows,
  existingCount,
  onCancel,
  onConfirm,
}: ImportPreviewProps) {
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const okCount = rows.filter((r) => r.status === "ok").length;
  const warnCount = rows.filter((r) => r.status === "warn").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <SidePanel
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Abbrechen
          </button>
          <span className="spacer" />
          <button
            className="btn btn-accent"
            disabled={itemCount === 0}
            onClick={() => onConfirm(mode)}
          >
            {itemCount > 0 ? `${itemCount} Teil(e) übernehmen` : "Nichts zu übernehmen"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>
          Datei: <strong>{fileName}</strong>
        </label>
        <div style={{ fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>✓ {okCount} in Ordnung</span>
          <span>⚠ {warnCount} Warnung(en)</span>
          <span>✗ {errorCount} Fehler (Zeile wird übersprungen)</span>
        </div>
        {skippedRows > 0 && (
          <p className="settings-hint">
            {skippedRows} Zeile(n) können nicht importiert werden — Ursache steht je Zeile.
            Lösung: CSV an der Export-Vorlage orientieren und erneut importieren.
          </p>
        )}
      </div>
      <div className="field">
        <label>Übernahme-Modus</label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="import-mode"
            checked={mode === "merge"}
            onChange={() => setMode("merge")}
          />
          Zusammenführen — neue Teile ergänzen das Inventar ({existingCount} bestehende bleiben erhalten)
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="import-mode"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          Ersetzen — Inventar durch den Import ersetzen ({existingCount} bestehende werden gelöscht)
        </label>
      </div>
      <div className="field" style={{ maxHeight: "50vh", overflow: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "left" }}>Zeile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ color: r.status === "error" ? "var(--danger, #f56c6c)" : undefined }}>
                <td style={{ padding: "2px 8px 2px 0", whiteSpace: "nowrap" }}>
                  {STATUS_LABEL[r.status]}
                </td>
                <td style={{ padding: "2px 0" }}>
                  {r.label}
                  {r.detail && (
                    <div style={{ fontSize: 11, color: "var(--text-dim, #aaa)" }}>{r.detail}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SidePanel>
  );
}
