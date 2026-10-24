# Entwicklungsumgebung einrichten (Windows)

Diese Anleitung beschreibt die komplette Einrichtung, um am D2 Build Optimizer zu arbeiten und die Abnahmen der MVP-Stufen lokal durchzuführen.

## Benötigte Programme

| Programm | Zweck | Download |
| --- | --- | --- |
| Visual Studio Code | Editor | https://code.visualstudio.com |
| Node.js LTS (22.x) | Frontend-Build (npm) | https://nodejs.org |
| Rust-Toolchain (rustup, MSVC) | Tauri-Desktop-Hülle | https://rustup.rs |
| Visual Studio Build Tools 2022 | C++-Linker + Windows SDK für Rust | https://visualstudio.microsoft.com/visual-cpp-build-tools/ |
| Git | Versionsverwaltung | https://git-scm.com |

Beim Installieren der **VS Build Tools** die Workload **„Desktopentwicklung mit C++“** inklusive **Windows 10/11 SDK** auswählen – der Rust-MSVC-Linker benötigt dies.

Die **WebView2 Runtime** ist auf Windows 10/11 normalerweise vorinstalliert; andernfalls: https://developer.microsoft.com/microsoft-edge/webview2/

## VS Code Extensions

Beim Öffnen des Projekts schlägt VS Code automatisch die in `.vscode/extensions.json` hinterlegten Extensions vor:

- **rust-analyzer** – Rust-IntelliSense für `src-tauri/`
- **Tauri** – Tauri-Snippets und CLI-Integration
- **ESLint / Prettier** – Linting und Formatierung für TypeScript
- **EditorConfig** – übernimmt die Regeln aus `.editorconfig`

Alternativ manuell installieren:

```powershell
code --install-extension matklad.rust-analyzer
code --install-extension tauri-apps.tauri-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension editorconfig.editorconfig
```

## Projekt starten

```powershell
git clone https://github.com/ApexSHD/The-Division-2-Optimizer-Win-App
cd The-Division-2-Optimizer-Win-App\d2-build-optimizer
npm install
npm run tauri dev
```

- `npm run tauri dev` – startet die App im Dev-Modus mit Hot-Reload
- `npm run tauri build` – baut Installer (NSIS/MSI) und portable EXE unter `src-tauri\target\release\`
- `npm run dev` – nur die Oberfläche im Browser (ohne Rust/Tauri, z. B. für reine UI-Arbeiten)

## Abnahme ohne eigene Build-Umgebung

Die CI baut bei jedem Push eine Windows-EXE. Download: Repo → **Actions** → letzter Lauf von „Windows-Build (Tauri)“ → **Artifacts** → `d2-build-optimizer-windows`. Damit lässt sich die App testen, ohne Rust oder Build Tools zu installieren.

## Projekt-Struktur

```
d2-build-optimizer/
├── src/            React-Oberfläche (TypeScript)
│   ├── views/      Ansichten (Global, Waffen, Gear, …)
│   ├── components/ wiederverwendbare Komponenten (Tabelle, Paneele, …)
│   ├── i18n/       Sprachdateien (de, en)
│   └── data/        Beispieldaten / Datenbanken
├── src-tauri/      Rust-Desktop-Hülle (Tauri 2)
└── dist/           Build-Output (nicht committet)
```
