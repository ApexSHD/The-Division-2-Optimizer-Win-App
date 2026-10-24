# D2 Build Optimizer – Windows-App (MVP 1.0: GUI-Prototyp)

Klickbarer GUI-Prototyp der Windows-Desktop-App des [The Division 2 – Build Optimizer](https://github.com/ApexSHD/division2-build-optimizer). Grundlage ist die [Softwarebeschreibung](../docs/SOFTWAREBESCHREIBUNG.md), Stufe **MVP 1.0**.

## Stack

- **Tauri 2** (Desktop-Hülle, Fenster-Zustand via `tauri-plugin-window-state`)
- **React 19 + TypeScript** (Oberfläche)
- **Vite 8** (Build)

## Entwicklung

```bash
cd d2-build-optimizer
npm install
npm run tauri dev
```

Ohne Rust/Tauri (nur UI im Browser):

```bash
npm run dev
```

## Build (Windows)

```bash
npm run tauri build
```

Erzeugt Installer (NSIS/MSI) unter `src-tauri/target/release/bundle/`. Portable EXE: `src-tauri/target/release/d2-build-optimizer.exe`.

## Umfang von MVP 1.0

- Hauptfenster: Titelleiste, linke Navigation, Arbeitsbereich, rechte Build-Werte-Leiste, Statuszeile
- Ansichten: Global, Waffen, Gear, Optimierung, Vergleich (Waffen/Sets/Loadouts), Admin, Einstellungen
- Tabellen mit Filter/Sortierung, Seitenpaneele, Diagramm-Platzhalter
- Design: dunkel/hell, SHD-Orange-Akzent, Fensterzustand wird gemerkt
- Sprachgerüst DE (EN vollständig vorbereitet)
- Tastaturkürzel: Strg+N, Strg+S, Strg+F, Strg+Z, F5 (Optimierung), F9 (Werte-Leiste)

**Nicht enthalten (bewusst, siehe Softwarebeschreibung):** echte Berechnungen, Optimierung, dauerhafte Speicherung, Import/Export.
