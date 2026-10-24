import { useContext, useState } from "react";
import { useStore } from "../store";
import { I18nContext } from "../i18n";
import { ChartPlaceholder } from "../components/ChartPlaceholder";

export function CompareView() {
  const store = useStore();
  const { t } = useContext(I18nContext);
  const [tab, setTab] = useState<"weapons" | "sets" | "loadouts">("weapons");
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>(["w1", "w4"]);
  const [selectedSets, setSelectedSets] = useState<string[]>(["b4", "b5"]);
  const [selectedLoadouts, setSelectedLoadouts] = useState<string[]>(["l1", "l2"]);

  const tabs = [
    { key: "weapons" as const, label: t.compare.tabWeapons },
    { key: "sets" as const, label: t.compare.tabSets },
    { key: "loadouts" as const, label: t.compare.tabLoadouts },
  ];

  function toggle(list: string[], setList: (l: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <div>
      <div className="tabs">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            className={`tab ${tab === tb.key ? "active" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "weapons" && (
        <div>
          <div className="toolbar">
            <select
              onChange={(e) => {
                if (e.target.value) toggle(selectedWeapons, setSelectedWeapons, e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">{t.compare.selectWeapon}</option>
              {store.weapons.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="card-grid">
            {selectedWeapons.map((id) => {
              const w = store.weapons.find((x) => x.id === id);
              if (!w) return null;
              return (
                <div key={id} className="card">
                  <h4>{w.name}</h4>
                  <div className="card-sub">{t.weapons.types[w.type]} · {t.weapons.rarities[w.rarity]}</div>
                  <div style={{ fontSize: 13 }}>
                    DPS: {(w.baseDamage * w.rpm / 60).toLocaleString("de-DE", { maximumFractionDigits: 0 })}
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ marginTop: 10 }}
                    onClick={() => toggle(selectedWeapons, setSelectedWeapons, id)}
                  >
                    {t.common.remove}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <ChartPlaceholder label={t.compare.dpsChart} height={200} />
          </div>
        </div>
      )}

      {tab === "sets" && (
        <div>
          <div className="toolbar">
            <select
              onChange={(e) => {
                if (e.target.value) toggle(selectedSets, setSelectedSets, e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">{t.compare.selectSet}</option>
              {[...store.brandSets, ...store.gearSets].map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="card-grid">
            {selectedSets.map((id) => {
              const s = [...store.brandSets, ...store.gearSets].find((x) => x.id === id);
              if (!s) return null;
              return (
                <div key={id} className="card">
                  <h4>{s.name}</h4>
                  <ul style={{ fontSize: 12, color: "var(--text-dim)", paddingLeft: 16, marginTop: 6 }}>
                    {s.bonuses.map((b) => (
                      <li key={b.pieces}><strong>{b.pieces}×</strong> {b.bonus}</li>
                    ))}
                  </ul>
                  <button
                    className="btn btn-danger"
                    style={{ marginTop: 10 }}
                    onClick={() => toggle(selectedSets, setSelectedSets, id)}
                  >
                    {t.common.remove}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "loadouts" && (
        <div>
          <div className="toolbar">
            <select
              onChange={(e) => {
                if (e.target.value) toggle(selectedLoadouts, setSelectedLoadouts, e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">{t.compare.selectLoadout}</option>
              {store.builds.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="card-grid">
            {selectedLoadouts.map((id) => {
              const b = store.builds.find((x) => x.id === id);
              if (!b) return null;
              return (
                <div key={id} className="card">
                  <h4>{b.name}</h4>
                  <div className="card-sub">{b.note}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Waffen: {b.weaponIds.map((wid) => store.weapons.find((w) => w.id === wid)?.name).join(", ")}
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ marginTop: 10 }}
                    onClick={() => toggle(selectedLoadouts, setSelectedLoadouts, id)}
                  >
                    {t.common.remove}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
