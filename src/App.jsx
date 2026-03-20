import React, { useEffect, useMemo, useRef, useState } from "react";
import ConveyorSection from "./components/ConveyorSection";

import buySfx from "./assets/audio/buy.ogg";
import revealSfx from "./assets/audio/reveal.mp3";
import tapSfx from "./assets/audio/tap.ogg";
import hoverSfx from "./assets/audio/hover.ogg";
import trashSfx from "./assets/audio/trash.ogg";
import equipSfx from "./assets/audio/equip.ogg";
import coinSfx from "./assets/audio/coin.ogg";

// import revealNormalSfx from "./assets/audio/reveal-normal.mp3";
// import revealGoldSfx from "./assets/audio/reveal-gold.mp3";
// import revealDiamondSfx from "./assets/audio/reveal-diamond.mp3";
// import revealRubySfx from "./assets/audio/reveal-ruby.mp3";
// 
import { playSound } from "./utils/audio";


import {
  COSMETICS,
  GROUPS,
  MUTATIONS,
  MUTATION_VISUALS,
  OPEN_TIME_BY_TIER_SEC,
  RARITIES,
} from "./data/gameData";


const EVENT_COLORS = {
  Astral: "#a78bfa",
  BloodMoon: "#ef4444",
  "Cherry Blossom": "#f9a8d4",
};

const RARITY_RANK = {
  Normal: 0,
  Gold: 1,
  Diamond: 2,
  Ruby: 3,
};

const RARITY_PACK_PRICE_MULT = {
  Normal: 1,
  Gold: 45,
  Diamond: 200,
  Ruby: 90000,
};

const MUTATION_RANK = {
  null: 0,
  Astral: 1,
  BloodMoon: 2,
  "Cherry Blossom": 3,
};

const SET_BONUS_PER_COMPLETE = 0.2;
const SAVE_KEY = "idol-collector-save-v4";
const CONVEYOR_MAX = 7;
const CONVEYOR_LIFETIME_MS = 35000;
const REVEAL_DURATION_MS = 2200;

const fmt = (n) => {
  if (n < 1000) return Math.floor(n).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let num = n;
  let i = -1;
  while (num >= 1000 && i < units.length - 1) {
    num /= 1000;
    i += 1;
  }
  return `${num.toFixed(num < 10 ? 2 : num < 100 ? 1 : 0)}${units[i]}`;
};

const now = () => Date.now();

const getIdolImage = (idol) => {
  if (idol.image) return idol.image;

  const group = GROUPS.find((g) => g.name === idol.group);
  const member = group?.members.find((m) => m.name === idol.name);

  return member?.image || null;
};

const getRevealSfxByRarity = (rarity) => {
  if (rarity === "Ruby") return revealRubySfx;
  if (rarity === "Diamond") return revealDiamondSfx;
  if (rarity === "Gold") return revealGoldSfx;
  return revealNormalSfx;
};

const getRarityMultiplier = (rarity) => {
  if (rarity === "Ruby") return 8;
  if (rarity === "Diamond") return 4;
  if (rarity === "Gold") return 2;
  return 1;
};

const getMutationMultiplier = (mutation) => {
  if (mutation === "Cherry Blossom") return 72;
  if (mutation === "BloodMoon") return 48;
  if (mutation === "Astral") return 24;
  return 1;
};

function getMutationBorder(mutation) {
  if (mutation === "Astral") return "2px solid #a78bfa";
  if (mutation === "BloodMoon") return "2px solid #ef4444";
  if (mutation === "Cherry Blossom") return "2px solid #f9a8d4";
  return "none";
}

function getCurrentMutationEvent(date = new Date()) {
  const minute = date.getMinutes();

  if (minute >= 15 && minute < 20) {
    return { mutation: "Astral", endsAtMinute: 20, nextMutation: "BloodMoon", nextMinute: 35 };
  }

  if (minute >= 35 && minute < 40) {
    return { mutation: "BloodMoon", endsAtMinute: 40, nextMutation: "Cherry Blossom", nextMinute: 55 };
  }

  if (minute >= 55 || minute < 0) {
    return { mutation: "Cherry Blossom", endsAtMinute: 60, nextMutation: "Astral", nextMinute: 15 };
  }

  return null;
}

function getMutationColor(mutation) {
  if (mutation === "Astral") return "#a78bfa";
  if (mutation === "BloodMoon") return "#ef4444";
  if (mutation === "Cherry Blossom") return "#f9a8d4";
  return "#ffffff00";
}

function FloatingIncomeText({ id, amount, x, y, onDone }) {
  const [style, setStyle] = useState({
    position: "fixed",
    left: x + Math.random() * 20 - 10,
    top: y + Math.random() * 20 - 10,
    pointerEvents: "none",
    fontWeight: "bold",
    color: "#48ff79",
    fontSize: 24,
    opacity: 1,
    transform: "translateY(0px) scale(0.7)",
    transition: "transform 0.12s ease-out, opacity 0.12s ease-out",
    zIndex: 9999,
  });

  useEffect(() => {
    const popTimer = setTimeout(() => {
      setStyle((s) => ({
        ...s,
        opacity: 1,
        transform: "translateY(0px) scale(1.12)",
      }));
    }, 10);

    const floatTimer = setTimeout(() => {
      setStyle((s) => ({
        ...s,
        opacity: 0,
        transform: "translateY(-34px) scale(1)",
        transition: "transform 0.75s ease-out, opacity 0.75s ease-out",
      }));
    }, 120);

    const removeTimer = setTimeout(() => {
      onDone(id);
    }, 900);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(floatTimer);
      clearTimeout(removeTimer);
    };
  }, [id, onDone]);

  return <div style={style}>+${fmt(amount)}</div>;
}

const getBetterRarity = (currentRarity, incomingRarity) => {
  return (RARITY_RANK[incomingRarity] ?? 0) > (RARITY_RANK[currentRarity] ?? 0)
    ? incomingRarity
    : currentRarity;
};

const getBetterMutation = (currentMutation, incomingMutation) => {
  return (MUTATION_RANK[incomingMutation ?? null] ?? 0) >
    (MUTATION_RANK[currentMutation ?? null] ?? 0)
    ? incomingMutation
    : currentMutation;
};

const weightedPick = (items, weightKey = "weight") => {
  const total = items.reduce((sum, item) => sum + item[weightKey], 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item[weightKey];
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
};

const maybeMutation = () => {
  const event = getCurrentMutationEvent(new Date());
  const roll = Math.random();

  // Astral event
  if (event?.mutation === "Astral") {
    if (roll < 0.06) return MUTATIONS[0];      // 6.0%
    if (roll < 0.07) return MUTATIONS[1];      // 1.0%
    if (roll < 0.075) return MUTATIONS[2];     // 0.5%
    return null;                               // 92.5%
  }

  // BloodMoon event
  if (event?.mutation === "BloodMoon") {
    if (roll < 0.02) return MUTATIONS[0];      // 2.0%
    if (roll < 0.08) return MUTATIONS[1];      // 6.0%
    if (roll < 0.085) return MUTATIONS[2];     // 0.5%
    return null;                               // 91.5%
  }

  // Cherry Blossom event
  if (event?.mutation === "Cherry Blossom") {
    if (roll < 0.02) return MUTATIONS[0];      // 2.0%
    if (roll < 0.03) return MUTATIONS[1];      // 1.0%
    if (roll < 0.09) return MUTATIONS[2];      // 6.0%
    return null;                               // 91.0%
  }

  // Base rates
  if (roll < 0.02) return MUTATIONS[0];        // 2.0%
  if (roll < 0.03) return MUTATIONS[1];        // 1.0%
  if (roll < 0.035) return MUTATIONS[2];       // 0.5%
  return null;                                 // 96.5%
};

const computeBaseIncome = (group) => group.cost * 0.02;

const getPlayerTier = (money) => {
  let tier = 1;
  for (const group of GROUPS) if (money >= group.cost) tier = group.tier;
  return tier;
};

const getSpawnWeights = (playerTier) => {
  const center = Math.max(1, playerTier - 2);
  return GROUPS.map((group) => {
    const distance = Math.abs(group.tier - center);
    const weight = Math.max(0.2, 100 / Math.pow(distance + 1, 2));
    return { group, weight };
  });
};

const cleanConveyor = (packs) =>
  (packs || []).filter((p) => p.expiresAt > now()).slice(-CONVEYOR_MAX);

const cleanOpening = (packs = []) =>
  packs.filter((p) => {
    if (p.progress != null && p.baseSec != null && p.lastProgressAt != null) {
      return p.progress < 1;
    }

    if (p.startedAt != null && p.baseSec != null) return true;
    if (p.readyAt != null) return p.readyAt > now();

    return false;
  });

const getMemberValue = (group, member) => {
  const sorted = [...group.members].sort((a, b) => b.weight - a.weight);
  const index = sorted.findIndex((m) => m.name === member.name);
  const count = sorted.length;
  const low = 0.75;
  const high = count <= 4 ? 1.95 : count <= 6 ? 2.2 : 2.3;
  const mult = low + (index / Math.max(1, count - 1)) * (high - low);
  const weightedAverage = sorted.reduce((sum, m, i) => {
    const mm = low + (i / Math.max(1, count - 1)) * (high - low);
    return sum + (m.weight / 100) * mm;
  }, 0);
  return (computeBaseIncome(group) * mult) / weightedAverage;
};

const getCompletedGroups = (collection) => {
  const ownedByGroup = new Map();

  for (const idol of collection) {
    if (!ownedByGroup.has(idol.group)) ownedByGroup.set(idol.group, new Set());
    ownedByGroup.get(idol.group).add(idol.name);
  }

  return new Set(
    GROUPS.filter((group) => (ownedByGroup.get(group.name)?.size ?? 0) === group.members.length).map(
      (group) => group.name
    )
  );
};

const getSetBonusMultiplier = (groupName, completedGroups) =>
  completedGroups.has(groupName) ? 1 + SET_BONUS_PER_COMPLETE : 1;

const getEffectiveIdolIncome = (idol, completedGroups) =>
  idol.incomePerSec * getSetBonusMultiplier(idol.group, completedGroups);

const getTotalCollectionCount = () =>
  GROUPS.reduce((sum, group) => sum + group.members.length, 0);

const getMutationParticleSeed = (label) => {
  const chars = (label || "").split("");
  return chars.reduce((sum, ch, idx) => sum + ch.charCodeAt(0) * (idx + 1), 0);
};

const THEMES = {
  dark: {
    label: "Dark",
    pageBg: "linear-gradient(135deg, #0f172a, #111827 50%, #4c0519)",
    text: "#e5ebe5",
    subtext: "#94a3b8",
    panel: "rgba(15,23,42,0.8)",
    panelAlt: "rgba(30,41,59,0.55)",
    cardBorder: "#334155",
    cardBorderSoft: "#475569",
    button: "#1d4ed8",
    buttonText: "#ffffff",
    buttonAltBg: "transparent",
    buttonAltText: "#ffffff",
    tabActive: "#e11d48",
    tabInactive: "rgba(15,23,42,0.7)",
    idolFallback: "linear-gradient(135deg, rgba(244,114,182,0.25), rgba(34,211,238,0.2))",
    progressBg: "#1e293b",
    progressFill: "linear-gradient(90deg, #ec4899, #22d3ee)",
  },

  light: {
    label: "Light",
    pageBg: "linear-gradient(135deg, #f8fafc, #eef2ff 55%, #ffe4e6)",
    text: "#0f172a",
    subtext: "#475569",
    panel: "rgba(255,255,255,0.92)",
    panelAlt: "rgba(241,245,249,0.95)",
    cardBorder: "#cbd5e1",
    cardBorderSoft: "#94a3b8",
    button: "#2563eb",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.75)",
    buttonAltText: "#0f172a",
    tabActive: "#f43f5e",
    tabInactive: "rgba(255,255,255,0.8)",
    idolFallback: "linear-gradient(135deg, rgba(251,113,133,0.16), rgba(56,189,248,0.14))",
    progressBg: "#e2e8f0",
    progressFill: "linear-gradient(90deg, #f43f5e, #38bdf8)",
  },

  rose: {
    label: "Rose Lounge",
    pageBg: "linear-gradient(135deg, #2a1020, #4a1630 55%, #7c2d5f)",
    text: "#ffe7f2",
    subtext: "#f9a8d4",
    panel: "rgba(60,16,40,0.82)",
    panelAlt: "rgba(88,28,56,0.72)",
    cardBorder: "#be5a93",
    cardBorderSoft: "#d17aa9",
    button: "#db2777",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.08)",
    buttonAltText: "#ffe7f2",
    tabActive: "#f472b6",
    tabInactive: "rgba(88,28,56,0.6)",
    idolFallback: "linear-gradient(135deg, rgba(255,182,193,0.22), rgba(255,105,180,0.16))",
    progressBg: "#6b2149",
    progressFill: "linear-gradient(90deg, #f472b6, #fb7185)",
  },

  mint: {
    label: "Mint Pop",
    pageBg: "linear-gradient(135deg, #052e2b, #0f766e 55%, #99f6e4)",
    text: "#ecfeff",
    subtext: "#99f6e4",
    panel: "rgba(9,40,38,0.82)",
    panelAlt: "rgba(15,118,110,0.3)",
    cardBorder: "#2dd4bf",
    cardBorderSoft: "#5eead4",
    button: "#14b8a6",
    buttonText: "#042f2e",
    buttonAltBg: "rgba(255,255,255,0.08)",
    buttonAltText: "#ecfeff",
    tabActive: "#2dd4bf",
    tabInactive: "rgba(9,40,38,0.62)",
    idolFallback: "linear-gradient(135deg, rgba(45,212,191,0.18), rgba(103,232,249,0.16))",
    progressBg: "#134e4a",
    progressFill: "linear-gradient(90deg, #2dd4bf, #67e8f9)",
  },
};

const getStyles = (ui) => ({
  page: {
  minHeight: "100vh",
  width: "100%",
  background: ui.pageBg,
  color: ui.text,
  padding: "20px 24px",
  fontFamily: "Nunito, system-ui, sans-serif",
  boxSizing: "border-box",
  overflowX: "hidden",
},
  wrap: { 
    width: "100%",
    maxWidth: "none",
    margin: 0 
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },

packCard: {
  width: 240,
  minWidth: 240,
  flex: "0 0 240px",
  background: ui.panel,
  border: `1px solid ${ui.cardBorder}`,
  borderRadius: 18,
  padding: 14,
  minHeight: 210,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxSizing: "border-box",
},
  card: {
    background: ui.panel,
    border: `1px solid ${ui.cardBorder}`,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tabs: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", fontFamily: "Nunito, system-ui, sans-serif", },
  tabBtn: (active) => ({
    padding: "10px 14px",
    borderRadius: 14,
    border: `1px solid ${ui.cardBorderSoft}`,
    background: active ? ui.tabActive : ui.tabInactive,
    color: active ? "#fff" : ui.buttonAltText,
    cursor: "pointer",
  }),
  button: {
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px solid ${ui.cardBorderSoft}`,
    background: ui.button,
    color: ui.buttonText,
    cursor: "pointer",
  },
  buttonAlt: {
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px solid ${ui.cardBorderSoft}`,
    background: ui.buttonAltBg,
    color: ui.buttonAltText,
    cursor: "pointer",
  },
  pill: (bg, color = "#fff") => ({
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: bg,
    color,
  }),
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  binder: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 75, alignItems: "start" },
  idolBox: {
    aspectRatio: "4 / 5",
    borderRadius: 18,
    background: ui.idolFallback,
    border: `1px solid ${ui.cardBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 12,
    overflow: "hidden",
    position: "relative",
    isolation: "isolate",
  },
  modalBg: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 30,
  },
  modal: {
    width: "min(950px, 100%)",
    background: ui.panel,
    border: `1px solid ${ui.cardBorder}`,
    borderRadius: 24,
    padding: 20,
  },
  small: { fontSize: 12, color: ui.subtext },
  levelBadge: (level) => ({
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      level >= 10
        ? "linear-gradient(90deg, #f59e0b, #ef4444)"
        : level >= 5
        ? "linear-gradient(90deg, #22d3ee, #a78bfa)"
        : "#475569",
    color: "#fff",
    boxShadow:
      level >= 10
        ? "0 0 18px rgba(245,158,11,0.55)"
        : level >= 5
        ? "0 0 14px rgba(34,211,238,0.45)"
        : "none",
  }),
});


function getRarityBorder(rarity) {
  if (rarity === "Ruby") return "2px solid #fb7185";
  if (rarity === "Diamond") return "2px solid #67e8f9";
  if (rarity === "Gold") return "2px solid #fbbf24";
  return "1px solid #334155";
}

function progressBar(pct, ui) {
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: ui.progressBg,
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: ui.progressFill,
        }}
      />
    </div>
  );
}

function MutationParticles({ mutation, dense = false }) {
  if (!mutation || !MUTATION_VISUALS[mutation]) return null;

  const visual = MUTATION_VISUALS[mutation];
  const count = dense ? 10 : 6;
  const seed = getMutationParticleSeed(mutation);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        filter: "blur(0.2px)",
      }}
    >
      {Array.from({ length: count }).map((_, idx) => {
        const left = ((seed + idx * 19) % 82) + 6;
        const size = dense ? 7 + ((seed + idx * 5) % 8) : 5 + ((seed + idx * 5) % 6);
        const delay = `${(idx % 5) * 0.35}s`;
        const duration = `${3 + (idx % 4) * 0.55}s`;
        const color = visual.colors[idx % visual.colors.length];
        const top = ((seed + idx * 13) % 80) + 4;
        const shape = mutation === "Cherry Blossom" ? "45% 55% 55% 45% / 55% 45% 55% 45%" : "999px";

        return (
          <span
            key={`${mutation}-${idx}`}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              borderRadius: shape,
              background: color,
              boxShadow: `0 0 10px ${color}`,
              opacity: 0.85,
              animation: mutation === "BloodMoon" ? "mutationPulse" : "mutationFloat",
              animationDuration: duration,
              animationDelay: delay,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: visual.glow,
          borderRadius: 18,
        }}
      />
    </div>
  );
}

function mergeOpenedIdols(existing, opened) {
  let updated = [...existing];

  for (const newIdol of opened) {
    const idx = updated.findIndex((i) => i.name === newIdol.name && i.group === newIdol.group);

    if (idx === -1) {
      updated.unshift({
        ...newIdol,
        level: newIdol.level ?? 1,
        shards: newIdol.shards ?? 1,
        nextLevelNeed: newIdol.nextLevelNeed ?? 2,
        baseIncomePerSec: newIdol.baseIncomePerSec ?? newIdol.incomePerSec,
        isNew: true,
        isFavorite: false,
      });
      continue;
    }

    const idol = { ...updated[idx] };
    idol.shards = (idol.shards ?? 1) + 1;

    const mergedRarity = getBetterRarity(idol.rarity, newIdol.rarity);
    const mergedMutation = getBetterMutation(idol.mutation, newIdol.mutation);

    if (mergedRarity !== idol.rarity || mergedMutation !== idol.mutation) {
      idol.rarity = mergedRarity;
      idol.mutation = mergedMutation;

      const group = GROUPS.find((g) => g.name === idol.group);
      const member = group?.members.find((m) => m.name === idol.name);

      const rarityMult = getRarityMultiplier(idol.rarity);
      const mutationMult = getMutationMultiplier(idol.mutation);

      idol.baseIncomePerSec = getMemberValue(group, member) * rarityMult * mutationMult;
      idol.incomePerSec = idol.baseIncomePerSec * (1 + ((idol.level ?? 1) - 1) * 0.25);

      if (newIdol.image) idol.image = newIdol.image;
    }

    while (idol.shards >= (idol.nextLevelNeed ?? 2)) {
      idol.shards -= idol.nextLevelNeed ?? 2;
      idol.level = (idol.level ?? 1) + 1;
      idol.nextLevelNeed = 2 ** idol.level;
      idol.incomePerSec = idol.baseIncomePerSec * (1 + (idol.level - 1) * 0.25);
    }

    updated[idx] = idol;
  }

  return updated;
}

export default function App() {

  const loadSave = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const [debugMode, setDebugMode] = useState(true);
  const initialSave = loadSave();
  const [lastUpdateAt, setLastUpdateAt] = useState(Date.now());
  const [money, setMoney] = useState(initialSave?.money ?? 1000);
  const [tab, setTab] = useState(initialSave?.tab ?? "conveyor");
  const [conveyor, setConveyor] = useState(() => cleanConveyor(initialSave?.conveyor));
  const [backpack, setBackpack] = useState(initialSave?.backpack ?? {});
  const [collection, setCollection] = useState(initialSave?.collection ?? []);
  const [selectedIdol, setSelectedIdol] = useState(null);
  const [equippedLightstick, setEquippedLightstick] = useState(initialSave?.equippedLightstick ?? "BlackPink");
  const [opening, setOpening] = useState(() => cleanOpening(initialSave?.opening));
  const [ownedLightsticks, setOwnedLightsticks] = useState(() => initialSave?.ownedLightsticks ?? ["BlackPink"]);
  const [binderSort, setBinderSort] = useState(initialSave?.binderSort ?? "value");
  const [offlineNotice, setOfflineNotice] = useState(null);
  const [revealQueue, setRevealQueue] = useState([]);
  const [activeReveal, setActiveReveal] = useState(null);
  const [floatingIncome, setFloatingIncome] = useState([]);
  const [hoveredIdolId, setHoveredIdolId] = useState(null);
  const [eventNow, setEventNow] = useState(null);
  const [eventCountdown, setEventCountdown] = useState("");
  const [theme, setTheme] = useState(initialSave?.theme ?? "dark");

  const ui = THEMES[theme] ?? THEMES.dark;

  const [debugMoneyInput, setDebugMoneyInput] = useState(1000000);
  const [debugGroup, setDebugGroup] = useState(GROUPS[0]?.name ?? "BlackPink");
  const [debugRarity, setDebugRarity] = useState("Normal");
  const [debugMutation, setDebugMutation] = useState("None");
  const [debugMember, setDebugMember] = useState(GROUPS[0]?.members[0]?.name ?? "");
  const [showUndiscovered, setShowUndiscovered] = useState(initialSave?.showUndiscovered ?? false);


  const openingRef = useRef(opening);
  const nextId = useRef(1);
  const hoverCooldownRef = useRef(0);

  const playerTier = useMemo(() => getPlayerTier(money), [money]);
  const spawnWeights = useMemo(() => getSpawnWeights(playerTier), [playerTier]);
  const completedGroups = useMemo(() => getCompletedGroups(collection), [collection]);
  const totalCollectionCount = useMemo(() => getTotalCollectionCount(), []);
  const styles = useMemo(() => getStyles(ui), [ui]);

  const themeKeys = Object.keys(THEMES);

  const cycleTheme = () => {
    setTheme((prev) => {
      const currentIndex = themeKeys.indexOf(prev);
      const nextIndex = (currentIndex + 1) % themeKeys.length;
      return themeKeys[nextIndex];
    });
  };
  
  const passiveIncomePerSec = useMemo(() => {
    const current = Date.now();

    return collection.reduce((sum, idol) => {
      const bonus = (idol.activeCosmetics || []).reduce(
        (acc, c) => acc + (c.activeUntil > current ? c.passiveBonus : 0),
        0
      );

      return sum + getEffectiveIdolIncome(idol, completedGroups) * (1 + bonus);
    }, 0);
  }, [collection, completedGroups]);

  const ownedCollectionCount = collection.length;
  const completionPct = totalCollectionCount === 0 ? 0 : (ownedCollectionCount / totalCollectionCount) * 100;

  const sortedCollection = useMemo(() => {
    const list = [...collection];
    
    list.sort((a, b) => {
      const aFav = a.isFavorite ? 1 : 0;
      const bFav = b.isFavorite ? 1 : 0;
    
      if (aFav !== bFav) return bFav - aFav;
    
      const aValue = getEffectiveIdolIncome(a, completedGroups);
      const bValue = getEffectiveIdolIncome(b, completedGroups);
    
      if (binderSort === "group") {
        const byGroup = a.group.localeCompare(b.group);
        if (byGroup !== 0) return byGroup;
        return bValue - aValue;
      }
    
      return bValue - aValue;
    });
  
    return list;
  }, [binderSort, collection, completedGroups]);

  const binderDisplayList = useMemo(() => {
  const ownedMap = new Map(
    collection.map((idol) => [`${idol.group}|||${idol.name}`, idol])
  );

  const fullList = GROUPS.flatMap((group) =>
    group.members.map((member) => {
      const key = `${group.name}|||${member.name}`;
      const owned = ownedMap.get(key);

      if (owned) {
        return {
          ...owned,
          discovered: true,
          pullWeight: member.weight,
          pullChanceText: `${member.weight}%`,
        };
      }

      return {
        id: `missing-${group.name}-${member.name}`,
        name: member.name,
        group: group.name,
        tier: group.tier,
        image: member.image || null,
        discovered: false,
        rarity: null,
        mutation: null,
        level: null,
        shards: null,
        nextLevelNeed: null,
        incomePerSec: null,
        baseIncomePerSec: null,
        pullWeight: member.weight,
        pullChanceText: `${member.weight}%`,
      };
    })
  );

  const filtered = showUndiscovered
    ? fullList
    : fullList.filter((idol) => idol.discovered);

  filtered.sort((a, b) => {
   const aFav = a.discovered && a.isFavorite ? 1 : 0;
   const bFav = b.discovered && b.isFavorite ? 1 : 0;

   if (aFav !== bFav) return bFav - aFav;

   if (binderSort === "group") {
     const byGroup = a.group.localeCompare(b.group);
     if (byGroup !== 0) return byGroup;

     if (a.discovered && b.discovered) {
       const aValue = getEffectiveIdolIncome(a, completedGroups);
       const bValue = getEffectiveIdolIncome(b, completedGroups);
       return bValue - aValue;
     }

     return a.name.localeCompare(b.name);
   }

   if (!a.discovered && !b.discovered) {
     return b.pullWeight - a.pullWeight;
   }
   if (!a.discovered) return 1;
   if (!b.discovered) return -1;

   const aValue = getEffectiveIdolIncome(a, completedGroups);
   const bValue = getEffectiveIdolIncome(b, completedGroups);
   return bValue - aValue;
  });

  return filtered;
}, [collection, showUndiscovered, binderSort, completedGroups]);

function mutationStyle(name) {
  if (name === "Astral") return styles.pill("#7612a4"); // cosmic blue
  if (name === "BloodMoon") return styles.pill("#ef4444"); // deep red
  if (name === "Cherry Blossom") return styles.pill("#f9a8d4", "#4a044e"); // pink blossom
  return styles.pill("#a21caf"); // fallback
}

function rarityStyle(name) {
  if (name === "Gold") return styles.pill("#fbbf24", "#111827");
  if (name === "Diamond") return styles.pill("#67e8f9", "#111827");
  if (name === "Ruby") return styles.pill("#fb7185", "#111827");
  return styles.pill("#334155");
}

  const playHover = () => {
  const now = Date.now();
  if (now - hoverCooldownRef.current < 50) return;

  hoverCooldownRef.current = now;

  const pitch = 0.95 + Math.random() * 0.1;

  const audio = new Audio(hoverSfx);
  audio.volume = 0.35;
  audio.playbackRate = pitch;
  audio.play().catch(() => {});
};


  useEffect(() => {
  const updateEventInfo = () => {
    const now = new Date();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    const event = getCurrentMutationEvent(now);

    if (event) {
      const remainingSec = ((event.endsAtMinute % 60) - minute + 60) % 60 * 60 - second;
      setEventNow({
        type: "active",
        mutation: event.mutation,
        remainingSec,
      });
      return;
    }

    let nextMutation = "Astral";
    let nextMinute = 15;

    if (minute < 15) {
      nextMutation = "Astral";
      nextMinute = 15;
    } else if (minute < 35) {
      nextMutation = "BloodMoon";
      nextMinute = 35;
    } else if (minute < 55) {
      nextMutation = "Cherry Blossom";
      nextMinute = 55;
    } else {
      nextMutation = "Astral";
      nextMinute = 75; // next hour :15
    }

    const remainingSec = (nextMinute - minute) * 60 - second;

    setEventNow({
      type: "upcoming",
      mutation: nextMutation,
      remainingSec,
    });
  };

  updateEventInfo();
  const id = setInterval(updateEventInfo, 1000);
  return () => clearInterval(id);
}, []);

  useEffect(() => {
    openingRef.current = opening;
  }, [opening]);

  useEffect(() => {
    const saveData = {
      money,
      tab,
      conveyor,
      backpack,
      opening,
      collection,
      equippedLightstick,
      ownedLightsticks,
      binderSort,
      lastSavedAt: Date.now(),
      showUndiscovered,
      theme,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  }, [money, tab, conveyor, backpack, opening, collection, equippedLightstick, ownedLightsticks, binderSort, showUndiscovered, theme]);

  useEffect(() => {
    if (!initialSave?.lastSavedAt) return;

    const elapsedMs = Date.now() - initialSave.lastSavedAt;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    if (elapsedSec <= 0) return;

    const completed = getCompletedGroups(initialSave.collection ?? []);

    const passivePerSec = (initialSave.collection ?? []).reduce((sum, idol) => {
      const bonus = (idol.activeCosmetics || []).reduce(
        (acc, c) => acc + (c.activeUntil > Date.now() ? c.passiveBonus : 0),
        0
      );
      return sum + getEffectiveIdolIncome(idol, completed) * (1 + bonus);
    }, 0);

    const capSeconds = 60 * 60 * 8;
    const payoutSeconds = Math.min(elapsedSec, capSeconds);
    const offlineIncome = passivePerSec * payoutSeconds;

    if (offlineIncome > 0) {
      setMoney((m) => m + offlineIncome);
      setOfflineNotice({ seconds: payoutSeconds, income: offlineIncome });
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();

      setLastUpdateAt((prev) => {
        const deltaSec = Math.max(0, (current - prev) / 1000);

        if (deltaSec > 0) {
          setMoney((m) => {
            const passivePerSec = collection.reduce((sum, idol) => {
              const bonus = (idol.activeCosmetics || []).reduce(
                (acc, c) => acc + (c.activeUntil > current ? c.passiveBonus : 0),
                0
              );
              return sum + getEffectiveIdolIncome(idol, completedGroups) * (1 + bonus);
            }, 0);

            return m + passivePerSec * deltaSec;
          });
        }

        return current;
      });
    }, 250);

    return () => clearInterval(id);
  }, [collection, completedGroups]);

  useEffect(() => {
    const spawnPack = () => {
      setConveyor((prev) => {
        const current = cleanConveyor(prev);
        if (current.length >= CONVEYOR_MAX) return current;

        const chosen = weightedPick(spawnWeights, "weight").group;
        const rarity = weightedPick(RARITIES, "weight");
        const mutation = maybeMutation();

        const newPack = {
          id: nextId.current++,
          group: chosen.name,
          tier: chosen.tier,
          cost: chosen.cost * (RARITY_PACK_PRICE_MULT[rarity.name] || 1),
          rarity: rarity.name,
          rarityMult: rarity.mult,
          mutation: mutation?.name || null,
          mutationMult: mutation?.mult || 1,
          packImage: chosen.packImage || null,
          spawnedAt: Date.now(),
          expiresAt: Date.now() + CONVEYOR_LIFETIME_MS,
        };

        return [...current, newPack].slice(-CONVEYOR_MAX);
      });
    };

    setConveyor((prev) => {
      const current = cleanConveyor(prev);
      if (current.length === 0) {
        const chosen = weightedPick(spawnWeights, "weight").group;
        const rarity = weightedPick(RARITIES, "weight");
        const mutation = maybeMutation();

        return [
          {
            id: nextId.current++,
            group: chosen.name,
            tier: chosen.tier,
            cost: chosen.cost * (RARITY_PACK_PRICE_MULT[rarity.name] || 1),
            rarity: rarity.name,
            rarityMult: rarity.mult,
            mutation: mutation?.name || null,
            mutationMult: mutation?.mult || 1,
            packImage: chosen.packImage || null,
            spawnedAt: Date.now(),
            expiresAt: Date.now() + CONVEYOR_LIFETIME_MS,
          },
        ];
      }
      return current;
    });

    const id = setInterval(spawnPack, 5000);
    return () => clearInterval(id);
  }, [spawnWeights]);

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      const currentOpening = openingRef.current;

      const done = [];
      const stillOpening = [];

      for (const pack of currentOpening) {
        const deltaSec = (current - pack.lastProgressAt) / 1000;
        const speed = pack.group === equippedLightstick ? 2 : 1;
        const progressGain = (deltaSec / pack.baseSec) * speed;

        const updatedPack = {
          ...pack,
          progress: Math.min(1, pack.progress + progressGain),
          lastProgressAt: current,
        };

        if (!pack.completed && updatedPack.progress >= 1) {
          done.push({ ...updatedPack, completed: true });
        } else if (!updatedPack.completed) {
          stillOpening.push(updatedPack);
        }
      }

      if (done.length > 0) {
        const idols = done.map(openPack);
        setRevealQueue((prev) => [...prev, ...idols]);
      }

      setOpening(stillOpening);
      setConveyor((prev) => prev.filter((p) => p.expiresAt > Date.now()));
    }, 500);

    return () => clearInterval(id);
  }, [equippedLightstick]);

  useEffect(() => {
    if (floatingIncome.length === 0) return;

    const timer = setTimeout(() => {
      setFloatingIncome((prev) => prev.slice(1));
    }, 800); // match your CSS transition

    return () => clearTimeout(timer);
  }, [floatingIncome]);
  
  useEffect(() => {
    if (activeReveal) return;
    if (revealQueue.length === 0) return;

    const nextReveal = revealQueue[0];

    playSound(revealSfx, 0.55);
    // playSound(getRevealSfxByRarity(nextReveal.rarity), 0.55);

    setActiveReveal(nextReveal);
    setRevealQueue((q) => q.slice(1));

    const timer = setTimeout(() => {
      setCollection((old) => mergeOpenedIdols(old, [nextReveal]));
      setActiveReveal(null);
    }, REVEAL_DURATION_MS);

    return () => clearTimeout(timer);
  }, [activeReveal, revealQueue]);

  const createDebugPack = ({ groupName, rarityName, mutationName }) => {
  const group = GROUPS.find((g) => g.name === groupName);
  const rarity = RARITIES.find((r) => r.name === rarityName);
  const mutation =
    mutationName === "None"
      ? null
      : MUTATIONS.find((m) => m.name === mutationName);

  return {
    id: nextId.current++,
    group: group.name,
    tier: group.tier,
    cost: group.cost,
    rarity: rarity.name,
    rarityMult: rarity.mult,
    mutation: mutation?.name || null,
    mutationMult: mutation?.mult || 1,
    packImage: group.packImage || null,
    spawnedAt: Date.now(),
    expiresAt: Date.now() + CONVEYOR_LIFETIME_MS,
  };
};

const createDebugIdol = ({ groupName, memberName, rarityName, mutationName }) => {
  const group = GROUPS.find((g) => g.name === groupName);
  const member = group.members.find((m) => m.name === memberName);
  const rarityMult = getRarityMultiplier(rarityName);
  const mutationMult =
    mutationName === "None" ? 1 : getMutationMultiplier(mutationName);

  const finalIncome =
    getMemberValue(group, member) * rarityMult * mutationMult;

  return {
    id: nextId.current++,
    name: member.name,
    group: group.name,
    tier: group.tier,
    rarity: rarityName,
    mutation: mutationName === "None" ? null : mutationName,
    incomePerSec: finalIncome,
    baseIncomePerSec: finalIncome,
    level: 1,
    shards: 1,
    nextLevelNeed: 2,
    ownedCosmetics: COSMETICS.map((c) => ({ ...c, level: 0, activeUntil: 0 })),
    activeCosmetics: [],
    image: member.image || null,
  };
};

const debugAddMoney = () => {
  setMoney((m) => m + Number(debugMoneyInput || 0));
};

const debugSpawnPackToConveyor = () => {
  const pack = createDebugPack({
    groupName: debugGroup,
    rarityName: debugRarity,
    mutationName: debugMutation,
  });

  setConveyor((prev) => [...cleanConveyor(prev), pack].slice(-CONVEYOR_MAX));
};

const debugAddPackToBackpack = () => {
  const pack = createDebugPack({
    groupName: debugGroup,
    rarityName: debugRarity,
    mutationName: debugMutation,
  });

  const key = `${pack.group}|${pack.rarity}|${pack.mutation || "None"}`;
  setBackpack((prev) => ({
    ...prev,
    [key]: { ...(prev[key] || pack), count: (prev[key]?.count || 0) + 1 },
  }));
};

const debugAddIdolToBinder = () => {
  const idol = createDebugIdol({
    groupName: debugGroup,
    memberName: debugMember,
    rarityName: debugRarity,
    mutationName: debugMutation,
  });

  setCollection((prev) => mergeOpenedIdols(prev, [idol]));
};

const debugAddAllIdols = () => {
  const allIdols = GROUPS.flatMap((group) =>
    group.members.map((member) =>
      createDebugIdol({
        groupName: group.name,
        memberName: member.name,
        rarityName: "Normal",
        mutationName: "None",
      })
    )
  );

  setCollection((prev) => mergeOpenedIdols(prev, allIdols));
};

const debugClearBinder = () => setCollection([]);
const debugClearConveyor = () => setConveyor([]);
const debugClearBackpack = () => setBackpack({});
const debugClearOpening = () => setOpening([]);

useEffect(() => {
  const selectedGroup = GROUPS.find((g) => g.name === debugGroup);
  if (!selectedGroup) return;
  setDebugMember(selectedGroup.members[0]?.name ?? "");
}, [debugGroup]);

  const buyPack = (pack) => {
    if (money < pack.cost) return;

      playSound(buySfx, 0.4);

    setMoney((m) => m - pack.cost);
    const key = `${pack.group}|${pack.rarity}|${pack.mutation || "None"}`;
    setBackpack((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || pack), count: (prev[key]?.count || 0) + 1 },
    }));
    setConveyor((prev) => prev.filter((p) => p.id !== pack.id));
  };

  const queuePack = (key) => {
    const pack = backpack[key];
    if (!pack || pack.count <= 0 || opening.length >= 20) return;

    const group = GROUPS.find((g) => g.name === pack.group);
    const baseSec = OPEN_TIME_BY_TIER_SEC[group.tier - 1] || 4500;

    setOpening((prev) => [
      ...prev,
      {
        ...pack,
        id: nextId.current++,
        progress: 0,
        lastProgressAt: Date.now(),
        baseSec,
        completed: false,
      },
    ]);

    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const nextCount = current.count - 1;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      return { ...prev, [key]: { ...current, count: nextCount } };
    });

    playSound(buySfx, 0.4);
  };

  const trashPack = (key) => {
    const pack = backpack[key];
    if (!pack || pack.count <= 0) return;
    setMoney((m) => m + pack.cost * 0.3);
    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const nextCount = current.count - 1;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      return { ...prev, [key]: { ...current, count: nextCount } };
    });
    playSound(trashSfx, 0.4);
  };

  const openPack = (pack) => {
    const group = GROUPS.find((g) => g.name === pack.group);
    const member = weightedPick(group.members, "weight");
    const finalIncome = getMemberValue(group, member) * pack.rarityMult * pack.mutationMult;

    return {
      id: nextId.current++,
      name: member.name,
      group: group.name,
      tier: group.tier,
      rarity: pack.rarity,
      mutation: pack.mutation,
      incomePerSec: finalIncome,
      baseIncomePerSec: finalIncome,
      level: 1,
      shards: 1,
      nextLevelNeed: 2,
      ownedCosmetics: COSMETICS.map((c) => ({ ...c, level: 0, activeUntil: 0 })),
      activeCosmetics: [],
      image: member.image || null,
    };
  };

  const toggleFavorite = (idolId) => {
  setCollection((prev) =>
    prev.map((idol) =>
      idol.id === idolId
        ? { ...idol, isFavorite: !idol.isFavorite }
        : idol
    )
  );
};

  const tapIdol = (idol, event) => {
  playSound(coinSfx, 0.3);

  const bonus = (idol.activeCosmetics || []).reduce(
    (acc, c) => acc + (c.activeUntil > Date.now() ? c.tapBonus : 0),
    0
  );

  const earned = getEffectiveIdolIncome(idol, completedGroups) * (1 + bonus);
  setMoney((m) => m + earned);

  if (idol.isNew) {
    setCollection((prev) =>
      prev.map((i) =>
        i.id === idol.id ? { ...i, isNew: false } : i
      )
    );
  }

  

  // Add floating income
  if (event) {
    setFloatingIncome((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x: event.clientX,
        y: event.clientY,
        amount: earned,
      },
    ]);
  }
};

  const upgradeCosmetic = (idol, key) => {
    const currentLevel = idol.ownedCosmetics.find((c) => c.key === key)?.level || 0;
    const cost = getEffectiveIdolIncome(idol, completedGroups) * 60 * (currentLevel + 1);
    if (money < cost) return;
    setMoney((m) => m - cost);
    setCollection((prev) =>
      prev.map((i) =>
        i.id !== idol.id
          ? i
          : {
              ...i,
              ownedCosmetics: i.ownedCosmetics.map((c) =>
                c.key === key && c.level < 3 ? { ...c, level: c.level + 1 } : c
              ),
            }
      )
    );
  };

  const activateCosmetic = (idol, key) => {
    setCollection((prev) =>
      prev.map((i) =>
        i.id !== idol.id
          ? i
          : {
              ...i,
              activeCosmetics: i.ownedCosmetics
                .filter((c) => c.level > 0)
                .map((c) =>
                  c.key === key ? { ...c, activeUntil: Date.now() + [0, 15000, 30000, 60000][c.level] } : c
                ),
            }
      )
    );
    setSelectedIdol((s) => (s && s.id === idol.id ? { ...s } : s));
  };

  const backpackEntries = Object.entries(backpack).filter(([, pack]) => pack.count > 0);
  const eventColor = eventNow ? EVENT_COLORS[eventNow.mutation] : "#64748b";

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={{ marginTop: 0, color: ui.text, fontFamily: 'Comic Sans MS' }}>Idol Collector Prototype</h1>
        <button
          style={styles.buttonAlt}
          onClick={() => {
            localStorage.removeItem(SAVE_KEY);
            window.location.reload();
          }}
        >
          Reset Save
        </button>

        <div style={{...styles.statsGrid, marginTop: 14}}>
          <div style={styles.card}>
            <div style={styles.small}>Balance</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>${fmt(money)}</div>
            <div style={{ ...styles.small, marginTop: 6, color: "#b3f59f" }}>
              +${fmt(passiveIncomePerSec)}/s
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Player Tier</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Tier {playerTier}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Opening Queue</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{opening.length}/20</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Lightstick</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{equippedLightstick}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Collection Completion</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{ownedCollectionCount}/{totalCollectionCount}</div>
            <div style={styles.small}>{completionPct.toFixed(1)}% complete</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Set Bonuses Active</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{completedGroups.size}</div>
            <div style={styles.small}>+20% income for each completed group</div>
          </div>
        </div>

        {offlineNotice ? (
          <div style={{ ...styles.card, marginBottom: 16, borderColor: "#0ea5e9" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Offline earnings collected</div>
            <div style={{ marginTop: 4 }}>
              You earned <b>${fmt(offlineNotice.income)}</b> over {Math.floor(offlineNotice.seconds / 60)}m {offlineNotice.seconds % 60}s away.
            </div>
          </div>
        ) : null}

        {eventNow ? (
          <div
            style={{
              ...styles.card,
              marginBottom: 16,
              borderColor: eventColor,
              boxShadow: `0 0 18px ${eventColor}33`,
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {eventNow.type === "active" ? (
                <>
                  <span style={{ color: eventColor, textShadow: `0 0 8px ${eventColor}66` }}>
                    {eventNow.mutation}
                  </span>{" "}
                  Event ending in
                </>
              ) : (
                <>
                  Next Event - {" "}
                  <span style={{ color: eventColor, textShadow: `0 0 8px ${eventColor}66` }}>
                    {eventNow.mutation}
                  </span>{" "}
                  in:
                </>
              )}
            </div>
            
            <div style={{ marginTop: 4 }}>
              <b>
                {Math.floor(eventNow.remainingSec / 60)}m{" "}
                {eventNow.remainingSec % 60}s
              </b>
            </div>
          </div>
        ) : null}

        <div style={styles.tabs}>
          {["conveyor", "binder", "sets", ...(debugMode ? ["debug"] : [])].map((name) => (
            <button key={name} style={styles.tabBtn(tab === name)} onClick={() => setTab(name)}>
              {name === "binder" ? "Collection Binder" : name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        {tab === "conveyor" && (
          <>
            <ConveyorSection
                conveyor={conveyor}
                styles={styles}
                rarityStyle={rarityStyle}
                mutationStyle={mutationStyle}
                MutationParticles={MutationParticles}
                buyPack={buyPack}
                money={money}
                playHover={playHover}
                fmt={fmt}
                CONVEYOR_LIFETIME_MS={CONVEYOR_LIFETIME_MS}
                MUTATION_VISUALS={MUTATION_VISUALS}
              />
            <div style={{ ...styles.grid2, marginTop: 16 }}>
              <div style={styles.card}>
                <div style={styles.row}>
                  <h2 style={{ marginTop: 0, color: ui.text }}>Backpack</h2>
                  <div style={styles.small}>Queue limit: 20 packs</div>
                </div>
                {backpackEntries.length === 0 ? <div style={styles.small}>No packs yet.</div> : backpackEntries.map(([key, pack]) => (
                  <div key={key} style={{ ...styles.card, marginBottom: 10, background: "rgba(30,41,59,0.55)" }}>
                    <div style={styles.row}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{pack.group} ×{pack.count}</div>
                        <div style={styles.small}>{pack.rarity}{pack.mutation ? ` • ${pack.mutation}` : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={styles.button} onClick={() => queuePack(key)}>Open</button>
                        <button style={styles.buttonAlt} onClick={() => trashPack(key)}>Trash</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.card}>
                <div style={styles.row}>
                  <h2 style={{ marginTop: 0, color: ui.text }}>Opening Queue</h2>
                  <div style={styles.small}>Matching lightstick = 2× speed</div>
                </div>
                {opening.length === 0 ? <div style={styles.small}>No packs opening.</div> : opening.map((pack) => {
                  const pct = pack.progress * 100;
                  const speed = pack.group === equippedLightstick ? 2 : 1;
                  const remainingSec = Math.ceil((1 - pack.progress) * pack.baseSec / speed);
                  return (
                    <div key={pack.id} style={{ marginBottom: 12 }}>
                      <div style={styles.row}>
                        <div>
                          <b>{pack.group}</b>
                          <div style={styles.small}>{pack.rarity}{pack.mutation ? ` • ${pack.mutation}` : ""}</div>
                        </div>
                        <div>
                          {remainingSec}s {speed > 1 ? <span style={styles.small}>⚡ boosted</span> : null}
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>{progressBar(pct, ui)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === "binder" && (
          <div style={styles.card}>
            <h2 style={{ marginTop: 0, color: ui.text }}>Collection Binder</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button style={binderSort === "value" ? styles.button : styles.buttonAlt} onClick={() => setBinderSort("value")}>Sort: Value</button>
              <button style={binderSort === "group" ? styles.button : styles.buttonAlt} onClick={() => setBinderSort("group")}>Sort: Group</button>
              <button style={showUndiscovered ? styles.button : styles.buttonAlt} onClick={() => setShowUndiscovered((prev) => !prev)}>{showUndiscovered ? "Hide Undiscovered" : "Show Undiscovered"}</button>
            </div>
            <div style={styles.binder}>
              {collection.length === 0 ? <div style={styles.small}>Open packs and your binder will fill up here.</div> : binderDisplayList.map((idol) => {
                const effectiveIncome = getEffectiveIdolIncome(idol, completedGroups);
                const setBonusActive = completedGroups.has(idol.group);
                const isHovered = hoveredIdolId === idol.id;
                const isMissing = !idol.discovered;



                return (
                  <div
                    key={idol.id}
                    style={{
                      ...styles.packCard,
                    
                        border: isMissing ? "1px dashed #475569": getRarityBorder(idol.rarity),
                        opacity: isMissing ? 0.7 : 1,
                        width: "100%",
                        marginTop: 10,
                        filter: isMissing ? "grayscale(1)" : "none",
                        transform: isHovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
                        transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
                        boxShadow: isHovered
                          ? idol.rarity === "Ruby"
                            ? "0 0 28px rgb(251, 113, 134)"
                            : idol.rarity === "Diamond"
                            ? "0 0 24px rgb(103, 232, 249)"
                            : idol.rarity === "Gold"
                            ? "0 0 20px rgb(255, 183, 0)"
                            : "0 10px 24px rgba(0,0,0,0.28)"
                          : undefined,
                    }}
                    onClick={(e) => tapIdol(idol, e)}
                    onMouseEnter={() => {
                      setHoveredIdolId(idol.id);
                      playHover();
                    }}
                    onMouseLeave={() => setHoveredIdolId(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (idol.isNew) {
                        setCollection((prev) =>
                          prev.map((i) =>
                            i.id === idol.id ? { ...i, isNew: false } : i
                          )
                        );
                      }
                      setSelectedIdol(idol);
                    }}
                  >
                    <div
                      style={{
                        ...styles.idolBox,
                        padding: getIdolImage(idol) ? 0 : 12,
                        background: isMissing ? "linear-gradient(135deg, rgba(100,116,139,0.2), rgba(30,41,59,0.3))"
                          : getIdolImage(idol) ? "transparent" : styles.idolBox.background,
                        border: isMissing ? "1px solid #475569" : getMutationBorder(idol.mutation),
                        color: isMissing ? "#ffffff00" : getMutationColor(idol.mutation),
                        transition: "box-shadow 0.2s ease, transform 0.18s ease",
                        boxShadow:isMissing ? "none": 
                          idol.mutation === "Astral"
                            ? `0 0 ${isHovered ? 28 : 14}px rgba(207, 74, 255, ${isHovered ? 0.65 : 0.35})`
                            : idol.mutation === "BloodMoon"
                            ? `0 0 ${isHovered ? 28 : 14}px rgba(255, 87, 36, ${isHovered ? 0.7 : 0.45})`
                            : idol.mutation === "Cherry Blossom"
                            ? `0 0 ${isHovered ? 28 : 14}px rgba(255, 166, 215, ${isHovered ? 1 : 0.85})`
                            : "none",
                        animation: "shadowPulse 1s infinite ease-in-out"
                      }}
                    >
                      {getIdolImage(idol) ? (
                        <img src={getIdolImage(idol)} alt={idol.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, display: "block", position: "relative", zIndex: 1, filter: isMissing ? "grayscale(1) brightness(0.4) blur(6px)"  : "none", }} />
                      ) : (
                        <div style={{ position: "relative", zIndex: 1 }}>
                          <div style={{ fontSize: 24, fontWeight: 800 }}>{idol.name}</div>
                          <div style={{ color: ui.subtext }}>{idol.group}</div>
                        </div>
                      )}

                      {idol.isNew && (
                        <div
                          style={{
                            position: "absolute",
                            top: 10,
                            left: 10,
                            zIndex: 4,
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: "linear-gradient(90deg, #22c55e, #86efac)",
                            color: "#052e16",
                            boxShadow: "0 0 10px rgba(134,239,172,0.45)",
                          }}
                        >
                          NEW!
                        </div>
                      )}

                      {!isMissing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(idol.id);
                          }}
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            zIndex: 4,
                            border: "none",
                            background: idol.isFavorite ? "#fbbf24" : "rgba(15,23,42,0.72)",
                            color: idol.isFavorite ? "#111827" : "#e5e7eb",
                            borderRadius: 999,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontWeight: 800,
                            boxShadow: idol.isFavorite ? "0 0 12px rgba(251,191,36,0.4)" : "none",
                          }}
                        >
                          ★
                        </button>
                      )}

                      {!isMissing && <MutationParticles mutation={idol.mutation} dense={isHovered}/>}
                    </div>
                    <div style={{ ...styles.row, marginTop: 10, alignItems: "flex-start" }}>
                      <span style={styles.levelBadge(idol.level)}>Lv {idol.level}</span>
                      <span style={rarityStyle(idol.rarity)}>{idol.rarity}</span>
                      {idol.mutation ? <span style={mutationStyle(idol.mutation)}>{idol.mutation}</span> : null}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>
                        {idol.name}
                      </div>

                      <div style={{ fontSize: 16, color: ui.subtext }}>
                        {idol.group}
                      </div>
                    {isMissing ? (
                    <>
                      <div style={{ marginTop: 8, fontWeight: 700, color: "#94a3b8" }}>
                        Not owned
                      </div>
                                      
                      <div style={{ ...styles.small, marginTop: 6 }}>
                        Pull Rate: <b style={{color: '#ffffff'}}>{idol.pullChanceText}</b>
                      </div>
                                      
                      <div style={styles.small}>
                        From <b style={{color: '#ffffff'}}>{idol.group}</b> packs
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginTop: 6 }}>
                        Income: <b>${fmt(effectiveIncome)}/s</b>
                      </div>
                  
                      <div style={styles.small}>
                        Lv {idol.level} • Stored pulls: {idol.shards}/{idol.nextLevelNeed}
                      </div>
                  
                      {setBonusActive && (
                        <div style={{ ...styles.small, marginTop: 6, color: "#67e8f9" }}>
                          Set bonus active: +20% income
                        </div>
                      )}
                    </>
                  )}</div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "sets" && (
          <div style={styles.grid2}>
            {GROUPS.map((group) => {
              const owned = new Set(collection.filter((i) => i.group === group.name).map((i) => i.name));
              const progress = owned.size;
              const done = progress === group.members.length;
              return (
                <div key={group.name} style={styles.card}>
                  <div style={styles.row}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{group.name}</div>
                    <span style={done ? styles.pill("#34d399", "#111827") : styles.pill("#475569")}>
                      {done ? "Set Complete" : `${progress}/${group.members.length}`}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>{progressBar((progress / group.members.length) * 100, ui)}</div>
                  <div style={{ ...styles.small, marginTop: 8 }}>
                    {done ? `Bonus active: +${Math.round(SET_BONUS_PER_COMPLETE * 100)}% income for ${group.name} idols.` : `Complete this group to unlock +${Math.round(SET_BONUS_PER_COMPLETE * 100)}% income for that group's idols.`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "debug" && (
  <div style={styles.grid2}>
    <div style={styles.card}>
      <h2 style={{ marginTop: 0, color: ui.text }}>Debug Economy</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="number"
          value={debugMoneyInput}
          onChange={(e) => setDebugMoneyInput(Number(e.target.value))}
          style={{ ...styles.buttonAlt, minWidth: 180 }}
        />
        <button style={styles.button} onClick={debugAddMoney}>
          Add Money
        </button>
      </div>
    </div>

    <div style={styles.card}>
      <h2 style={{ marginTop: 0, color: ui.text }}>Debug Pack / Idol Builder</h2>

      <div style={{ display: "grid", gap: 10 }}>
        <select
          value={debugGroup}
          onChange={(e) => setDebugGroup(e.target.value)}
          style={styles.buttonAlt}
        >
          {GROUPS.map((group) => (
            <option key={group.name} value={group.name}>
              {group.name}
            </option>
          ))}
        </select>

        <select
          value={debugMember}
          onChange={(e) => setDebugMember(e.target.value)}
          style={styles.buttonAlt}
        >
          {(GROUPS.find((g) => g.name === debugGroup)?.members ?? []).map((member) => (
            <option key={member.name} value={member.name}>
              {member.name}
            </option>
          ))}
        </select>

        <select
          value={debugRarity}
          onChange={(e) => setDebugRarity(e.target.value)}
          style={styles.buttonAlt}
        >
          {RARITIES.map((rarity) => (
            <option key={rarity.name} value={rarity.name}>
              {rarity.name}
            </option>
          ))}
        </select>

        <select
          value={debugMutation}
          onChange={(e) => setDebugMutation(e.target.value)}
          style={styles.buttonAlt}
        >
          <option value="None">None</option>
          {MUTATIONS.map((mutation) => (
            <option key={mutation.name} value={mutation.name}>
              {mutation.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button style={styles.button} onClick={debugSpawnPackToConveyor}>
          Spawn Pack to Conveyor
        </button>
        <button style={styles.button} onClick={debugAddPackToBackpack}>
          Add Pack to Backpack
        </button>
        <button style={styles.button} onClick={debugAddIdolToBinder}>
          Add Idol to Binder
        </button>
      </div>
    </div>

    <div style={styles.card}>
      <h2 style={{ marginTop: 0, color: ui.text }}>Debug Collection Tools</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={styles.button} onClick={debugAddAllIdols}>
          Add All Idols
        </button>
        <button style={styles.buttonAlt} onClick={debugClearBinder}>
          Clear Binder
        </button>
        <button style={styles.buttonAlt} onClick={debugClearConveyor}>
          Clear Conveyor
        </button>
        <button style={styles.buttonAlt} onClick={debugClearBackpack}>
          Clear Backpack
        </button>
        <button style={styles.buttonAlt} onClick={debugClearOpening}>
          Clear Opening Queue
        </button>
      </div>
    </div>
  </div>
)}
        {floatingIncome.map((f) => (
          <FloatingIncomeText 
            key={f.id} 
            id={f.id} 
            amount={f.amount} 
            x={f.x} 
            y={f.y} 
            onDone={(doneId) =>
              setFloatingIncome((prev) => prev.filter((fi) => fi.id !== doneId))
            }
            />
        ))}

        <div style={{ ...styles.card, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 , color: ui.text}}>Lightsticks</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {GROUPS.map((group) => {
              const price = group.cost * 3;
              const owned = ownedLightsticks.includes(group.name);

              return (
                <button
                  key={group.name}
                  style={{ ...(equippedLightstick === group.name ? styles.button : styles.buttonAlt), textAlign: "left" }}
                  onClick={() => {
                    if (equippedLightstick === group.name) return;

                    if (!owned) {
                      if (money < price) return;
                      setMoney((m) => m - price);
                      setOwnedLightsticks((prev) => [...prev, group.name]);
                    }

                    setEquippedLightstick(group.name);
                    playSound(equipSfx, 0.4)
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{group.name}</div>
                  <div style={styles.small}>{owned ? "Owned" : `$${fmt(price)}`}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeReveal ? (
          <div
            style={styles.modalBg}
            onClick={() => {
              if (!activeReveal) return;
              setCollection((old) => mergeOpenedIdols(old, [activeReveal]));
              setActiveReveal(null);
            }}
          >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
              border: getRarityBorder(activeReveal.rarity),
              borderRadius: 28,
              padding: 24,
              position: "relative",
              overflow: "hidden",
              animation: `revealPop ${REVEAL_DURATION_MS}ms ease forwards`,
              boxShadow: activeReveal.mutation ? MUTATION_VISUALS[activeReveal.mutation]?.glow : "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
              <div style={{ ...styles.small, letterSpacing: 2, textTransform: "uppercase" }}>New Pull</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{activeReveal.name}</div>
              <div style={{ fontSize: 18, color: ui.subtext, marginTop: 6 }}>{activeReveal.group}</div>
            </div>
            <div style={{ ...styles.idolBox, 
              padding: getIdolImage(activeReveal) ? 0 : 12, 
              background: getIdolImage(activeReveal) ? "transparent" : styles.idolBox.background, 
              marginTop: 18, 
              minHeight: 290, 
              color: getMutationColor(activeReveal.mutation),
              border: getMutationBorder(activeReveal.mutation), 
              boxShadow: "0 0 24px rgba(255,255,255,0.08)",
              animation: "shadowPulse 1s infinite ease-in-out" 
            }}>
              {getIdolImage(activeReveal) ? (
                <img src={getIdolImage(activeReveal)} alt={activeReveal.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16, position: "relative", zIndex: 1 }} />
              ) : (
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 36, fontWeight: 900 }}>{activeReveal.name}</div>
                  <div style={{ color: ui.subtext, marginTop: 8 }}>{activeReveal.group}</div>
                </div>
              )}
              <MutationParticles mutation={activeReveal.mutation} dense />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16, position: "relative", zIndex: 2 }}>
              <span style={rarityStyle(activeReveal.rarity)}>{activeReveal.rarity}</span>
              {activeReveal.mutation ? <span style={mutationStyle(activeReveal.mutation)}>{activeReveal.mutation}</span> : null}
              <span style={styles.pill("#0f766e")}>${fmt(activeReveal.incomePerSec)}/s</span>
            </div>
          </div>
        </div>
      ) : null}

      {selectedIdol ? (
        <div style={styles.modalBg} onClick={() => setSelectedIdol(null)}>
          <div style={{...styles.modal, border: getRarityBorder(selectedIdol.rarity)}} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <h2 style={{ margin: 0 }}>{selectedIdol.name} • {selectedIdol.group}</h2>
              <button style={styles.buttonAlt} onClick={() => setSelectedIdol(null)}>Close</button>
            </div>
            <div style={{ ...styles.grid2, marginTop: 16 }}>
              <div>
                <div style={{ ...styles.idolBox, 
                  padding: getIdolImage(selectedIdol) ? 0 : 12, 
                  background: getIdolImage(selectedIdol) ? "transparent" : styles.idolBox.background, 
                  minHeight: 360, 
                  color: getMutationColor(selectedIdol.mutation),
                  border: getMutationBorder(selectedIdol.mutation),
                  animation: "shadowPulse 1s infinite ease-in-out" 
                  }}>
                  {getIdolImage(selectedIdol) ? <img src={getIdolImage(selectedIdol)} alt={selectedIdol.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16, position: "relative", zIndex: 1 }} /> : (
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ fontSize: 34, fontWeight: 800 }}>{selectedIdol.name}</div>
                      <div style={{ color: ui.subtext }}>{selectedIdol.group}</div>
                    </div>
                  )}
                  <MutationParticles mutation={selectedIdol.mutation} dense />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <span style={rarityStyle(selectedIdol.rarity)}>{selectedIdol.rarity}</span>
                  {selectedIdol.mutation ? <span style={mutationStyle(selectedIdol.mutation)}>{selectedIdol.mutation}</span> : null}
                  <span style={styles.pill("#0f766e")}>${fmt(getEffectiveIdolIncome(selectedIdol, completedGroups))}/s</span>
                </div>
                <div style={{ marginTop: 32, fontSize: 40, fontWeight: 800 }}>{selectedIdol.name}</div>
                <div style={{ marginTop: 8, fontSize: 18, color: ui.subtext }}>{selectedIdol.group}</div>
                {completedGroups.has(selectedIdol.group) ? (
                  <div style={{ ...styles.small, marginTop: 8, color: "#67e8f9" }}>Set bonus active: +20% income</div>
                ) : null}
              </div>
              <div>
                <div style={styles.card}>
                  <h3 style={{ marginTop: 0 }}>Cosmetics</h3>
                  {selectedIdol.ownedCosmetics.map((cos) => {
                    const level = cos.level;
                    const upgradeCost = getEffectiveIdolIncome(selectedIdol, completedGroups) * 60 * (level + 1);
                    return (
                      <div key={cos.key} style={{ ...styles.card, marginBottom: 10, background: "rgba(30,41,59,0.55)" }}>
                        <div style={styles.row}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{cos.label}</div>
                            <div style={styles.small}>Tap +{Math.round(cos.tapBonus * 100)}% • Passive +{Math.round(cos.passiveBonus * 100)}%</div>
                            <div style={styles.small}>Level {level}/3</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={styles.button} disabled={level === 0} onClick={() => activateCosmetic(selectedIdol, cos.key)}>Activate</button>
                            <button style={styles.buttonAlt} disabled={level >= 3 || money < upgradeCost} onClick={() => upgradeCosmetic(selectedIdol, cos.key)}>Up ${fmt(upgradeCost)}</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ ...styles.card, marginTop: 12 }}>
                  <h3 style={{ marginTop: 0 }}>Quick Action</h3>
                  <button style={styles.button} onClick={(e) => tapIdol(selectedIdol, e)}>Tap for Bonus</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}


    <button
      onClick={cycleTheme}
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        zIndex: 9999,
        padding: "10px 14px",
        borderRadius: 999,
        border: `1px solid ${ui.cardBorderSoft}`,
        background: ui.panel,
        color: ui.text,
        cursor: "pointer",
        fontWeight: 700,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
      }}
    >
      Theme: {THEMES[theme]?.label ?? theme}
    </button>
    
    </div>
  );
}
