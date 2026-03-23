import React, { useEffect, useMemo, useRef, useState } from "react";
import ConveyorSection from "./components/ConveyorSection";

import buySfx from "./assets/audio/buy.ogg";
import revealSfx from "./assets/audio/reveal.mp3";
import tapSfx from "./assets/audio/tap.ogg";
import hoverSfx from "./assets/audio/hover.ogg";
import trashSfx from "./assets/audio/trash.ogg";
import equipSfx from "./assets/audio/equip.ogg";
import coinSfx from "./assets/audio/coin.ogg";
import switchSfx from "./assets/audio/switch.ogg";

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
  SHOP_CONFIG
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

const fmtDuration = (totalSec) => {
  const safe = Math.max(0, Math.ceil(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}m ${seconds}s`;
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
  const driftX = useRef((Math.random() - 0.5) * 24);

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
        transform: "translate(0px, 0px) scale(1.12)",
      }));
    }, 10);

    const floatTimer = setTimeout(() => {
      setStyle((s) => ({
        ...s,
        opacity: 0,
        transform: `translate(${driftX.current}px, -34px) scale(1)`,
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

const cleanConveyor = (packs = []) => {
  const active = packs.filter((p) => p.expiresAt > now());

  const express = active.filter((p) => p.isExpress);
  const natural = active.filter((p) => !p.isExpress).slice(-CONVEYOR_MAX);

  return [...natural, ...express];
};

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
    pageBg: "linear-gradient(135deg, #020617, #0f172a 50%, #1e1b4b)",
    text: "#e0f2fe",
    incomeText: "#88f178",
    subtext: "#94a3b8",
    panel: "rgba(10,15,30,0.86)",
    panelAlt: "rgba(30,41,59,0.7)",
    cardBorder: "#334155",
    cardBorderSoft: "#475569",
    button: "#06b6d4",
    buttonText: "#082f49",
    buttonAltBg: "rgba(255,255,255,0.06)",
    buttonAltText: "#e0f2fe",
    tabActive: "#8b5cf6",
    tabInactive: "rgba(15,23,42,0.7)",
    idolFallback: "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.16))",
    progressBg: "#1e293b",
    progressFill: "linear-gradient(90deg, #22d3ee, #8b5cf6)",
  },

  light: {
    label: "Light",
    pageBg: "linear-gradient(135deg, #f8fafc, #f1f5f9 55%, #e2e8f0)",
    text: "#0f172a",
    incomeText: "#11b12e",
    subtext: "#475569",
    panel: "rgba(255,255,255,0.85)",
    panelAlt: "rgba(248,250,252,0.95)",
    cardBorder: "#cbd5e1",
    cardBorderSoft: "#94a3b8",
    button: "#3b82f6",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.7)",
    buttonAltText: "#0f172a",
    tabActive: "#6366f1",
    tabInactive: "rgba(241,245,249,0.9)",
    idolFallback:
      "linear-gradient(135deg, rgba(148,163,184,0.18), rgba(59,130,246,0.12))",
    progressBg: "#e2e8f0",
    progressFill: "linear-gradient(90deg, #3b82f6, #6366f1)",
  },

  sakura: {
    label: "Sakura Night",
    pageBg: "linear-gradient(135deg, #2a1220, #5b2143 52%, #f9a8d4)",
    text: "#fff1f5",
    incomeText: "#88f178",
    subtext: "#fbcfe8",
    panel: "rgba(56, 22, 43, 0.84)",
    panelAlt: "rgba(91, 33, 67, 0.56)",
    cardBorder: "#f9a8d4",
    cardBorderSoft: "#fbcfe8",
    button: "#ec4899",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.08)",
    buttonAltText: "#fff1f5",
    tabActive: "#f472b6",
    tabInactive: "rgba(56, 22, 43, 0.62)",
    idolFallback: "linear-gradient(135deg, rgba(249,168,212,0.22), rgba(244,114,182,0.15))",
    progressBg: "#831843",
    progressFill: "linear-gradient(90deg, #ec4899, #f9a8d4)",
  },

  mint: {
    label: "Mint Pop",
    pageBg: "linear-gradient(135deg, #052e2b, #0f766e 55%, #99f6e4)",
    text: "#ecfeff",
    incomeText: "#88f178",
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

  lavender: {
    label: "Lavender Dream",
    pageBg: "linear-gradient(135deg, #1e1b4b, #4c1d95 55%, #c4b5fd)",
    text: "#f5f3ff",
    incomeText: "#88f178",
    subtext: "#c4b5fd",
    panel: "rgba(44,26,76,0.82)",
    panelAlt: "rgba(91,33,182,0.28)",
    cardBorder: "#a78bfa",
    cardBorderSoft: "#c4b5fd",
    button: "#8b5cf6",
    buttonText: "#f5f3ff",
    buttonAltBg: "rgba(255,255,255,0.08)",
    buttonAltText: "#f5f3ff",
    tabActive: "#c084fc",
    tabInactive: "rgba(44,26,76,0.62)",
    idolFallback:
      "linear-gradient(135deg, rgba(167,139,250,0.20), rgba(192,132,252,0.16))",
    progressBg: "#4c1d95",
    progressFill: "linear-gradient(90deg, #a78bfa, #e9d5ff)",
  },

  sky: {
    label: "Sky Pop",
    pageBg: "linear-gradient(135deg, #10243a, #1d4ed8 50%, #7dd3fc)",
    text: "#eff6ff",
    incomeText: "#88f178",
    subtext: "#bfdbfe",
    panel: "rgba(16, 36, 58, 0.82)",
    panelAlt: "rgba(29, 78, 216, 0.32)",
    cardBorder: "#60a5fa",
    cardBorderSoft: "#93c5fd",
    button: "#38bdf8",
    buttonText: "#082f49",
    buttonAltBg: "rgba(255,255,255,0.08)",
    buttonAltText: "#eff6ff",
    tabActive: "#60a5fa",
    tabInactive: "rgba(16, 36, 58, 0.62)",
    idolFallback: "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(125,211,252,0.16))",
    progressBg: "#1e3a8a",
    progressFill: "linear-gradient(90deg, #38bdf8, #93c5fd)",
  },
  earth: {
    label: "Earth Tone",
    pageBg: "linear-gradient(135deg, #1f241d, #4b5d3a 55%, #8a7b5e)",
    text: "#f5f5dc",
    incomeText: "#88f178",
    subtext: "#d6d3b1",
    panel: "rgba(40, 48, 34, 0.84)",
    panelAlt: "rgba(75, 93, 58, 0.52)",
    cardBorder: "#8a7b5e",
    cardBorderSoft: "#a89b76",
    button: "#6b7d4f",
    buttonText: "#f8faf0",
    buttonAltBg: "rgba(255,255,255,0.07)",
    buttonAltText: "#f5f5dc",
    tabActive: "#a89b76",
    tabInactive: "rgba(40, 48, 34, 0.62)",
    idolFallback: "linear-gradient(135deg, rgba(107,125,79,0.2), rgba(168,155,118,0.14))",
    progressBg: "#4b5d3a",
    progressFill: "linear-gradient(90deg, #6b7d4f, #a89b76)",
  },

  obsidian: {
    label: "Obsidian",
    pageBg: "linear-gradient(135deg, #050505, #101418 52%, #262c35)",
    text: "#f5f7fa",
    incomeText: "#88f178",
    subtext: "#aeb8c5",
    panel: "rgba(14, 18, 24, 0.88)",
    panelAlt: "rgba(30, 36, 44, 0.7)",
    cardBorder: "#3b4552",
    cardBorderSoft: "#576272",
    button: "#64748b",
    buttonText: "#f8fafc",
    buttonAltBg: "rgba(255,255,255,0.06)",
    buttonAltText: "#f5f7fa",
    tabActive: "#94a3b8",
    tabInactive: "rgba(14, 18, 24, 0.7)",
    idolFallback: "linear-gradient(135deg, rgba(100,116,139,0.18), rgba(51,65,85,0.16))",
    progressBg: "#1f2937",
    progressFill: "linear-gradient(90deg, #94a3b8, #cbd5e1)",
  },

  beige: {
    label: "Soft Beige",
    pageBg: "linear-gradient(135deg, #f5efe6, #ede0d1 55%, #d6c2ad)",
    text: "#3f3124",
    incomeText: "#11b12e",
    subtext: "#7c6756",
    panel: "rgba(255,248,240,0.88)",
    panelAlt: "rgba(239,226,212,0.88)",
    cardBorder: "#c8b39f",
    cardBorderSoft: "#b89c86",
    button: "#b08968",
    buttonText: "#fffaf5",
    buttonAltBg: "rgba(255,255,255,0.58)",
    buttonAltText: "#3f3124",
    tabActive: "#c08a5b",
    tabInactive: "rgba(255,248,240,0.75)",
    idolFallback: "linear-gradient(135deg, rgba(200,179,159,0.22), rgba(176,137,104,0.12))",
    progressBg: "#ded0c2",
    progressFill: "linear-gradient(90deg, #c08a5b, #d6c2ad)",
  },

  softPink: {
    label: "Pastel Pink",
    pageBg: "linear-gradient(135deg, #fdf2f8, #fce7f3 55%, #fbcfe8)",
    text: "#4a044e",
    incomeText: "#11b12e",
    subtext: "#9d174d",
    panel: "rgba(255, 240, 246, 0.9)",
    panelAlt: "rgba(252, 231, 243, 0.9)",
    cardBorder: "#f9a8d4",
    cardBorderSoft: "#fbcfe8",
    button: "#f472b6",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.7)",
    buttonAltText: "#4a044e",
    tabActive: "#ec4899",
    tabInactive: "rgba(252, 231, 243, 0.8)",
    idolFallback: "linear-gradient(135deg, rgba(251,207,232,0.4), rgba(244,114,182,0.2))",
    progressBg: "#fce7f3",
    progressFill: "linear-gradient(90deg, #f472b6, #f9a8d4)",
  },

  softOrange: {
    label: "Pastel Orange",
    pageBg: "linear-gradient(135deg, #fff7ed, #ffedd5 55%, #fed7aa)",
    text: "#431407",
    incomeText: "#11b12e",
    subtext: "#9a3412",
    panel: "rgba(255, 245, 235, 0.9)",
    panelAlt: "rgba(255, 237, 213, 0.9)",
    cardBorder: "#fdba74",
    cardBorderSoft: "#fed7aa",
    button: "#fb923c",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.7)",
    buttonAltText: "#431407",
    tabActive: "#f97316",
    tabInactive: "rgba(255, 237, 213, 0.8)",
    idolFallback: "linear-gradient(135deg, rgba(254,215,170,0.4), rgba(251,146,60,0.2))",
    progressBg: "#ffedd5",
    progressFill: "linear-gradient(90deg, #fb923c, #fdba74)",
  },
  softGreen: {
    label: "Pastel Green",
    pageBg: "linear-gradient(135deg, #f0fdf4, #dcfce7 55%, #bbf7d0)",
    text: "#052e16",
    incomeText: "#11b12e",
    subtext: "#166534",
    panel: "rgba(240, 255, 245, 0.9)",
    panelAlt: "rgba(220, 252, 231, 0.9)",
    cardBorder: "#86efac",
    cardBorderSoft: "#bbf7d0",
    button: "#4ade80",
    buttonText: "#052e16",
    buttonAltBg: "rgba(255,255,255,0.7)",
    buttonAltText: "#052e16",
    tabActive: "#22c55e",
    tabInactive: "rgba(220, 252, 231, 0.8)",
    idolFallback: "linear-gradient(135deg, rgba(187,247,208,0.4), rgba(74,222,128,0.2))",
    progressBg: "#dcfce7",
    progressFill: "linear-gradient(90deg, #4ade80, #86efac)",
  },
  softBlue: {
    label: "Pastel Blue",
    pageBg: "linear-gradient(135deg, #eff6ff, #dbeafe 55%, #bfdbfe)",
    text: "#1e3a8a",
    incomeText: "#11b12e",
    subtext: "#1d4ed8",
    panel: "rgba(240, 245, 255, 0.9)",
    panelAlt: "rgba(219, 234, 254, 0.9)",
    cardBorder: "#93c5fd",
    cardBorderSoft: "#bfdbfe",
    button: "#60a5fa",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.7)",
    buttonAltText: "#1e3a8a",
    tabActive: "#3b82f6",
    tabInactive: "rgba(219, 234, 254, 0.8)",
    idolFallback: "linear-gradient(135deg, rgba(191,219,254,0.4), rgba(96,165,250,0.2))",
    progressBg: "#dbeafe",
    progressFill: "linear-gradient(90deg, #60a5fa, #93c5fd)",
  },
  softPurple: {
    label: "Pastel Purple",
    pageBg: "linear-gradient(135deg, #faf5ff, #f3e8ff 55%, #e9d5ff)",
    text: "#3b0764",
    incomeText: "#11b12e",
    subtext: "#6b21a8",
    panel: "rgba(250, 245, 255, 0.9)",
    panelAlt: "rgba(243, 232, 255, 0.9)",
    cardBorder: "#d8b4fe",
    cardBorderSoft: "#e9d5ff",
    button: "#a78bfa",
    buttonText: "#ffffff",
    buttonAltBg: "rgba(255,255,255,0.7)",
    buttonAltText: "#3b0764",
    tabActive: "#8b5cf6",
    tabInactive: "rgba(243, 232, 255, 0.8)",
    idolFallback: "linear-gradient(135deg, rgba(233,213,255,0.4), rgba(167,139,250,0.2))",
    progressBg: "#f3e8ff",
    progressFill: "linear-gradient(90deg, #a78bfa, #d8b4fe)",
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
        id: newIdol.id ?? Date.now() + Math.random(),
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
  const [maxQueue, setMaxQueue] = useState(initialSave?.maxQueue ?? 20);
  const [queueUpgradeLevel, setQueueUpgradeLevel] = useState(initialSave?.queueUpgradeLevel ?? 0);
  const [managerLevel, setManagerLevel] = useState(initialSave?.managerLevel ?? 0);
  const [shopNotice, setShopNotice] = useState(null);
  const [offlineCapMinutes, setOfflineCapMinutes] = useState(initialSave?.offlineCapMinutes ?? 60);
  const [offlineCapLevel, setOfflineCapLevel] = useState(initialSave?.offlineCapLevel ?? 0);

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
  const cleanConveyorKeepAll = (packs) => (packs || []).filter((p) => p.expiresAt > now());
  const themeKeys = Object.keys(THEMES);

    const managerSpeedMult = 1 + managerLevel * 0.1;
    const getQueueUpgradeCost = () =>
      Math.floor(
        SHOP_CONFIG.queue.base *
        Math.pow(SHOP_CONFIG.queue.growth, queueUpgradeLevel)
      );

    const getManagerUpgradeCost = () =>
      Math.floor(
        SHOP_CONFIG.manager.base *
        Math.pow(SHOP_CONFIG.manager.growth, managerLevel)
      );
        Math.floor(12000 * Math.pow(1.8, managerLevel));

    const getExpressDeliveryCost = (groupCost) =>
      Math.floor(groupCost * SHOP_CONFIG.express.multiplier);

  const showShopMessage = (text) => {
    setShopNotice(text);
    setTimeout(() => {
      setShopNotice((current) => (current === text ? null : current));
    }, 1800);
  };

  const buyQueueUpgrade = () => {
  const cost = getQueueUpgradeCost();
    if (money < cost) return;

    setMoney((m) => m - cost);
    setQueueUpgradeLevel((lvl) => lvl + 1);
    setMaxQueue((q) => q + 2);
    playSound(buySfx, 0.45);
    showShopMessage("Queue capacity increased by +2.");
  };

  const buyManagerUpgrade = () => {
    const cost = getManagerUpgradeCost();
    if (money < cost) return;

    setMoney((m) => m - cost);
    setManagerLevel((lvl) => lvl + 1);
    playSound(equipSfx, 0.45);
    showShopMessage("Manager hired. Opening speed increased.");
  };

  const getOfflineCapUpgradeCost = () =>
    Math.floor(
      SHOP_CONFIG.offline.base *
      Math.pow(SHOP_CONFIG.offline.growth, offlineCapLevel)
    );

  const buyOfflineCapUpgrade = () => {
    const cost = getOfflineCapUpgradeCost();
    if (money < cost) return;

    setMoney((m) => m - cost);
    setOfflineCapLevel((lvl) => lvl + 1);
    setOfflineCapMinutes((mins) => mins + 15);
    playSound(equipSfx, 0.45);
    showShopMessage("Offline earnings cap increased by 15 minutes.");
  };

  const createPackForGroup = (group, options = {}) => {
    const rarity = weightedPick(RARITIES);
    const mutation = maybeMutation();

    return {
      id: nextId.current++,
      group: group.name,
      tier: group.tier,
      cost: Math.floor(group.cost * (RARITY_PACK_PRICE_MULT[rarity.name] ?? 1)),
      rarity: rarity.name,
      rarityMult: rarity.mult,
      mutation: mutation?.name ?? null,
      mutationMult: mutation?.mult ?? 1,
      packImage: group.packImage ?? null,
      spawnedAt: now(),
      expiresAt: now() + CONVEYOR_LIFETIME_MS,
      isExpress: options.isExpress ?? false,
    };
  };


  const buyExpressDelivery = (groupName) => {
    const group = GROUPS.find((g) => g.name === groupName);
    if (!group) return;

    const fee = getExpressDeliveryCost(group.cost);
    if (money < fee) return;

    const pack = createPackForGroup(group, { isExpress: true });

    setMoney((m) => m - fee);
    setConveyor((prev) => [...cleanConveyorKeepAll(prev), pack]);
    playSound(buySfx, 0.5);
    showShopMessage(`${group.name} express delivery arrived.`);
  };

  const cycleTheme = () => {
    setTheme((prev) => {
      const currentIndex = themeKeys.indexOf(prev);
      const nextIndex = (currentIndex + 1) % themeKeys.length;
      return themeKeys[nextIndex];
    });

    playSound(switchSfx, 0.4);
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
      maxQueue,
      queueUpgradeLevel,
      managerLevel,
      offlineCapMinutes,
      offlineCapLevel,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  }, [money, tab, conveyor, backpack, opening, collection, equippedLightstick, ownedLightsticks, binderSort, showUndiscovered, theme, maxQueue, queueUpgradeLevel, managerLevel, offlineCapLevel, offlineCapMinutes]);

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

    const savedOfflineCapMinutes = initialSave?.offlineCapMinutes ?? 60;
    const capSeconds = 60 * savedOfflineCapMinutes;
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
        const naturalCount = current.filter((p) => !p.isExpress).length;

        if (naturalCount >= CONVEYOR_MAX) return current;

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

        return [...current, newPack];
      });
    };

    setConveyor((prev) => {
      const current = cleanConveyor(prev);
      const naturalCount = current.filter((p) => !p.isExpress).length;

      if (naturalCount === 0) {
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
        const speed = (pack.group === equippedLightstick ? 2 : 1) * managerSpeedMult;
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
  }, [equippedLightstick, managerSpeedMult]);

  const removeFloatingIncome = React.useCallback((doneId) => {
    setFloatingIncome((prev) => prev.filter((fi) => fi.id !== doneId));
  }, []);
  
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
  const skipAllReveals = () => {
    const idolsToMerge = [
      ...(activeReveal ? [activeReveal] : []),
      ...revealQueue,
    ];

    if (idolsToMerge.length === 0) return;

    setCollection((old) => mergeOpenedIdols(old, idolsToMerge));
    setActiveReveal(null);
    setRevealQueue([]);
  };
  const queuePackMultiple = (key, amount) => {
    const pack = backpack[key];
    if (!pack) return;

    const available = pack.count ?? 0;
    if (available < amount) return;

    const freeSlots = maxQueue - openingRef.current.length;
    if (freeSlots < amount) {
      showShopMessage(`Need ${amount} free queue slots.`);
      return;
    }

    const baseSec = OPEN_TIME_BY_TIER_SEC[pack.tier - 1] || 4500;

    const queuedPacks = Array.from({ length: amount }, () => ({
      id: nextId.current++,
      group: pack.group,
      tier: pack.tier,
      cost: pack.cost,
      rarity: pack.rarity,
      mutation: pack.mutation,
      packImage: pack.packImage ?? null,
      baseSec,
      progress: 0,
      lastProgressAt: now(),
    }));

    setOpening((prev) => {
      const next = [...prev, ...queuedPacks];
      openingRef.current = next;
      return next;
    });

    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const nextCount = current.count - amount;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          count: nextCount,
        },
      };
    });

    playSound(buySfx, 0.4);
  };

  const trashPackMultiple = (key, amount) => {
    const pack = backpack[key];
    if (!pack) return;

    const available = pack.count ?? 0;
    if (available < amount) return;

    const refund = pack.cost * 0.3 * amount;

    setMoney((m) => m + refund);

    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const nextCount = current.count - amount;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          count: nextCount,
        },
      };
    });

    playSound(trashSfx, 0.4);
  };

  const queuePack = (key) => {
    const pack = backpack[key];
    if (openingRef.current.length >= maxQueue) {
      showShopMessage("Opening queue is full.");
      return;
    }

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

  const toggleFavorite = (targetIdol) => {
    setCollection((prev) =>
      prev.map((idol) =>
        idol.group === targetIdol.group && idol.name === targetIdol.name
          ? { ...idol, isFavorite: !idol.isFavorite }
          : idol
      )
    );

    setSelectedIdol((prev) =>
      prev && prev.group === targetIdol.group && prev.name === targetIdol.name
        ? { ...prev, isFavorite: !prev.isFavorite }
        : prev
    );
  };

  const tapIdol = (idol, event) => {
  if (!idol?.discovered && idol.discovered !== undefined) return;
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
  const freeQueueSlots = maxQueue - opening.length;

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
            <div style={{ ...styles.small, marginTop: 6, color: ui.incomeText }}>
              +${fmt(passiveIncomePerSec)}/s
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Player Tier</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Tier {playerTier}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Opening Queue</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{opening.length}/{maxQueue}</div>
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
              You earned <b>${fmt(offlineNotice.income)}</b> over{" "}
              {Math.floor(offlineNotice.seconds / 60)}m {offlineNotice.seconds % 60}s away.
            </div>
            <div style={{ ...styles.small, marginTop: 6 }}>
              Current offline cap: {offlineCapMinutes} minutes
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
          {["conveyor", "shop", "binder", "sets", ...(debugMode ? ["debug"] : [])].map((name) => (
            <button key={name} style={styles.tabBtn(tab === name)} onClick={() => setTab(name)}>
              {name === "binder" ? "Collection Binder" : name === "shop" ? "Shop": name[0].toUpperCase() + name.slice(1)}
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
                  <div style={styles.small}>Queue limit: {maxQueue} packs</div>
                </div>
                {backpackEntries.length === 0 ? <div style={styles.small}>No packs yet.</div> : backpackEntries.map(([key, pack]) => (
                  <div key={key} style={{ ...styles.card, marginBottom: 10, background: ui.panelAlt, border: `1px solid ${ui.cardBorder}`, }}>
                    <div style={styles.row}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{pack.group} ×{pack.count}</div>
                        <div style={styles.small}>{pack.rarity}{pack.mutation ? ` • ${pack.mutation}` : ""}</div>
                      </div>
                    
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        
                        
                        <button style={styles.button} onClick={() => queuePack(key)}>
                          Open
                        </button>
                        
                        {pack.count >= 5 ? (
                          <button
                            style={styles.button}
                            disabled={freeQueueSlots < 5}
                            onClick={() => queuePackMultiple(key, 5)}
                          >
                            Open x5
                          </button>
                        ) : null}

                        {pack.count >= 10 ? (
                          <button
                            style={styles.button}
                            disabled={freeQueueSlots < 10}
                            onClick={() => queuePackMultiple(key, 10)}
                          >
                            Open x10
                          </button>
                        ) : null}

                        <button style={styles.buttonAlt} onClick={() => trashPack(key)}>
                          Trash
                        </button>

                         {pack.count >= 5 ? (
                          <button
                            style={styles.buttonAlt}
                            onClick={() => trashPackMultiple(key, 5)}
                          >
                            Trash x5
                          </button>
                        ) : null}
                      
                        {pack.count >= 10 ? (
                          <button
                            style={styles.buttonAlt}
                            onClick={() => trashPackMultiple(key, 10)}
                          >
                            Trash x10
                          </button>
                        ) : null}
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
                  const speed = (pack.group === equippedLightstick ? 2 : 1) * managerSpeedMult;
                  const remainingSec = Math.ceil((1 - pack.progress) * pack.baseSec / speed);
                  return (
                    <div key={pack.id} style={{ marginBottom: 12 }}>
                      <div style={styles.row}>
                        <div>
                          <b>{pack.group}</b>
                          <div style={styles.small}>{pack.rarity}{pack.mutation ? ` • ${pack.mutation}` : ""}</div>
                        </div>
                        <div>
                          {fmtDuration(remainingSec)} {speed > 1 ? <span style={styles.small}>⚡ boosted</span> : null}
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
                    key={`${idol.group}|||${idol.name}`}
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
                    onClick={isMissing ? undefined : (e) => tapIdol(idol, e)}
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
                            toggleFavorite(idol);
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

        {tab === "shop" && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.row}>
                <h2 style={{ marginTop: 0, color: ui.text }}>Upgrades</h2>
                <div style={styles.small}>Permanent account upgrades</div>
              </div>

              <div style={{ ...styles.card, marginTop: 12, background: ui.panelAlt }}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Offline Storage</div>
                    <div style={styles.small}>
                      Increase max offline earnings time by +15 minutes each purchase.
                    </div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Current cap: <b>{offlineCapMinutes} minutes</b> • Level <b>{offlineCapLevel}</b>
                    </div>
                  </div>

                  <button
                    style={styles.button}
                    disabled={money < getOfflineCapUpgradeCost()}
                    onClick={buyOfflineCapUpgrade}
                  >
                    Upgrade (${fmt(getOfflineCapUpgradeCost())})
                  </button>
                </div>
              </div>

              <div style={{ ...styles.card, marginTop: 12, background: ui.panelAlt }}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Queue Slot Expansion</div>
                    <div style={styles.small}>
                      Increase opening queue by +2 slots each purchase.
                    </div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Current max queue: <b>{maxQueue}</b> • Level <b>{queueUpgradeLevel}</b>
                    </div>
                  </div>

                  <button
                    style={styles.button}
                    disabled={money < getQueueUpgradeCost()}
                    onClick={buyQueueUpgrade}
                  >
                    Buy (${fmt(getQueueUpgradeCost())})
                  </button>
                </div>
              </div>

              <div style={{ ...styles.card, marginTop: 12, background: ui.panelAlt }}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Manager System</div>
                    <div style={styles.small}>
                      Boost all pack opening speed by +10% per level.
                    </div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Current bonus: <b>+{Math.round((managerSpeedMult - 1) * 100)}%</b> • Level <b>{managerLevel}</b>
                    </div>
                  </div>

                  <button
                    style={styles.button}
                    disabled={money < getManagerUpgradeCost()}
                    onClick={buyManagerUpgrade}
                  >
                    Hire (${fmt(getManagerUpgradeCost())})
                  </button>
                </div>
              </div>

              {shopNotice ? (
                <div style={{ ...styles.small, marginTop: 12, color: ui.incomeText }}>
                  {shopNotice}
                </div>
              ) : null}
            </div>
            
            <div style={styles.card}>
              <div style={styles.row}>
                <h2 style={{ marginTop: 0, color: ui.text }}>Express Delivery</h2>
                <div style={styles.small}>
                  Force-deliver a target group pack, even if the conveyor is full.
                </div>
              </div>
            
              <div style={{ ...styles.small, marginBottom: 12 }}>
                Delivery fee is 4× base pack price. You still need to buy the delivered pack after it arrives.
              </div>
            
              <div style={{ display: "grid", gap: 10 }}>
                {GROUPS.map((group) => {
                  const fee = getExpressDeliveryCost(group.cost);
                
                  return (
                    <div
                      key={group.name}
                      style={{
                        ...styles.card,
                        background: ui.panelAlt,
                        padding: 12,
                      }}
                    >
                      <div style={styles.row}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{group.name}</div>
                          <div style={styles.small}>
                            Tier {group.tier} • Delivery Fee: ${fmt(fee)}
                          </div>
                        </div>
                    
                        <button
                          style={styles.button}
                          disabled={money < fee}
                          onClick={() => buyExpressDelivery(group.name)}
                        >
                          Deliver
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            onDone={removeFloatingIncome}
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
              background: ui.panel,
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
            {revealQueue.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                <button
                  style={styles.buttonAlt}
                  onClick={skipAllReveals}
                >
                  Skip All ({revealQueue.length + 1})
                </button>
              </div>
            )}
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
                  <button
                    style={styles.button}
                    onClick={(e) => tapIdol(selectedIdol, e)}
                  >
                    Tap for Bonus
                  </button>
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
