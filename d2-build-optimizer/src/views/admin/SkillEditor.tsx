import { useMemo, useState } from "react";
import type { SkillEntry, SkillVariant } from "../../data/v4Data";
import { Field } from "../../components/SidePanel";

export interface SkillEditorValue {
  key: string;
  name: string;
  variants: SkillVariantDraft[];
}

export interface SkillVariantDraft {
  key: string;
  name: string;
  effect_type: SkillVariant["effect_type"];
  duration: number | null;
  cooldown: number | null;
  charges: number | null;
  description: string;
  tiers: TierRow[];
}

export interface TierRow {
  tier: string;
  effekt_skalierung: number;
  abkuehlzeit_modifikator_pct: number;
  fertigkeiten_lebensenergie_bonus_pct: number;
}

const TIER_NAMES = ["Tier_0", "Tier_1", "Tier_2", "Tier_3", "Tier_4", "Tier_5", "Tier_6"];
const EFFECT_TYPES: SkillVariant["effect_type"][] = ["damage", "heal", "cc", "buff", "defense"];

export function skillToValue(sk: SkillEntry): SkillEditorValue {
  return {
    key: sk.key,
    name: sk.name,
    variants: sk.variants.map(variantToDraft),
  };
}

export function variantToDraft(v: SkillVariant): SkillVariantDraft {
  const tiersRaw = (v as unknown as { tiers?: Record<string, { effekt_skalierung?: number; abkuehlzeit_modifikator_pct?: number; fertigkeiten_lebensenergie_bonus_pct?: number }> }).tiers;
  const tiers: TierRow[] = TIER_NAMES.map((t) => {
    const r = tiersRaw?.[t];
    return {
      tier: t,
      effekt_skalierung: r?.effekt_skalierung ?? 1,
      abkuehlzeit_modifikator_pct: r?.abkuehlzeit_modifikator_pct ?? 0,
      fertigkeiten_lebensenergie_bonus_pct: r?.fertigkeiten_lebensenergie_bonus_pct ?? 0,
    };
  });
  return {
    key: v.key,
    name: v.name,
    effect_type: v.effect_type,
    duration: v.duration,
    cooldown: v.cooldown,
    charges: v.charges,
    description: v.description ?? "",
    tiers,
  };
}

export function valueToSkill(v: SkillEditorValue): SkillEntry {
  return {
    key: v.key,
    name: v.name || v.key,
    variants: v.variants
      .filter((x) => x.key.trim())
      .map((x) => ({
        key: x.key.trim(),
        name: x.name.trim() || x.key.trim(),
        effect_type: x.effect_type,
        damage_kind: x.effect_type === "damage" ? "skill_damage" : x.effect_type === "heal" ? "repair" : null,
        status_effect: null,
        base_value_per_tier: null,
        value_unit: null,
        value_status: "Annahme" as const,
        duration: x.duration,
        cooldown: x.cooldown,
        charges: x.charges,
        description: x.description,
        scaling_type: ({ damage: "damage", heal: "repair", cc: "cc_duration", defense: "shield_hp", buff: "damage" } as const)[x.effect_type] ?? "damage",
        tiers: Object.fromEntries(
          x.tiers.map((t) => [
            t.tier,
            {
              effekt_skalierung: t.effekt_skalierung,
              abkuehlzeit_modifikator_pct: t.abkuehlzeit_modifikator_pct,
              fertigkeiten_lebensenergie_bonus_pct: t.fertigkeiten_lebensenergie_bonus_pct,
            },
          ]),
        ) as never,
      })) as SkillVariant[],
  };
}

export function emptySkillValue(key = ""): SkillEditorValue {
  return { key, name: "", variants: [] };
}

function emptyVariant(key = ""): SkillVariantDraft {
  return {
    key,
    name: "",
    effect_type: "damage",
    duration: null,
    cooldown: null,
    charges: null,
    description: "",
    tiers: TIER_NAMES.map((tier) => ({ tier, effekt_skalierung: 1, abkuehlzeit_modifikator_pct: 0, fertigkeiten_lebensenergie_bonus_pct: 0 })),
  };
}

export function SkillEditor({
  value,
  onChange,
  labels,
}: {
  value: SkillEditorValue;
  onChange: (v: SkillEditorValue) => void;
  labels: {
    skillKey: string;
    name: string;
    variants: string;
    addVariant: string;
    variantKey: string;
    effectType: string;
    duration: string;
    cooldown: string;
    charges: string;
    description: string;
    tiers: string;
    tier: string;
    effekt: string;
    cdMod: string;
    hpBonus: string;
    remove: string;
    selectSkill: string;
    selectVariant: string;
  };
}) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(value.variants[0]?.key ?? null);
  const selected = useMemo(
    () => value.variants.find((v) => v.key === selectedVariant) ?? value.variants[0] ?? null,
    [value.variants, selectedVariant],
  );

  const setVariant = (key: string, patch: Partial<SkillVariantDraft>) => {
    onChange({
      ...value,
      variants: value.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)),
    });
  };
  const setTier = (variantKey: string, tier: string, patch: Partial<TierRow>) => {
    onChange({
      ...value,
      variants: value.variants.map((v) =>
        v.key === variantKey ? { ...v, tiers: v.tiers.map((t) => (t.tier === tier ? { ...t, ...patch } : t)) } : v,
      ),
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 200px 1fr", gap: 12, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 8 }}>
        {labels.skillKey !== "" && (
          <>
            <Field label={labels.skillKey}>
              <input value={value.key} onChange={(e) => onChange({ ...value, key: e.target.value })} />
            </Field>
            <Field label={labels.name}>
              <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
            </Field>
          </>
        )}
        <div className="hint">{labels.selectVariant}</div>
        <div role="listbox" aria-label={labels.variants} style={{ display: "grid", gap: 4 }}>
          {value.variants.map((v) => (
            <button
              key={v.key}
              type="button"
              role="option"
              aria-selected={selected?.key === v.key}
              className={`btn ${selected?.key === v.key ? "btn-primary" : ""}`}
              style={{ textAlign: "left" }}
              onClick={() => setSelectedVariant(v.key)}
            >
              {v.name || v.key}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const nv = emptyVariant(`variant_${value.variants.length + 1}`);
            onChange({ ...value, variants: [...value.variants, nv] });
            setSelectedVariant(nv.key);
          }}
        >
          + {labels.addVariant}
        </button>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        <div className="hint">{labels.selectSkill}</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {selected ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <strong>{selected.name || selected.key}</strong>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={() => {
                  const rest = value.variants.filter((v) => v.key !== selected.key);
                  onChange({ ...value, variants: rest });
                  setSelectedVariant(rest[0]?.key ?? null);
                }}
              >
                ✕ {labels.remove}
              </button>
            </div>
            <Field label={labels.variantKey}>
              <input value={selected.key} onChange={(e) => setVariant(selected.key, { key: e.target.value })} />
            </Field>
            <Field label={labels.name}>
              <input value={selected.name} onChange={(e) => setVariant(selected.key, { name: e.target.value })} />
            </Field>
            <Field label={labels.effectType}>
              <select value={selected.effect_type} onChange={(e) => setVariant(selected.key, { effect_type: e.target.value as SkillVariant["effect_type"] })}>
                {EFFECT_TYPES.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Field label={labels.duration}>
                <input type="number" min={0} step="any" style={{ width: 90 }} value={selected.duration ?? ""} onChange={(e) => setVariant(selected.key, { duration: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label={labels.cooldown}>
                <input type="number" min={0} step="any" style={{ width: 90 }} value={selected.cooldown ?? ""} onChange={(e) => setVariant(selected.key, { cooldown: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label={labels.charges}>
                <input type="number" min={0} style={{ width: 80 }} value={selected.charges ?? ""} onChange={(e) => setVariant(selected.key, { charges: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
            </div>
            <Field label={labels.description}>
              <textarea rows={2} value={selected.description} onChange={(e) => setVariant(selected.key, { description: e.target.value })} />
            </Field>

            <strong>{labels.tiers}</strong>
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{labels.tier}</th>
                  <th style={{ textAlign: "right" }}>{labels.effekt}</th>
                  <th style={{ textAlign: "right" }}>{labels.cdMod}</th>
                  <th style={{ textAlign: "right" }}>{labels.hpBonus}</th>
                </tr>
              </thead>
              <tbody>
                {selected.tiers.map((t) => (
                  <tr key={t.tier}>
                    <td>{t.tier}</td>
                    <td>
                      <input type="number" step="0.01" min={0} style={{ width: 80 }} value={t.effekt_skalierung} onChange={(e) => setTier(selected.key, t.tier, { effekt_skalierung: Number(e.target.value) })} />
                    </td>
                    <td>
                      <input type="number" step="0.5" style={{ width: 80 }} value={t.abkuehlzeit_modifikator_pct} onChange={(e) => setTier(selected.key, t.tier, { abkuehlzeit_modifikator_pct: Number(e.target.value) })} />
                    </td>
                    <td>
                      <input type="number" step="1" style={{ width: 80 }} value={t.fertigkeiten_lebensenergie_bonus_pct} onChange={(e) => setTier(selected.key, t.tier, { fertigkeiten_lebensenergie_bonus_pct: Number(e.target.value) })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="hint">{labels.selectVariant}</div>
        )}
      </div>
    </div>
  );
}
