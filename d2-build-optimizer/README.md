# D2 Build Optimizer – Windows-App (MVP 1.1: Datenhaltung & Inventar)

Windows-Desktop-App des [The Division 2 – Build Optimizer](https://github.com/ApexSHD/division2-build-optimizer). Grundlage ist die [Softwarebeschreibung](../docs/SOFTWAREBESCHREIBUNG.md), Stufe **MVP 1.1**.

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

## Umfang von MVP 1.1

- Alles aus MVP 1.0: Hauptfenster mit Titelleiste, Navigation, Arbeitsbereich, Werte-Leiste, Statuszeile; alle Ansichten; Tabellen mit Filter/Sortierung; dunkel/hell-Design; Sprachgerüst DE/EN
- **Dauerhafte Speicherung** der Benutzerdaten (Inventar, Builds, Agentenwerte, Profile, Sprache, Design) unter `%APPDATA%\de.apexshd.d2buildoptimizer\user-data.json` – Debounce-Speicherung, Backup (`user-data.json.bak`) und Wiederherstellung aus Backup bei beschädigter Datei
- **Waffen- und Gear-Inventar voll funktionsfähig**: anlegen, bearbeiten, löschen (mit Bestätigung und Referenzbereinigung in Builds), Filtern, Sortieren
- **Profile/Loadouts**: mehrere Profile in der Titelleiste anlegen, umschalten und löschen
- **Undo/Redo**: Strg+Z (rückgängig), Strg+Shift+Z (wiederholen)
- Statusleiste zeigt den tatsächlichen Speicherpfad

**Nicht enthalten (bewusst, siehe Softwarebeschreibung):** echte Berechnungen, Optimierung, Import/Export, Admin-Datenpflege.
