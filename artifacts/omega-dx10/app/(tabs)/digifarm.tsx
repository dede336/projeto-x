import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Svg, { Line, Polygon } from 'react-native-svg';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Modal, FlatList, Pressable, Platform, ScrollView,
  Animated, useWindowDimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { CHARACTERS, PRE_ROOKIE_STAGE_RARITIES, RARITY_LABELS, GAME_MAPS } from '@/constants/gameData';
import { getCharacter } from '@/constants/extendedCharacters';
import { pixelStyle } from '@/constants/pixelStyle';
import { CharacterAvatar } from '@/components/GameComponents';
import { useLanguage } from '@/context/LanguageContext';
import { isAsfalto, snapAsfalto, resolveAsfaltoMeta, AsfaltoMeta, ASFALTO_GRID } from '@/utils/asfaltoAutoConnect';

const FARM_BG    = require('../../assets/images/digifarm-bg3.webp');
const FARM_FRAME = require('../../assets/images/farm_frame_transparent.webp');

const FOOD_ITEMS: Record<string, { name: string; emoji: string; image: any }> = {
  food_apple:  { name: 'Maçã',       emoji: '🍎', image: require('../../assets/images/food_apple.webp') },
  food_sushi:  { name: 'Sushi',      emoji: '🍣', image: require('../../assets/images/food_sushi.webp') },
  food_water:  { name: 'Água',       emoji: '💧', image: require('../../assets/images/food_water.webp') },
  food_salad:  { name: 'Salada',     emoji: '🥗', image: require('../../assets/images/food_salad.webp') },
  food_burger: { name: 'Hambúrguer', emoji: '🍔', image: require('../../assets/images/food_burger.webp') },
  food_pizza:  { name: 'Pizza',      emoji: '🍕', image: require('../../assets/images/food_pizza.webp') },
};

const SPEECH_PHRASES = [
  'Vamos batalhar! ⚔️', 'Cuida de mim! 🥺', 'Boa sorte, Tamer!',
  'Tô te esperando!', 'Estou ficando mais forte!', 'Treine comigo! 💪',
  'Não me esquece! 😊', 'Proteja o Mundo Digital!',
];
const THOUGHT_PHRASES = [
  'Quando vou evoluir?', 'Preciso ficar mais forte...', 'Que dia bonito hoje!',
  'Saudades de batalhar...', 'O Mundo Digital é incrível!', 'Será que tem comida?',
  'Meu Tamer é o melhor!', 'Quero ficar mais forte...',
];
const HUNGRY_SPEECH = ['Estou com fome! 🍔', 'Me alimenta! 😢', 'Barriga vazia... 😭'];
const HUNGRY_THOUGHT = ['Será que tem comida?', 'Faz tempo que não como...', 'Que fominha...'];
const BATTLE_SPEECH = ['Bora batalhar! ⚔️', 'Quero lutar!', 'Me leva pra batalha! ⚡'];
const EMOJI_ONLY = ['⚡', '🔥', '💧', '🌿', '❄️', '🌟', '💫', '✨', '😴', '🎵', '🌈', '💪'];
const SAT_EMOJIS_HIGH = ['😊', '❤️', '🌟', '😁', '✨'];
const SAT_EMOJIS_MID  = ['😐', '🙂', '😌'];
const SAT_EMOJIS_LOW  = ['😕', '😢', '😟'];
const SAT_EMOJIS_VLOW = ['😤', '💔', '😫'];

// ── Sistema de interações entre Digimons ─────────────────────────────────────
const INTIMACY_OPENERS = [
  'Treina comigo? 💪', 'É bom ter você aqui! 😊',
  'Você é incrível! 🌟', 'Somos da mesma alma! ✨',
  'Vamos explorar juntos? 🌿', 'Fico feliz com você por perto! 😁',
  'Podemos evoluir juntos! 💫', 'Você é meu parceiro! ❤️',
];
const INTIMACY_RESPONSES = [
  'Com certeza! 😁', 'Obrigado! ❤️',
  'Você também! 🌟', 'Bora! ✨',
  'Vamos juntos! 💪', 'Sempre! 😊',
  'Conte comigo! 🤝', 'Somos imbatíveis! 🔥',
];
const RIVALRY_OPENERS = [
  'Eu sou mais forte! 😤', 'Vou te superar! ⚔️',
  'Nunca vou perder pra você!', 'Me desafia? 😏',
  'Sou melhor que você! 💢', 'Um dia vou te vencer! ⚡',
  'Não subestima! 😤', 'A batalha entre nós vai rolar!',
];
const RIVALRY_RESPONSES = [
  'Pode tentar! ⚡', 'Sonhe mais! 😎',
  'Tá bom de ver! 😤', 'Não é bem assim... 😒',
  'Quando quiser! 😏', 'Você vai se arrepender!',
  'Estou pronto! ⚔️', 'Provado em batalha! 💪',
];
const NEUTRAL_OPENERS = [
  'Olá, vizinho! 👋', 'Como foi o dia? 🌤️',
  'Viu o Tamer hoje? 😊', 'Que lugar bonito!',
  'Tudo tranquilo? 😌', 'Tô gostando daqui! 🌈',
  'Que saudade de batalhar...', 'Vai ter comida hoje?',
];
const NEUTRAL_RESPONSES = [
  'Tudo bem! 😌', 'Foi ótimo! 🙂',
  'Vi sim! 🙂', 'É mesmo! 🌈',
  'Por aqui também! 😊', 'Comigo tá tudo bem!',
  'Saudade mesmo... ⚔️', 'Espero que sim! 🍔',
];

const ELEMENT_RIVAL_PAIRS: [string, string][] = [
  ['FIRE', 'WATER'], ['FIRE', 'ICE'], ['FIRE', 'PLANT'],
  ['LIGHT', 'DARK'], ['LIGHTNING', 'EARTH'], ['WIND', 'EARTH'],
];
const ATTRIBUTE_RIVAL_PAIRS: [string, string][] = [
  ['VC', 'VR'], ['VR', 'DA'], ['DA', 'VC'],
];

function getRelationship(
  attrA: string | undefined, elemA: string | undefined,
  attrB: string | undefined, elemB: string | undefined,
): 'intimacy' | 'rivalry' | 'neutral' {
  const sameElem = elemA && elemB && elemA === elemB;
  const sameAttr = attrA && attrB && attrA === attrB;
  if (sameElem || sameAttr) return 'intimacy';

  const elemRival = ELEMENT_RIVAL_PAIRS.some(
    ([a, b]) => (elemA === a && elemB === b) || (elemA === b && elemB === a)
  );
  const attrRival = ATTRIBUTE_RIVAL_PAIRS.some(
    ([a, b]) => (attrA === a && attrB === b) || (attrA === b && attrB === a)
  );
  if (elemRival || attrRival) return 'rivalry';

  return 'neutral';
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const FARM_CANVAS_W = 1586;
const FARM_CANVAS_H = 992;
const FARM_VIEW_H   = 530;

const GREEN = { minX: 100, maxX: 1100, minY: 380, maxY: 870 };

const DECO_CATALOG: Record<string, { name: string; image: any; displayW: number; displayH: number; solidW: number; solidH: number; iso?: boolean; mirror?: boolean }> = {
  house: {
    name: 'Casa',
    image: require('../../assets/images/deco_house.webp'),
    displayW: 290,
    displayH: 180,
    solidW: 220,
    solidH: 90,
  },
  // ── Asfalto ─────────────────────────────────────────────────────────────────
  asfalto_curva1: {
    name: 'Asfalto Curva',
    image: require('../../assets/images/deco_asfalto_curva1.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_curva2: {
    name: 'Asfalto Curva 2',
    image: require('../../assets/images/deco_asfalto_curva2.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_curva3: {
    name: 'Asfalto Curva 3',
    image: require('../../assets/images/deco_asfalto_curva3.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_curva4: {
    name: 'Asfalto Curva 4',
    image: require('../../assets/images/deco_asfalto_curva4.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_h1: {
    name: 'Asfalto Horizontal',
    image: require('../../assets/images/deco_asfalto_h1.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_h2: {
    name: 'Asfalto Horizontal 2',
    image: require('../../assets/images/deco_asfalto_h2.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_v1: {
    name: 'Asfalto Vertical',
    image: require('../../assets/images/deco_asfalto_v1.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_v2: {
    name: 'Asfalto Vertical 2',
    image: require('../../assets/images/deco_asfalto_v2.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  asfalto_t: {
    name: 'Asfalto em T',
    image: require('../../assets/images/deco_asfalto_t.webp'),
    displayW: 48, displayH: 48, solidW: 0, solidH: 0, iso: true,
  },
  // ── Árvores ─────────────────────────────────────────────────────────────────
  tree: {
    name: 'Árvore',
    image: require('../../assets/images/deco_tree.webp'),
    displayW: 110, displayH: 130, solidW: 65, solidH: 45,
  },
  tree_pine: {
    name: 'Pinheiro',
    image: require('../../assets/images/deco_tree_pine.webp'),
    displayW: 90, displayH: 140, solidW: 55, solidH: 35,
  },
  tree_autumn: {
    name: 'Árvore Outono',
    image: require('../../assets/images/deco_tree_autumn.webp'),
    displayW: 120, displayH: 140, solidW: 65, solidH: 45,
  },
  tree_oak: {
    name: 'Carvalho',
    image: require('../../assets/images/deco_tree_oak.webp'),
    displayW: 120, displayH: 150, solidW: 65, solidH: 45,
  },
  // ── Cerca ───────────────────────────────────────────────────────────────────
  fence: {
    name: 'Cerca',
    image: require('../../assets/images/deco_fence.webp'),
    displayW: 80, displayH: 60, solidW: 70, solidH: 22, iso: true,
  },
  fence_mirror: {
    name: 'Cerca (Espelhada)',
    image: require('../../assets/images/deco_fence.webp'),
    displayW: 80, displayH: 60, solidW: 70, solidH: 22, iso: true, mirror: true,
  },
  // ── Pedras ──────────────────────────────────────────────────────────────────
  rock: {
    name: 'Pedras',
    image: require('../../assets/images/deco_rock.webp'),
    displayW: 88, displayH: 80, solidW: 72, solidH: 55,
  },
  bush: {
    name: 'Arbustos',
    image: require('../../assets/images/deco_bush.webp'),
    displayW: 120, displayH: 65, solidW: 100, solidH: 35,
  },
  // ── Flores ──────────────────────────────────────────────────────────────────
  flower: {
    name: 'Flores Rosas',
    image: require('../../assets/images/deco_flower.webp'),
    displayW: 72, displayH: 92, solidW: 50, solidH: 35,
  },
  flower2: {
    name: 'Flores Amarelas',
    image: require('../../assets/images/deco_flower2.webp'),
    displayW: 110, displayH: 75, solidW: 90, solidH: 35,
  },
};

let _decoObstacles: { x1: number; y1: number; x2: number; y2: number }[] = [];

const SLOT_STARTS = [
  { x: 380, y: 570 }, { x: 610, y: 545 }, { x: 840, y: 575 },
  { x: 360, y: 750 }, { x: 580, y: 770 }, { x: 820, y: 745 },
];

// Obstacle zones mapped from the background image (canvas 750x600).
// The isometric map has: river/water upper-center, cliffs upper-left & upper-right,
// a wooden house on the right, and scattered trees/barrancos on the left edges.
const OBSTACLE_ZONES: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 0,   y1: 0,   x2: 750, y2: 200 }, // everything above the walkable area
  { x1: 0,   y1: 0,   x2: 185, y2: 600 }, // left cliff / barranco
  { x1: 185, y1: 0,   x2: 530, y2: 285 }, // water / river upper-center
  { x1: 530, y1: 0,   x2: 750, y2: 290 }, // upper-right cliff
  { x1: 548, y1: 200, x2: 750, y2: 520 }, // wooden house + right cliff
  { x1: 0,   y1: 455, x2: 220, y2: 600 }, // lower-left barranco / trees
  { x1: 0,   y1: 510, x2: 750, y2: 600 }, // below walkable ground
];

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function isObstructed(x: number, y: number): boolean {
  if (OBSTACLE_ZONES.some(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2)) return true;
  if (_decoObstacles.some(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2)) return true;
  return false;
}

function pathCrossesObstacle(x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isObstructed(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}

function findWalkableTarget(curX: number, curY: number): { x: number; y: number } {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tx = clamp(curX + (Math.random() - 0.5) * 160, GREEN.minX, GREEN.maxX);
    const ty = clamp(curY + (Math.random() - 0.5) * 100, GREEN.minY, GREEN.maxY);
    if (!isObstructed(tx, ty) && !pathCrossesObstacle(curX, curY, tx, ty)) {
      return { x: tx, y: ty };
    }
  }
  return { x: 350, y: 390 };
}

function maxFarmSlots(tamerLevel: number) { return Math.min(6, 1 + Math.floor(tamerLevel / 5)); }

function calcPendingXp(slots: string[], lastClaim: number, tamerLevel: number, xpPerHour: number, maxHours: number) {
  if (slots.length === 0) return 0;
  const elapsedHours = Math.min((Date.now() - lastClaim) / 3600000, maxHours);
  return Math.floor(xpPerHour * (1 + tamerLevel * 0.1) * elapsedHours * slots.length);
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function computeSatisfaction(
  ownedId: string,
  farmLastFeed: Record<string, number>,
  farmBattleRequests: Record<string, { requestedAt: number; fulfilled: boolean }>,
): number {
  const now = Date.now();
  let sat = 50;
  const lastFeed = farmLastFeed[ownedId] ?? 0;
  const timeSinceFeed = lastFeed > 0 ? (now - lastFeed) : Infinity;

  if (timeSinceFeed < 4 * 3600000) sat += 30;
  else if (timeSinceFeed > 8 * 3600000) sat -= 20;
  else sat -= 10;

  const req = farmBattleRequests[ownedId];
  if (req) {
    if (req.fulfilled) sat += 20;
    else if ((now - req.requestedAt) > 5 * 3600000) sat -= 20;
  }

  return Math.max(0, Math.min(100, sat));
}

function getSatisfactionEmoji(sat: number) {
  const arr = sat >= 80 ? SAT_EMOJIS_HIGH : sat >= 50 ? SAT_EMOJIS_MID : sat >= 30 ? SAT_EMOJIS_LOW : SAT_EMOJIS_VLOW;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSuggestedMap(level: number, customMaps: any[]) {
  const all = [...GAME_MAPS, ...customMaps];
  const regular = all.filter((m: any) => !m.isDungeon && !m.isDaily);
  let idx = 0;
  if (level > 60) idx = Math.min(6, regular.length - 1);
  else if (level > 40) idx = Math.min(4, regular.length - 1);
  else if (level > 20) idx = Math.min(2, regular.length - 1);
  const map = regular[idx];
  if (!map) return null;
  const bossStage = map.stages?.find((s: any) => s.isBoss) ?? map.stages?.[map.stages.length - 1];
  if (!bossStage) return null;
  return { mapId: map.id, stageIndex: bossStage.index as number, mapName: map.name as string };
}

function startWander(
  anim: Animated.ValueXY,
  scaleX: Animated.Value,
  currentPos: { x: number; y: number },
  active: { value: boolean },
) {
  function step() {
    if (!active.value) return;
    const idleMs = 1500 + Math.random() * 2500;
    setTimeout(() => {
      if (!active.value) return;
      const { x: targetX, y: targetY } = findWalkableTarget(currentPos.x, currentPos.y);
      const dx = targetX - currentPos.x;
      if (Math.abs(dx) > 5) scaleX.setValue(dx > 0 ? -1 : 1);
      const dist = Math.hypot(targetX - currentPos.x, targetY - currentPos.y);
      const walkMs = Math.max(3000, (dist / 40) * 1000);
      Animated.timing(anim, { toValue: { x: targetX, y: targetY }, duration: walkMs, useNativeDriver: false })
        .start(({ finished }) => {
          if (finished && active.value) {
            currentPos.x = targetX;
            currentPos.y = targetY;
            step();
          }
        });
    }, idleMs);
  }
  step();
}

type BubbleData = { text: string; type: 'speech' | 'thought' | 'emoji'; key: number } | null;

export default function DigifarmScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const {
    collection, tamerLevel, farmSlots, farmLastClaim, farmEntryTimes,
    farmFoods, farmLastFeed, farmBattleRequests, farmDailyRewardClaim,
    setFarmSlots, gainExp, processFarmEvolutions,
    feedFarmDigimon, generateFarmBattleRequests, claimFarmDailyReward,
    customGameMaps,
    farmDecorations, farmDecorInventory,
    placeFarmDecoration, moveFarmDecoration, mirrorFarmDecoration, removeFarmDecoration,
    placeAsfaltoAutoConnect, moveAsfaltoAutoConnect,
  } = useGame();
  const { getApiUrl } = useAuth();
  const apiUrl = getApiUrl();
  const { t } = useLanguage();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 20 : insets.bottom + 20;
  const viewW = Math.min(screenW - 24, 396);
  const frameH = viewW;
  // Escala base do mapa
  const baseScale = viewW / 500;
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 3.5;
  const [userZoom, setUserZoom] = useState(1.0);
  const userZoomRef = useRef(1.0);
  const effectiveScale = baseScale * userZoom;
  // Centro do canvas → centro do frame
  const initialOffX = (viewW - FARM_CANVAS_W) / 2;
  const initialOffY = (frameH - FARM_CANVAS_H) / 2;
  // Limites de panning (canvas nunca descobre borda do frame)
  const panMinX = viewW - (FARM_CANVAS_W / 2) * (1 + effectiveScale);
  const panMaxX = (FARM_CANVAS_W / 2) * (effectiveScale - 1);
  const panMinY = frameH - (FARM_CANVAS_H / 2) * (1 + effectiveScale);
  const panMaxY = (FARM_CANVAS_H / 2) * (effectiveScale - 1);
  const maxSlots = maxFarmSlots(tamerLevel);
  const activeFarmSlots = farmSlots.slice(0, maxSlots);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlotIdx, setPickerSlotIdx] = useState<number | null>(null);
  const [xpPerHour, setXpPerHour] = useState(10);
  const [maxHours, setMaxHours] = useState(8);
  const [elapsed, setElapsed] = useState('0s');
  const [pendingXp, setPendingXp] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const [selectedFarmDigi, setSelectedFarmDigi] = useState<string | null>(null);
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [battleConfirmModal, setBattleConfirmModal] = useState<{ mapId: string; stageIndex: number; mapName: string } | null>(null);
  const [rewardModal, setRewardModal] = useState<{ label: string } | null>(null);
  const [bubbles, setBubbles] = useState<BubbleData[]>(Array(6).fill(null));

  const [farmTab, setFarmTab] = useState<'digimons' | 'decoracao'>('digimons');
  const [placingDecoType, setPlacingDecoType] = useState<string | null>(null);
  const [movingDecoId, setMovingDecoId] = useState<string | null>(null);
  const [selectedDecoId, setSelectedDecoId] = useState<string | null>(null);
  const [asfaltoPreviewMeta, setAsfaltoPreviewMeta] = useState<AsfaltoMeta | null>(null);
  const [placingValid, setPlacingValid] = useState(true);
  const movingDecoIdRef = useRef<string | null>(null);
  const placingDecoTypeRef = useRef<string | null>(null);
  const farmViewRef = useRef<any>(null);
  const farmViewPos = useRef({ left: 0, top: 0 });
  const decoAnimPos = useRef(new Animated.ValueXY({ x: FARM_CANVAS_W / 2, y: FARM_CANVAS_H / 2 })).current;
  const placingDecoPosRef = useRef<{ x: number; y: number }>({ x: FARM_CANVAS_W / 2, y: FARM_CANVAS_H / 2 });
  const isPlacing = placingDecoType !== null || movingDecoId !== null;
  const isoGridCells = useMemo(() => {
    const g = ASFALTO_GRID;
    const cells: { key: string; left: number; top: number }[] = [];
    for (let i = 0; i * g <= FARM_CANVAS_W + g; i++) {
      for (let j = 0; j * g <= FARM_CANVAS_H + g; j++) {
        cells.push({ key: `gc${i}_${j}`, left: i * g - g / 2, top: j * g - g / 2 });
      }
    }
    return cells;
  }, []);
  // Drag-to-move state
  const decoLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragDecoState = useRef<{ id: string; active: boolean; startX: number; startY: number } | null>(null);

  // ── Day/Night + Weather ───────────────────────────────────────────────────
  const [farmTime, setFarmTime] = useState(() => new Date());
  const [weather, setWeather] = useState<'clear' | 'rain' | 'snow'>('clear');
  const RAIN_CNT = 50;
  const SNOW_CNT = 30;
  const rainAnims = useMemo(() => Array.from({ length: RAIN_CNT }, () => new Animated.Value(0)), []);
  const rainCfg = useMemo(() => Array.from({ length: RAIN_CNT }, (_, i) => ({
    x: (i / RAIN_CNT) * 420,
    dur: 330 + ((i * 97) % 250),
    del: (i * 43) % 900,
    len: 7 + ((i * 31) % 8),
    op: parseFloat((0.5 + ((i * 17) % 40) / 100).toFixed(2)),
  })), []);
  const snowAnims = useMemo(() => Array.from({ length: SNOW_CNT }, () => new Animated.Value(0)), []);
  const snowCfg = useMemo(() => Array.from({ length: SNOW_CNT }, (_, i) => ({
    x: (i / SNOW_CNT) * 420,
    dur: 2600 + ((i * 113) % 2500),
    del: (i * 97) % 2000,
    sz: i % 3 === 0 ? 3 : 2,
    op: parseFloat((0.6 + ((i * 23) % 35) / 100).toFixed(2)),
  })), []);
  const sunParams = useMemo(() => {
    const h = farmTime.getHours() + farmTime.getMinutes() / 60;
    if (h < 5 || h >= 20) return { ox: 0, oy: 3, op: 0.12, night: true };
    if (h < 6) { const t = h - 5; return { ox: -16 * (1 - t), oy: 4, op: 0.14 + t * 0.06, night: false }; }
    if (h >= 19) { const t = h - 19; return { ox: 16 * t, oy: 4, op: 0.2 - t * 0.07, night: false }; }
    const t = (h - 6) / 6;
    const elev = Math.sin(Math.PI * t / 2);
    const len = 26 * (1 - elev * 0.82);
    const ang = (t - 1) * (Math.PI / 2);
    return { ox: Math.sin(ang) * len * 0.6, oy: len * 0.22 + 2, op: 0.2 + elev * 0.15, night: false };
  }, [farmTime]);
  const skyTint = useMemo(() => {
    const h = farmTime.getHours() + farmTime.getMinutes() / 60;
    if (h >= 9 && h < 17) return null;
    if (h >= 6 && h < 9) { const t = (h - 6) / 3; return `rgba(255,110,30,${((1 - t) * 0.3).toFixed(2)})`; }
    if (h >= 17 && h < 19) { const t = (h - 17) / 2; return `rgba(255,70,10,${(t * 0.32).toFixed(2)})`; }
    if (h >= 19 && h < 20) { const t = h - 19; return `rgba(${Math.round(70 * (1 - t))},8,55,${(0.32 + t * 0.24).toFixed(2)})`; }
    if (h >= 5 && h < 6) { const t = h - 5; return `rgba(28,4,52,${(0.56 - t * 0.27).toFixed(2)})`; }
    return 'rgba(4,0,28,0.58)';
  }, [farmTime]);
  const weatherIcon = weather === 'rain' ? '🌧' : weather === 'snow' ? '❄️' : (skyTint ? '🌅' : '☀️');
  const timeLabel = `${String(farmTime.getHours()).padStart(2, '0')}:${String(farmTime.getMinutes()).padStart(2, '0')}`;

  const bubbleOpaqs = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const bubbleTransY = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;

  const digiAnims = useRef(
    Array.from({ length: 6 }, (_, i) => new Animated.ValueXY({ x: SLOT_STARTS[i].x, y: SLOT_STARTS[i].y }))
  ).current;
  const digiScaleX = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const digiCurrentPos = useRef(SLOT_STARTS.map((s) => ({ x: s.x, y: s.y }))).current;

  // ── Panning + Zoom do mapa ───────────────────────────────────────────────
  const canvasOffset = useRef(new Animated.ValueXY({ x: initialOffX, y: initialOffY })).current;
  const basePos = useRef({ x: initialOffX, y: initialOffY });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ active: boolean; initDist: number; initScale: number } | null>(null);
  const _panDummy1 = useRef(0);
  const _panDummy2 = useRef(0);

  function applyZoom(newZoom: number) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    userZoomRef.current = z;
    setUserZoom(z);
    const eff = baseScale * z;
    const pMinX = viewW - (FARM_CANVAS_W / 2) * (1 + eff);
    const pMaxX = (FARM_CANVAS_W / 2) * (eff - 1);
    const pMinY = frameH - (FARM_CANVAS_H / 2) * (1 + eff);
    const pMaxY = (FARM_CANVAS_H / 2) * (eff - 1);
    const cx = (canvasOffset.x as any).__getValue();
    const cy = (canvasOffset.y as any).__getValue();
    canvasOffset.setValue({
      x: Math.max(pMinX, Math.min(pMaxX, cx)),
      y: Math.max(pMinY, Math.min(pMaxY, cy)),
    });
  }

  const cartaBounce = useRef(new Animated.Value(0)).current;

  // ── Carta bounce loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cartaBounce, { toValue: -10, duration: 700, useNativeDriver: false }),
        Animated.timing(cartaBounce, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Real-time clock + weather ────────────────────────────────────────────────
  useEffect(() => {
    const timeTimer = setInterval(() => setFarmTime(new Date()), 30_000);
    const pickWx = () => {
      const r = Math.random();
      setWeather(r < 0.62 ? 'clear' : r < 0.82 ? 'rain' : 'snow');
    };
    pickWx();
    const wxTimer = setInterval(pickWx, 8 * 60_000);
    return () => { clearInterval(timeTimer); clearInterval(wxTimer); };
  }, []);

  useEffect(() => {
    rainAnims.forEach(a => { a.stopAnimation(); a.setValue(0); });
    snowAnims.forEach(a => { a.stopAnimation(); a.setValue(0); });
    if (weather === 'rain') {
      rainAnims.forEach((anim, i) => {
        const c = rainCfg[i];
        Animated.loop(
          Animated.sequence([
            Animated.delay(c.del),
            Animated.timing(anim, { toValue: 1, duration: c.dur, useNativeDriver: false }),
          ])
        ).start();
      });
    } else if (weather === 'snow') {
      snowAnims.forEach((anim, i) => {
        const c = snowCfg[i];
        Animated.loop(
          Animated.sequence([
            Animated.delay(c.del),
            Animated.timing(anim, { toValue: 1, duration: c.dur, useNativeDriver: false }),
          ])
        ).start();
      });
    }
  }, [weather]);

  // ── Initial hunger bubbles on mount ──────────────────────────────────────────
  useEffect(() => {
    if (activeFarmSlots.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    activeFarmSlots.forEach((ownedId, slotIdx) => {
      const lf = farmLastFeed[ownedId] ?? 0;
      const hungry = lf === 0 || (Date.now() - lf) >= 4 * 3600000;
      if (hungry) {
        const t = setTimeout(() => {
          triggerBubble(slotIdx, HUNGRY_SPEECH[Math.floor(Math.random() * HUNGRY_SPEECH.length)], 'speech');
        }, 1500 + slotIdx * 1200);
        timers.push(t);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [activeFarmSlots.join(',')]);

  // ── Deco obstacles — computed synchronously so wander effect sees them fresh ─
  const decoKey = (() => {
    _decoObstacles = farmDecorations.map((d) => {
      const cat = DECO_CATALOG[d.type];
      if (!cat) return null;
      const hw = cat.solidW / 2;
      const hh = cat.solidH / 2;
      return { x1: d.x - hw, y1: d.y - hh, x2: d.x + hw, y2: d.y + hh };
    }).filter(Boolean) as { x1: number; y1: number; x2: number; y2: number }[];
    return farmDecorations.map((d) => `${d.id}:${d.x}:${d.y}`).join('|');
  })();

  // ── Wander ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Sync current animated position → avoid teleporting when wander restarts
    activeFarmSlots.forEach((_, i) => {
      const ax = (digiAnims[i].x as any).__getValue();
      const ay = (digiAnims[i].y as any).__getValue();
      if (ax !== 0 || ay !== 0) {
        digiCurrentPos[i].x = ax;
        digiCurrentPos[i].y = ay;
      }
    });
    const flags = activeFarmSlots.map(() => ({ value: true }));
    activeFarmSlots.forEach((_, i) => startWander(digiAnims[i], digiScaleX[i], digiCurrentPos[i], flags[i]));
    return () => {
      flags.forEach((f) => { f.value = false; });
      activeFarmSlots.forEach((_, i) => digiAnims[i].stopAnimation());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarmSlots.length, decoKey]);

  // ── Bubble trigger ──────────────────────────────────────────────────────────
  const triggerBubble = useCallback((slotIdx: number, text: string, type: 'speech' | 'thought' | 'emoji') => {
    setBubbles((prev) => {
      const next = [...prev];
      next[slotIdx] = { text, type, key: Date.now() };
      return next;
    });
    bubbleOpaqs[slotIdx].setValue(0);
    bubbleTransY[slotIdx].setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(bubbleOpaqs[slotIdx], { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(bubbleTransY[slotIdx], { toValue: -12, duration: 2800, useNativeDriver: false }),
      ]),
      Animated.timing(bubbleOpaqs[slotIdx], { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start(() => {
      setBubbles((prev) => { const n = [...prev]; n[slotIdx] = null; return n; });
    });
  }, []);

  useEffect(() => {
    if (activeFarmSlots.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    activeFarmSlots.forEach((ownedId, slotIdx) => {
      function schedule() {
        const delay = 18000 + Math.random() * 27000;
        const t = setTimeout(() => {
          const now = Date.now();
          const lastFeed = farmLastFeed[ownedId] ?? 0;
          const hungry = lastFeed > 0 && (now - lastFeed) > 4 * 3600000;
          const req = farmBattleRequests[ownedId];
          const hasBattle = req && !req.fulfilled;

          const roll = Math.random();
          if (hungry && roll < 0.4) {
            const pool = roll < 0.2 ? HUNGRY_SPEECH : HUNGRY_THOUGHT;
            const type = roll < 0.2 ? 'speech' : 'thought';
            triggerBubble(slotIdx, pool[Math.floor(Math.random() * pool.length)], type);
          } else if (hasBattle && roll < 0.6) {
            triggerBubble(slotIdx, BATTLE_SPEECH[Math.floor(Math.random() * BATTLE_SPEECH.length)], 'speech');
          } else if (roll < 0.25) {
            triggerBubble(slotIdx, EMOJI_ONLY[Math.floor(Math.random() * EMOJI_ONLY.length)], 'emoji');
          } else if (roll < 0.6) {
            triggerBubble(slotIdx, SPEECH_PHRASES[Math.floor(Math.random() * SPEECH_PHRASES.length)], 'speech');
          } else {
            triggerBubble(slotIdx, THOUGHT_PHRASES[Math.floor(Math.random() * THOUGHT_PHRASES.length)], 'thought');
          }
          schedule();
        }, delay);
        timers.push(t);
      }
      schedule();
    });

    return () => timers.forEach(clearTimeout);
  }, [activeFarmSlots.length, farmLastFeed, farmBattleRequests]);

  // ── Interações sociais entre Digimons ───────────────────────────────────────
  const triggerInteraction = useCallback(() => {
    const occupiedSlots = activeFarmSlots
      .map((ownedId, idx) => ({ ownedId, idx }))
      .filter(({ ownedId }) => !!ownedId);
    if (occupiedSlots.length < 2) return;

    const shuffled = [...occupiedSlots].sort(() => Math.random() - 0.5);
    const slotA = shuffled[0];
    const slotB = shuffled[1];

    const ownedA = collection.find((c) => c.ownedId === slotA.ownedId);
    const ownedB = collection.find((c) => c.ownedId === slotB.ownedId);
    const charA = ownedA ? (getCharacter(ownedA.characterId) ?? CHARACTERS[ownedA.characterId]) : null;
    const charB = ownedB ? (getCharacter(ownedB.characterId) ?? CHARACTERS[ownedB.characterId]) : null;

    const rel = getRelationship(
      charA?.attribute, charA?.element,
      charB?.attribute, charB?.element,
    );

    let opener: string;
    let response: string;
    let openerType: 'speech' | 'thought';
    let responseType: 'speech' | 'thought';

    if (rel === 'intimacy') {
      opener   = pick(INTIMACY_OPENERS);
      response = pick(INTIMACY_RESPONSES);
      openerType   = 'speech';
      responseType = 'speech';
    } else if (rel === 'rivalry') {
      opener   = pick(RIVALRY_OPENERS);
      response = pick(RIVALRY_RESPONSES);
      openerType   = 'speech';
      responseType = 'speech';
    } else {
      opener   = pick(NEUTRAL_OPENERS);
      response = pick(NEUTRAL_RESPONSES);
      openerType   = Math.random() < 0.5 ? 'speech' : 'thought';
      responseType = 'speech';
    }

    triggerBubble(slotA.idx, opener, openerType);
    const responseTimer = setTimeout(() => {
      triggerBubble(slotB.idx, response, responseType);
    }, 2800);
    return responseTimer;
  }, [activeFarmSlots, collection, triggerBubble]);

  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeFarmSlots.filter(Boolean).length < 2) return;
    let pending: ReturnType<typeof setTimeout> | null = null;

    function schedule() {
      const delay = 30000 + Math.random() * 30000;
      pending = setTimeout(() => {
        const inner = triggerInteraction();
        if (inner) interactionTimerRef.current = inner;
        schedule();
      }, delay);
    }
    schedule();

    return () => {
      if (pending) clearTimeout(pending);
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, [activeFarmSlots.filter(Boolean).length, triggerInteraction]);

  // ── Screen → canvas coordinate conversion ───────────────────────────────────
  function screenToCanvas(px: number, py: number) {
    const offX = (canvasOffset.x as any).__getValue();
    const offY = (canvasOffset.y as any).__getValue();
    const cx = FARM_CANVAS_W / 2;
    const cy = FARM_CANVAS_H / 2;
    const eff = baseScale * userZoomRef.current;
    return {
      x: clamp((px - farmViewPos.current.left - offX - cx) / eff + cx, 100, FARM_CANVAS_W - 100),
      y: clamp((py - farmViewPos.current.top - offY - cy) / eff + cy, 100, FARM_CANVAS_H - 100),
    };
  }

  function checkDecoOverlap(type: string, x: number, y: number, excludeId?: string): boolean {
    const cat = DECO_CATALOG[type];
    if (!cat) return false;
    const uw = cat.solidW > 0 ? cat.solidW : cat.displayW;
    const uh = cat.solidH > 0 ? cat.solidH : cat.displayH;
    const hw = uw / 2;
    const hh = uh / 2;
    for (const d of farmDecorations) {
      if (excludeId && d.id === excludeId) continue;
      const dc = DECO_CATALOG[d.type];
      if (!dc) continue;
      const dw = dc.solidW > 0 ? dc.solidW : dc.displayW;
      const dh = dc.solidH > 0 ? dc.solidH : dc.displayH;
      if (x + hw > d.x - dw / 2 && x - hw < d.x + dw / 2 &&
          y + hh > d.y - dh / 2 && y - hh < d.y + dh / 2) {
        return true;
      }
    }
    return false;
  }

  function setDecoPos(x: number, y: number, hintType?: string, hintExcludeId?: string) {
    const t = hintType ?? placingDecoTypeRef.current ?? (() => {
      const mid = movingDecoIdRef.current;
      return mid ? farmDecorations.find((d) => d.id === mid)?.type ?? null : null;
    })();
    const needsSnap = t && (isAsfalto(t) || t === 'fence' || t === 'fence_mirror');
    const sx = needsSnap ? snapAsfalto(x) : x;
    const sy = needsSnap ? snapAsfalto(y) : y;
    placingDecoPosRef.current = { x: sx, y: sy };
    decoAnimPos.setValue({ x: sx, y: sy });
    const excl = hintExcludeId ?? movingDecoIdRef.current ?? undefined;
    if (t) {
      setPlacingValid(!checkDecoOverlap(t, sx, sy, excl ?? undefined));
      if (isAsfalto(t)) {
        setAsfaltoPreviewMeta(resolveAsfaltoMeta(sx, sy, farmDecorations, excl));
      } else {
        setAsfaltoPreviewMeta(null);
      }
    } else {
      setPlacingValid(true);
      setAsfaltoPreviewMeta(null);
    }
  }

  function enterDecoPlacement(type: string, decoId?: string) {
    farmViewRef.current?.measureInWindow((fx: number, fy: number) => {
      farmViewPos.current = { left: fx, top: fy };
    });
    if (decoId) {
      const deco = farmDecorations.find((d) => d.id === decoId);
      const pos = deco ? { x: deco.x, y: deco.y } : { x: FARM_CANVAS_W / 2, y: FARM_CANVAS_H / 2 };
      movingDecoIdRef.current = decoId;
      placingDecoTypeRef.current = null;
      setMovingDecoId(decoId);
      setDecoPos(pos.x, pos.y, type, decoId);
    } else {
      placingDecoTypeRef.current = type;
      movingDecoIdRef.current = null;
      setPlacingDecoType(type);
      setDecoPos(FARM_CANVAS_W / 2, FARM_CANVAS_H / 2, type);
    }
    setSelectedDecoId(null);
    setFarmTab('digimons');
  }

  function confirmDecoPlacement() {
    if (!placingValid) return;
    const { x, y } = placingDecoPosRef.current;
    if (placingDecoType) {
      const type = placingDecoType;
      const currentQty = farmDecorInventory[type] ?? 0;
      if (isAsfalto(type)) {
        placeAsfaltoAutoConnect(type, x, y);
      } else {
        placeFarmDecoration(type, x, y);
      }
      if (currentQty > 1) {
        setDecoPos(FARM_CANVAS_W / 2, FARM_CANVAS_H / 2, type);
      } else {
        placingDecoTypeRef.current = null;
        setPlacingDecoType(null);
      }
    } else if (movingDecoId) {
      const movingDeco = farmDecorations.find((d) => d.id === movingDecoId);
      if (movingDeco && isAsfalto(movingDeco.type)) {
        moveAsfaltoAutoConnect(movingDecoId, x, y);
      } else {
        moveFarmDecoration(movingDecoId, x, y);
      }
      movingDecoIdRef.current = null;
      setMovingDecoId(null);
    }
  }

  function cancelDecoPlacement() {
    placingDecoTypeRef.current = null;
    movingDecoIdRef.current = null;
    setPlacingDecoType(null);
    setMovingDecoId(null);
    setAsfaltoPreviewMeta(null);
    setPlacingValid(true);
  }

  // ── Config & timers ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${apiUrl}/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.config) {
          const xph = Number(data.config.farmXpPerHour ?? 10);
          const mh  = Number(data.config.farmMaxHours ?? 8);
          setXpPerHour(isNaN(xph) ? 10 : xph);
          setMaxHours(isNaN(mh) ? 8 : mh);
        }
      }).catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    const update = () => {
      const cappedMs = Math.min(Date.now() - farmLastClaim, maxHours * 3600000);
      setElapsed(formatDuration(cappedMs));
      setPendingXp(calcPendingXp(farmSlots, farmLastClaim, tamerLevel, xpPerHour, maxHours));
      processFarmEvolutions();
      generateFarmBattleRequests();
    };
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [farmSlots, farmLastClaim, tamerLevel, xpPerHour, maxHours]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  function openPicker(slotIdx: number) { setPickerSlotIdx(slotIdx); setPickerOpen(true); }

  function assignToSlot(ownedId: string) {
    if (pickerSlotIdx === null) return;
    const newSlots = [...farmSlots];
    const existingIdx = newSlots.indexOf(ownedId);
    if (existingIdx !== -1) newSlots.splice(existingIdx, 1);
    while (newSlots.length <= pickerSlotIdx) newSlots.push('');
    newSlots[pickerSlotIdx] = ownedId;
    setFarmSlots(newSlots.filter(Boolean));
    setPickerOpen(false);
  }

  function removeFromSlot(ownedId: string) {
    setFarmSlots(farmSlots.filter((id) => id !== ownedId));
    if (selectedFarmDigi === ownedId) setSelectedFarmDigi(null);
  }

  function handleDigimonPress(ownedId: string, slotIdx: number) {
    setSelectedFarmDigi((prev) => (prev === ownedId ? null : ownedId));
    const sat = computeSatisfaction(ownedId, farmLastFeed, farmBattleRequests);
    const lf = farmLastFeed[ownedId] ?? 0;
    const hungry = lf === 0 || (Date.now() - lf) >= 4 * 3600000;
    const req = farmBattleRequests[ownedId];

    if (hungry) {
      triggerBubble(slotIdx, HUNGRY_SPEECH[Math.floor(Math.random() * HUNGRY_SPEECH.length)], 'speech');
      setTimeout(() => setFeedModalOpen(true), 400);
    } else if (req && !req.fulfilled) {
      triggerBubble(slotIdx, BATTLE_SPEECH[Math.floor(Math.random() * BATTLE_SPEECH.length)], 'speech');
      const owned = collection.find((c) => c.ownedId === ownedId);
      if (owned) {
        const map = getSuggestedMap(owned.level, customGameMaps);
        if (map) setTimeout(() => setBattleConfirmModal(map), 400);
      }
    } else {
      triggerBubble(slotIdx, getSatisfactionEmoji(sat), 'emoji');
    }
  }

  function collectXp() {
    if (pendingXp <= 0 || farmSlots.length === 0) return;
    setCollecting(true);
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
    const xpEach = Math.max(1, Math.floor(pendingXp / farmSlots.length));
    farmSlots.forEach((id) => gainExp(id, xpEach));
    setFarmSlots(farmSlots, true);
    processFarmEvolutions();
    setTimeout(() => setCollecting(false), 500);
  }

  function handleFeed(foodId: string) {
    if (!selectedFarmDigi) return;
    const ok = feedFarmDigimon(selectedFarmDigi, foodId);
    if (ok) {
      setFeedModalOpen(false);
      triggerBubble(
        activeFarmSlots.indexOf(selectedFarmDigi),
        '😋 Hmm, delicioso!',
        'speech'
      );
    }
  }

  function handleClaimDailyReward() {
    const reward = claimFarmDailyReward();
    if (reward) {
      setRewardModal({ label: reward.label });
    } else {
      Alert.alert('Farm', 'Cuide de todos os Digimons para desbloquear a recompensa diária!');
    }
  }

  function getEvoInfo(ownedId: string, characterId: string, level: number) {
    const char = getCharacter(characterId) ?? CHARACTERS[characterId];
    if (!char) return null;
    const rarity = char.rarity as string;
    if (!PRE_ROOKIE_STAGE_RARITIES.has(rarity as any)) return null;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (rarity === 'EGG' || rarity === 'BABY') {
      const entryTime = farmEntryTimes[ownedId] ?? Date.now();
      const remaining = ONE_DAY - (Date.now() - entryTime);
      const stageName = RARITY_LABELS[rarity as keyof typeof RARITY_LABELS];
      if (remaining <= 0) return { label: `${stageName} → ${t('farm.readyToEvo')}`, color: '#22c55e' };
      return { label: `${stageName} ${t('farm.evolveIn')} ${formatDuration(remaining)}`, color: '#fbbf24' };
    }
    if (rarity === 'TRAINING') {
      if (level >= 5) return { label: `Treinamento → ${t('farm.readyToEvo')}`, color: '#22c55e' };
      return { label: `Treinamento ${t('farm.evolveAtLv')} 5 (Lv. ${level})`, color: '#60a5fa' };
    }
    return null;
  }

  const selectedDigi = selectedFarmDigi ? collection.find((c) => c.ownedId === selectedFarmDigi) : null;
  const selectedChar = selectedDigi ? (getCharacter(selectedDigi.characterId) ?? CHARACTERS[selectedDigi.characterId]) : null;
  const selectedSat = selectedFarmDigi ? computeSatisfaction(selectedFarmDigi, farmLastFeed, farmBattleRequests) : 0;
  const selectedReq = selectedFarmDigi ? farmBattleRequests[selectedFarmDigi] : undefined;
  const selectedLastFeed = selectedFarmDigi ? (farmLastFeed[selectedFarmDigi] ?? 0) : 0;
  const isHungry = selectedLastFeed === 0 || (Date.now() - selectedLastFeed) >= 4 * 3600000;
  const totalFood = Object.values(farmFoods).reduce((s, n) => s + n, 0);
  const today = new Date().toISOString().slice(0, 10);
  const dailyAvailable = farmDailyRewardClaim !== today && activeFarmSlots.length > 0;

  const allSatisfied = activeFarmSlots.length > 0 && activeFarmSlots.every((ownedId) => {
    const lf = farmLastFeed[ownedId] ?? 0;
    const req = farmBattleRequests[ownedId];
    return lf > 0 && (Date.now() - lf) < 8 * 3600000 && (!req || req.fulfilled);
  });

  const availableDigimons = collection.filter((c) => !activeFarmSlots.includes(c.ownedId));
  const nextLevelSlot = maxSlots < 6 ? maxSlots * 5 : null;

  const suggestedMap = selectedDigi ? getSuggestedMap(selectedDigi.level, customGameMaps) : null;

  const satBarColor = selectedSat >= 80 ? '#22c55e' : selectedSat >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>

      {/* ── Grupo central: mapa + slots juntos, centralizados na tela ──────── */}
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>

        {/* ── Wrapper: mapa + slots + moldura ─────────────────────────── */}
        <View style={{ position: 'relative', width: viewW, height: frameH + 80 }}>

        {/* Farm canvas — quadrado com frame, panning habilitado */}
        <View
          ref={farmViewRef}
          style={[
            { width: viewW, height: frameH, overflow: 'hidden' },
            Platform.OS === 'web' ? { touchAction: 'none' } as any : {},
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const touches = e.nativeEvent.touches;
            if (touches && touches.length >= 2) {
              if (decoLongPressTimer.current) clearTimeout(decoLongPressTimer.current);
              const dist = Math.hypot(
                touches[0].pageX - touches[1].pageX,
                touches[0].pageY - touches[1].pageY,
              );
              pinchRef.current = { active: true, initDist: dist, initScale: userZoomRef.current };
              touchStart.current = null;
              return;
            }
            pinchRef.current = null;
            const touch = touches?.[0] ?? e.nativeEvent;
            if (isPlacing) {
              farmViewRef.current?.measureInWindow((fx: number, fy: number) => {
                farmViewPos.current = { left: fx, top: fy };
                const pos = screenToCanvas(touch.pageX, touch.pageY);
                setDecoPos(pos.x, pos.y);
              });
            } else {
              touchStart.current = { x: touch.pageX, y: touch.pageY };
              basePos.current = {
                x: (canvasOffset.x as any).__getValue(),
                y: (canvasOffset.y as any).__getValue(),
              };
            }
          }}
          onResponderMove={(e) => {
            const touches = e.nativeEvent.touches;

            // ── Pinch zoom (2 fingers) ─────────────────────────────────
            if (touches && touches.length >= 2 && pinchRef.current?.active) {
              const dist = Math.hypot(
                touches[0].pageX - touches[1].pageX,
                touches[0].pageY - touches[1].pageY,
              );
              const ratio = dist / pinchRef.current.initDist;
              applyZoom(pinchRef.current.initScale * ratio);
              return;
            }

            // ── Transition: 2 fingers → 1 finger ──────────────────────
            // After a pinch the responder is still held but touchStart is null.
            // Re-anchor so the next move is interpreted as a pan, not a jump.
            if (pinchRef.current) {
              pinchRef.current = null;
              const t = touches?.[0] ?? e.nativeEvent;
              touchStart.current = { x: t.pageX, y: t.pageY };
              basePos.current = {
                x: (canvasOffset.x as any).__getValue(),
                y: (canvasOffset.y as any).__getValue(),
              };
              return;
            }

            const touch = touches?.[0] ?? e.nativeEvent;

            if (isPlacing) {
              const pos = screenToCanvas(touch.pageX, touch.pageY);
              setDecoPos(pos.x, pos.y);
              return;
            }

            // If touchStart is still null for any reason, anchor now
            if (!touchStart.current) {
              touchStart.current = { x: touch.pageX, y: touch.pageY };
              basePos.current = {
                x: (canvasOffset.x as any).__getValue(),
                y: (canvasOffset.y as any).__getValue(),
              };
              return;
            }

            // ── Pan ────────────────────────────────────────────────────
            const dx = touch.pageX - touchStart.current.x;
            const dy = touch.pageY - touchStart.current.y;
            // Use userZoomRef for fresh limits — state may not have updated yet
            const eff = baseScale * userZoomRef.current;
            const pMinX = viewW - (FARM_CANVAS_W / 2) * (1 + eff);
            const pMaxX = (FARM_CANVAS_W / 2) * (eff - 1);
            const pMinY = frameH - (FARM_CANVAS_H / 2) * (1 + eff);
            const pMaxY = (FARM_CANVAS_H / 2) * (eff - 1);
            const nx = Math.max(pMinX, Math.min(pMaxX, basePos.current.x + dx));
            const ny = Math.max(pMinY, Math.min(pMaxY, basePos.current.y + dy));
            canvasOffset.setValue({ x: nx, y: ny });
          }}
          onResponderRelease={() => { touchStart.current = null; pinchRef.current = null; }}
          onResponderTerminate={() => { touchStart.current = null; pinchRef.current = null; }}
        >

          <Animated.View style={[styles.farmCanvas, {
            transform: [
              { translateX: canvasOffset.x as any },
              { translateY: canvasOffset.y as any },
              { scale: effectiveScale },
            ],
          }]}>
            <Image source={FARM_BG} style={styles.farmBgImg} resizeMode="cover" />

            {/* ── Snap grid (horizontal + vertical lines) ── */}
            {isPlacing && (() => {
              const g = ASFALTO_GRID;
              const W = FARM_CANVAS_W;
              const H = FARM_CANVAS_H;
              const lines: { x1: number; y1: number; x2: number; y2: number; k: string }[] = [];

              // Vertical lines offset by g/2 so snap positions (multiples of g) land in cell centers
              for (let x = -g / 2; x <= W + g / 2; x += g) {
                lines.push({ x1: x, y1: 0, x2: x, y2: H, k: `v${x}` });
              }
              // Horizontal lines offset by g/2
              for (let y = -g / 2; y <= H + g / 2; y += g) {
                lines.push({ x1: 0, y1: y, x2: W, y2: y, k: `h${y}` });
              }

              return (
                <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, zIndex: 3, pointerEvents: 'none' }}>
                  <Svg width={W} height={H}>
                    {lines.map(({ x1, y1, x2, y2, k }) => (
                      <Line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                    ))}
                  </Svg>
                </View>
              );
            })()}

            {/* ── Placed decorations ────────────────────────────────── */}
            {farmDecorations.map((d) => {
              const cat = DECO_CATALOG[d.type];
              if (!cat) return null;
              const isMovingThis = movingDecoId === d.id;
              return (
                <View
                  key={d.id}
                  style={{
                    position: 'absolute',
                    left: d.x - cat.displayW / 2,
                    top: d.y - cat.displayH / 2,
                    width: cat.displayW,
                    height: cat.displayH,
                    opacity: isMovingThis ? 0.3 : 1,
                    zIndex: 5,
                    overflow: 'visible',
                  }}
                  onStartShouldSetResponder={() => !isPlacing}
                  onMoveShouldSetResponder={() => dragDecoState.current?.id === d.id && (dragDecoState.current?.active ?? false)}
                  onResponderTerminationRequest={() => false}
                  onResponderGrant={(e) => {
                    const touch = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
                    dragDecoState.current = { id: d.id, active: false, startX: touch.pageX, startY: touch.pageY };
                    decoLongPressTimer.current = setTimeout(() => {
                      if (dragDecoState.current?.id !== d.id) return;
                      dragDecoState.current.active = true;
                      farmViewRef.current?.measureInWindow((fx: number, fy: number) => {
                        farmViewPos.current = { left: fx, top: fy };
                      });
                      movingDecoIdRef.current = d.id;
                      placingDecoTypeRef.current = null;
                      setMovingDecoId(d.id);
                      const dd = farmDecorations.find((x) => x.id === d.id);
                      if (dd) setDecoPos(dd.x, dd.y, d.type, d.id);
                      setSelectedDecoId(null);
                    }, 400);
                  }}
                  onResponderMove={(e) => {
                    if (dragDecoState.current?.id !== d.id) return;
                    const touch = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
                    if (!dragDecoState.current.active) {
                      const dx = Math.abs(touch.pageX - dragDecoState.current.startX);
                      const dy = Math.abs(touch.pageY - dragDecoState.current.startY);
                      if (dx > 8 || dy > 8) {
                        if (decoLongPressTimer.current) clearTimeout(decoLongPressTimer.current);
                        dragDecoState.current = null;
                      }
                      return;
                    }
                    const pos = screenToCanvas(touch.pageX, touch.pageY);
                    setDecoPos(pos.x, pos.y, d.type, d.id);
                  }}
                  onResponderRelease={() => {
                    if (decoLongPressTimer.current) clearTimeout(decoLongPressTimer.current);
                    const state = dragDecoState.current;
                    dragDecoState.current = null;
                    if (!state) return;
                    if (state.active && state.id === d.id) {
                      const { x, y } = placingDecoPosRef.current;
                      if (!checkDecoOverlap(d.type, x, y, d.id)) {
                        if (isAsfalto(d.type)) {
                          moveAsfaltoAutoConnect(d.id, x, y);
                        } else {
                          moveFarmDecoration(d.id, x, y);
                        }
                      }
                      movingDecoIdRef.current = null;
                      setMovingDecoId(null);
                      setPlacingValid(true);
                    } else {
                      setSelectedDecoId((prev) => prev === d.id ? null : d.id);
                    }
                  }}
                >
                  {/* Shadow */}
                  {!isAsfalto(d.type) && (
                    <View style={{
                      position: 'absolute',
                      left: cat.displayW / 2 + sunParams.ox * 0.2 - cat.displayW * 0.3,
                      top: cat.displayH * 0.85 - cat.displayW * 0.3,
                      width: cat.displayW * 0.6,
                      height: cat.displayW * 0.6,
                      borderRadius: cat.displayW * 0.3,
                      backgroundColor: `rgba(0,0,0,${sunParams.op.toFixed(2)})`,
                      transform: [{ scaleY: 0.28 }],
                    }} />
                  )}
                  <Image
                    source={cat.image}
                    style={{
                      width: cat.displayW,
                      height: cat.displayH,
                      transform: [
                        { rotate: `${(d as any).rotation ?? 0}deg` },
                        { scaleX: (cat.mirror || d.mirrored) ? -1 : 1 },
                      ],
                    }}
                    resizeMode={cat.iso ? 'stretch' : 'contain'}
                  />
                  {selectedDecoId === d.id && !isPlacing && (
                    <View style={styles.decoActionBubble}>
                      <TouchableOpacity
                        style={[styles.decoActionBtn, { backgroundColor: '#8b5cf6' }]}
                        onPress={() => { mirrorFarmDecoration(d.id); setSelectedDecoId(null); }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.decoActionBtnText}>↔️ Espelhar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.decoActionBtn, { backgroundColor: '#ef4444' }]}
                        onPress={() => { removeFarmDecoration(d.id); setSelectedDecoId(null); }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.decoActionBtnText}>🗑 Remover</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {/* ── Placement preview ─────────────────────────────────── */}
            {isPlacing && (() => {
              const rawType = placingDecoType ?? (movingDecoId ? farmDecorations.find((d) => d.id === movingDecoId)?.type : null);
              if (!rawType) return null;
              const isAsfaltoPrev = isAsfalto(rawType);
              // When placing a new tile, respect user's chosen type; auto-connect only applies when moving existing tiles
              const isMoving = !!movingDecoId;
              const previewType = (isAsfaltoPrev && isMoving && asfaltoPreviewMeta) ? asfaltoPreviewMeta.type : rawType;
              const previewRotation = (isAsfaltoPrev && isMoving && asfaltoPreviewMeta) ? asfaltoPreviewMeta.rotation : 0;
              const cat = DECO_CATALOG[previewType] ?? DECO_CATALOG[rawType];
              if (!cat) return null;
              const pad = 6;
              const w = cat.displayW;
              const h = cat.displayH;
              const outlineColor = placingValid ? '#22c55e' : '#ef4444';
              const cx = pad + w / 2;
              const cy = pad + h / 2;
              const rectPoints = `${pad},${pad} ${pad + w},${pad} ${pad + w},${pad + h} ${pad},${pad + h}`;
              return (
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: w + 2 * pad,
                    height: h + 2 * pad,
                    opacity: 0.9,
                    zIndex: 20,
                    transform: [
                      { translateX: Animated.subtract(decoAnimPos.x, cx) as any },
                      { translateY: Animated.subtract(decoAnimPos.y, cy) as any },
                    ],
                  }}
                  pointerEvents="none"
                >
                  <Image
                    source={cat.image}
                    style={{
                      position: 'absolute',
                      left: pad,
                      top: pad,
                      width: w,
                      height: h,
                      transform: [
                        { rotate: `${previewRotation}deg` },
                        { scaleX: cat.mirror ? -1 : 1 },
                      ],
                    }}
                    resizeMode={cat.iso ? 'stretch' : 'contain'}
                  />
                  <Svg
                    width={w + 2 * pad}
                    height={h + 2 * pad}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  >
                    <Polygon
                      points={rectPoints}
                      fill="none"
                      stroke={outlineColor}
                      strokeWidth="2"
                    />
                  </Svg>
                  <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      borderRadius: 20,
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 20, lineHeight: 22 }}>✥</Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })()}

            {activeFarmSlots.map((ownedId, slotIdx) => {
              const owned = collection.find((c) => c.ownedId === ownedId);
              const slotChar = owned ? (getCharacter(owned.characterId) ?? CHARACTERS[owned.characterId]) : null;
              if (!owned) return null;
              const isEgg = slotChar?.rarity === 'EGG';
              const size = isEgg ? 44 : 68;
              const bubble = bubbles[slotIdx];

              return (
                <Animated.View
                  key={ownedId}
                  style={[
                    styles.digimonOnFarm,
                    {
                      transform: [
                        { translateX: Animated.subtract(digiAnims[slotIdx].x, size / 2) as any },
                        { translateY: Animated.subtract(digiAnims[slotIdx].y, size / 2) as any },
                      ],
                    },
                  ]}
                >
                  {bubble && (
                    <Animated.View
                      style={[
                        styles.bubbleWrapper,
                        { bottom: size + 6, opacity: bubbleOpaqs[slotIdx], transform: [{ translateY: bubbleTransY[slotIdx] }] },
                      ]}
                    >
                      {bubble.type === 'emoji' ? (
                        <Text style={{ fontSize: 28 }}>{bubble.text}</Text>
                      ) : (
                        <View style={[styles.bubbleBox, bubble.type === 'thought' ? styles.thoughtBox : styles.speechBox]}>
                          {bubble.type === 'thought' && <Text style={styles.bubbleDots}>• •</Text>}
                          <Text style={styles.bubbleText}>{bubble.text}</Text>
                        </View>
                      )}
                    </Animated.View>
                  )}
                  {/* Digimon shadow — positioned at character feet */}
                  <View style={{
                    position: 'absolute',
                    left: size / 2 + sunParams.ox * 0.2 - size * 0.22,
                    top: size * 0.52,
                    width: size * 0.44,
                    height: size * 0.44,
                    borderRadius: size * 0.22,
                    backgroundColor: `rgba(0,0,0,${(sunParams.op * 0.85).toFixed(2)})`,
                    transform: [{ scaleY: 0.3 }],
                  }} />
                  <Animated.View style={{ transform: [{ scaleX: digiScaleX[slotIdx] }] }}>
                    <TouchableOpacity onPress={() => handleDigimonPress(ownedId, slotIdx)} activeOpacity={0.8}>
                      <CharacterAvatar characterId={owned.characterId} size={size} />
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              );
            })}
          </Animated.View>

          {/* ── Sky tint (day/night overlay) ──────────────────────────── */}
          {skyTint !== null && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: skyTint, pointerEvents: 'none' }} />
          )}

          {/* ── Weather overlay ───────────────────────────────────────── */}
          {weather !== 'clear' && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {weather === 'rain' && rainAnims.map((anim, i) => {
                const c = rainCfg[i];
                const yPos = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, frameH + 20] });
                return (
                  <Animated.View key={`rp${i}`} style={{
                    position: 'absolute', left: c.x, top: yPos as any,
                    width: 1, height: c.len,
                    backgroundColor: `rgba(180,220,255,${c.op})`,
                    transform: [{ rotate: '15deg' }],
                  }} />
                );
              })}
              {weather === 'snow' && snowAnims.map((anim, i) => {
                const c = snowCfg[i];
                const yPos = anim.interpolate({ inputRange: [0, 1], outputRange: [-10, frameH + 10] });
                return (
                  <Animated.View key={`sp${i}`} style={{
                    position: 'absolute', left: c.x, top: yPos as any,
                    width: c.sz, height: c.sz,
                    backgroundColor: `rgba(255,255,255,${c.op})`,
                    borderRadius: 1,
                  }} />
                );
              })}
            </View>
          )}

          {/* HUD */}
          <View pointerEvents="none" style={[styles.hudTop, { top: 10 }]}>
            <View style={styles.hudPill}>
              <Text style={{ fontSize: 13 }}>🌿</Text>
              <Text style={styles.hudTitle}>DIGIFARM {activeFarmSlots.length}/{maxSlots}</Text>
              <Text style={{ fontSize: 11, marginLeft: 6 }}>{weatherIcon}</Text>
              <Text style={[styles.hudTitle, { marginLeft: 2 }]}>{timeLabel}</Text>
            </View>
          </View>

          {/* Badge XP */}
          {pendingXp > 0 && activeFarmSlots.length > 0 && (
            <TouchableOpacity style={[styles.xpBadge, { top: 10 }]} onPress={collectXp} activeOpacity={0.8}>
              <Text style={{ fontSize: 15 }}>⭐</Text>
              <View>
                <Text style={styles.xpBadgeMain}>+{pendingXp.toLocaleString()} XP</Text>
                <Text style={styles.xpBadgeSub}>TOQUE PARA COLETAR</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Zoom controls ─────────────────────────────────────────── */}
          {!isPlacing && (
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => applyZoom(userZoomRef.current * 1.3)} activeOpacity={0.75}>
                <Text style={styles.zoomBtnText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.zoomLabel}>{Math.round(userZoom * 100)}%</Text>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => applyZoom(userZoomRef.current / 1.3)} activeOpacity={0.75}>
                <Text style={styles.zoomBtnText}>−</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Confirm / Cancel placement overlay ────────────────────── */}
        {isPlacing && (
          <View style={[styles.placingOverlay, { width: viewW }]}>
            {placingDecoType ? (
              <>
                <Text style={styles.placingHint}>
                  {placingValid ? (
                    <>
                      {'Arraste · '}
                      <Text style={{ color: '#fbbf24', fontWeight: '800' }}>
                        {`×${Math.max(0, farmDecorInventory[placingDecoType] ?? 0)} restantes`}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: '#ef4444', fontWeight: '800' }}>⚠ Posição inválida!</Text>
                  )}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity style={[styles.placingBtn, { backgroundColor: '#ef4444' }]} onPress={cancelDecoPlacement} activeOpacity={0.8}>
                    <Text style={styles.placingBtnText}>✕ Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.placingBtn, { backgroundColor: placingValid ? '#22c55e' : '#6b7280', opacity: placingValid ? 1 : 0.6 }]}
                    onPress={confirmDecoPlacement}
                    activeOpacity={placingValid ? 0.8 : 1}
                  >
                    <Text style={styles.placingBtnText}>✓ Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.placingHint}>
                  {placingValid
                    ? 'Segure e arraste · Solte para confirmar'
                    : <Text style={{ color: '#ef4444', fontWeight: '800' }}>⚠ Posição inválida!</Text>
                  }
                </Text>
                <TouchableOpacity style={[styles.placingBtn, { backgroundColor: '#ef4444' }]} onPress={cancelDecoPlacement} activeOpacity={0.8}>
                  <Text style={styles.placingBtnText}>✕ Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Slots — direto abaixo do mapa ─────────────────────────────── */}
        <View style={[styles.bottomPanel, { width: viewW }]}>
          {/* ── Tab bar ──────────────────────────────────────────────── */}
          {!isPlacing && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, farmTab === 'digimons' && styles.tabBtnActive]}
                onPress={() => setFarmTab('digimons')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, farmTab === 'digimons' && styles.tabBtnTextActive]}>🐉 Digimons</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, farmTab === 'decoracao' && styles.tabBtnActive]}
                onPress={() => setFarmTab('decoracao')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, farmTab === 'decoracao' && styles.tabBtnTextActive]}>🏠 Decoração</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Decoração tab ─────────────────────────────────────── */}
          {farmTab === 'decoracao' && !isPlacing && (
            <ScrollView
              style={{ maxHeight: 220 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {Object.entries(DECO_CATALOG).map(([type, cat]) => {
                const qty = farmDecorInventory[type] ?? 0;
                const hasPlaced = farmDecorations.some((d) => d.type === type);
                if (qty === 0 && !hasPlaced) return null;
                return (
                  <View key={type} style={styles.decoInventoryRow}>
                    <Image source={cat.image} style={{ width: 64, height: 40 }} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.decoInventoryName}>{cat.name}</Text>
                      <Text style={styles.decoInventorySub}>
                        {qty > 0 ? `×${qty} disponível` : 'Sem estoque'}
                        {hasPlaced ? ' · Colocado no campo' : ''}
                      </Text>
                    </View>
                    {qty > 0 && (
                      <TouchableOpacity
                        style={styles.decoPlaceBtn}
                        onPress={() => enterDecoPlacement(type)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.decoPlaceBtnText}>Colocar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {Object.values(farmDecorInventory).every((n) => n === 0) && farmDecorations.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                  <Text style={{ fontSize: 28 }}>🏠</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' }}>
                    Nenhuma decoração disponível.{'\n'}Desbloqueie no Correios!
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── Digimons tab ──────────────────────────────────────── */}
          {(farmTab === 'digimons' || isPlacing) && (
            <React.Fragment>
            <View style={styles.slotsRow}>
              {Array.from({ length: maxSlots }).map((_, i) => {
                const ownedId = activeFarmSlots[i];
                if (ownedId) {
                  const owned = collection.find((c) => c.ownedId === ownedId);
                  if (!owned) return null;
                  const isSelected = selectedFarmDigi === ownedId;
                  return (
                    <TouchableOpacity
                      key={ownedId}
                      onPress={() => handleDigimonPress(ownedId, i)}
                      activeOpacity={0.8}
                      style={[styles.slotFilled, isSelected && styles.slotFilledSelected]}
                    >
                      <CharacterAvatar characterId={owned.characterId} size={44} />
                      <TouchableOpacity
                        onPress={() => removeFromSlot(ownedId)}
                        style={styles.slotRemove}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Feather name="x" size={9} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={`empty-${i}`}
                    onPress={() => openPicker(i)}
                    activeOpacity={0.7}
                    style={styles.slotEmpty}
                  >
                    <Feather name="plus" size={22} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Painel de ação do Digimon selecionado */}
            {selectedFarmDigi && selectedDigi && selectedChar && (
              <View style={[styles.actionPanel, { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }, pixelStyle]}>
                <View style={styles.actionPanelHeader}>
                  <CharacterAvatar characterId={selectedDigi.characterId} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionName, { color: '#fff' }]}>{selectedChar.name}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Lv {selectedDigi.level} · Satisfação {selectedSat}%</Text>
                    <View style={styles.satBarOuter}>
                      <View style={[styles.satBarInner, { width: `${selectedSat}%` as any, backgroundColor: satBarColor }]} />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedFarmDigi(null)}>
                    <Feather name="x" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={[styles.feedBtn, { backgroundColor: totalFood > 0 ? '#f59e0b' : '#2a2a2a' }, pixelStyle]}
                    onPress={() => setFeedModalOpen(true)}
                    disabled={totalFood === 0}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 15 }}>🍎</Text>
                    <Text style={styles.feedBtnText}>{totalFood > 0 ? `Alimentar (${totalFood})` : 'Sem comida'}</Text>
                  </TouchableOpacity>
                  {selectedReq && !selectedReq.fulfilled && suggestedMap && (
                    <TouchableOpacity
                      style={[styles.battleBtn, pixelStyle]}
                      onPress={() => router.push({ pathname: '/battle', params: { mapId: suggestedMap.mapId, stageIndex: String(suggestedMap.stageIndex) } })}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 15 }}>⚔️</Text>
                      <Text style={styles.battleBtnText}>Batalhar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.removeBtn, { backgroundColor: '#2a2a2a' }, pixelStyle]}
                    onPress={() => removeFromSlot(selectedFarmDigi)}
                    activeOpacity={0.8}
                  >
                    <Feather name="log-out" size={13} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            </React.Fragment>
          )}
        </View>

          {/* Moldura azul — fundo transparente */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: viewW, height: frameH, zIndex: 10 }}>
            <Image
              source={FARM_FRAME}
              style={{ width: viewW, height: frameH }}
              resizeMode="stretch"
            />
          </View>

        </View>{/* fim do wrapper mapa+slots+moldura */}

      </View>{/* fim do grupo central */}

      {/* ── Botão flutuante notificação ────────────────────────────────────── */}
      {(dailyAvailable && allSatisfied) && (
        <TouchableOpacity
          style={[styles.notifBtn, { bottom: insets.bottom + 20 }]}
          onPress={handleClaimDailyReward}
          activeOpacity={0.85}
        >
          <Animated.Text style={[styles.notifIcon, { transform: [{ translateY: cartaBounce }] }]}>📬</Animated.Text>
          <View style={styles.notifDot} />
        </TouchableOpacity>
      )}

      {/* ── Picker modal ────────────────────────────────────────────────────── */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }, pixelStyle]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{t('farm.chooseDigi')}</Text>
            {availableDigimons.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Feather name="inbox" size={36} color={colors.mutedForeground} />
                <Text style={[{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center' }]}>{t('farm.allInFarm')}</Text>
              </View>
            ) : (
              <FlatList
                data={availableDigimons}
                keyExtractor={(c) => c.ownedId}
                contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const char = getCharacter(item.characterId) ?? CHARACTERS[item.characterId];
                  if (!char) return null;
                  return (
                    <TouchableOpacity
                      style={[styles.pickerRow, { backgroundColor: colors.background, borderColor: colors.border }, pixelStyle]}
                      onPress={() => assignToSlot(item.ownedId)}
                      activeOpacity={0.8}
                    >
                      <CharacterAvatar characterId={item.characterId} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: colors.foreground }]}>{char.name}</Text>
                        {char.rarity !== 'EGG' && <Text style={[{ fontSize: 12, color: colors.mutedForeground }]}>{t('common.lv')} {item.level}</Text>}
                      </View>
                      <Feather name="plus-circle" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Feed modal ───────────────────────────────────────────────────────── */}
      <Modal visible={feedModalOpen} transparent animationType="slide" onRequestClose={() => setFeedModalOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setFeedModalOpen(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }, pixelStyle]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {/* Cabeçalho com contexto de fome */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {selectedDigi && <CharacterAvatar characterId={selectedDigi.characterId} size={52} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerTitle, { color: colors.foreground, marginBottom: 2 }]}>
                  {selectedChar?.name ?? 'Digimon'} está com fome!
                </Text>
                <Text style={{ fontSize: 12, color: totalFood > 0 ? '#22c55e' : '#ef4444', fontWeight: '700' }}>
                  {totalFood > 0 ? `Você tem ${totalFood} comida${totalFood > 1 ? 's' : ''} disponível${totalFood > 1 ? 'is' : ''}` : 'Você não tem comida! Ganhe nas batalhas Boss.'}
                </Text>
              </View>
            </View>
            {totalFood === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={{ fontSize: 36 }}>🍽️</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>
                  Comidas são dropadas ao vencer batalhas Boss. Vá batalhar para conseguir!
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, marginTop: 8 }}
                  onPress={() => { setFeedModalOpen(false); router.push('/battle' as any); }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Ir batalhar ⚔️</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.foodGrid, { paddingBottom: 40 }]}>
                {Object.entries(FOOD_ITEMS).map(([foodId, food]) => {
                  const qty = farmFoods[foodId] ?? 0;
                  return (
                    <TouchableOpacity
                      key={foodId}
                      style={[styles.foodSlot, {
                        backgroundColor: qty > 0 ? colors.background : colors.muted + '44',
                        borderColor: qty > 0 ? '#f59e0b' : colors.border,
                        opacity: qty > 0 ? 1 : 0.4,
                      }]}
                      onPress={() => qty > 0 && handleFeed(foodId)}
                      disabled={qty === 0}
                      activeOpacity={0.8}
                    >
                      <Image source={food.image} style={{ width: 44, height: 44 }} resizeMode="contain" />
                      <Text style={{ fontSize: 11, color: colors.foreground, marginTop: 2, fontWeight: '600' }}>{food.name}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: qty > 0 ? '#f59e0b' : colors.mutedForeground }}>
                        {qty > 0 ? `×${qty}` : 'Sem'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Battle confirm modal ─────────────────────────────────────────────── */}
      <Modal visible={!!battleConfirmModal} transparent animationType="fade" onRequestClose={() => setBattleConfirmModal(null)}>
        <Pressable style={styles.rewardOverlay} onPress={() => setBattleConfirmModal(null)}>
          <Pressable style={[styles.rewardBox, { backgroundColor: colors.card, borderColor: '#7c3aed' }, pixelStyle]} onPress={(e) => e.stopPropagation()}>
            {selectedDigi && (
              <CharacterAvatar characterId={selectedDigi.characterId} size={72} />
            )}
            <Text style={{ fontSize: 32, textAlign: 'center' }}>⚔️</Text>
            <Text style={[styles.rewardTitle, { color: colors.foreground, textAlign: 'center' }]}>
              {selectedChar?.name ?? 'Digimon'} quer batalhar!
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center' }}>
              Vamos batalhar em{'\n'}
              <Text style={{ fontWeight: '900', color: '#7c3aed' }}>{battleConfirmModal?.mapName}</Text>?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.muted, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                onPress={() => setBattleConfirmModal(null)}
                activeOpacity={0.8}
              >
                <Text style={{ fontWeight: '800', color: colors.mutedForeground, fontSize: 15 }}>Agora não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 2, backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }, pixelStyle]}
                onPress={() => {
                  if (!battleConfirmModal) return;
                  setBattleConfirmModal(null);
                  router.push({ pathname: '/battle', params: { mapId: battleConfirmModal.mapId, stageIndex: String(battleConfirmModal.stageIndex) } });
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontWeight: '900', color: '#fff', fontSize: 15 }}>Vamos batalhar! ⚔️</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Reward modal ─────────────────────────────────────────────────────── */}
      <Modal visible={!!rewardModal} transparent animationType="fade" onRequestClose={() => setRewardModal(null)}>
        <Pressable style={styles.rewardOverlay} onPress={() => setRewardModal(null)}>
          <View style={[styles.rewardBox, { backgroundColor: colors.card, borderColor: '#a78bfa' }, pixelStyle]}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>🎁</Text>
            <Text style={[styles.rewardTitle, { color: colors.foreground }]}>Recompensa da Farm!</Text>
            <Text style={[styles.rewardLabel, { color: '#a78bfa' }]}>{rewardModal?.label}</Text>
            <TouchableOpacity style={[styles.rewardClose, pixelStyle]} onPress={() => setRewardModal(null)} activeOpacity={0.8}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Ótimo!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  farmCanvas: { width: FARM_CANVAS_W, height: FARM_CANVAS_H, position: 'relative' as const },
  farmBgImg: { width: FARM_CANVAS_W, height: FARM_CANVAS_H, position: 'absolute' as const, top: 0, left: 0 },
  digimonOnFarm: { position: 'absolute' as const, top: 0, left: 0 },

  cartaBtn: { position: 'absolute' as const, top: -44, left: -6, zIndex: 20, padding: 4 },
  cartaIcon: { fontSize: 30 },

  bubbleWrapper: { position: 'absolute' as const, left: -20, minWidth: 80, alignItems: 'center', zIndex: 10 },
  bubbleBox: { borderRadius: 10, padding: 5, paddingHorizontal: 8, maxWidth: 120, alignItems: 'center' },
  speechBox: { backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1.5, borderColor: '#e2e8f0' },
  thoughtBox: { backgroundColor: 'rgba(240,240,255,0.95)', borderWidth: 1.5, borderColor: '#c4b5fd', borderStyle: 'dashed' as const },
  bubbleDots: { fontSize: 9, color: '#7c3aed', marginBottom: 1 },
  bubbleText: { fontSize: 10, color: '#1e293b', fontWeight: '600', textAlign: 'center' },

  hudTop: { position: 'absolute' as const, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hudPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  hudTitle: { fontSize: 12, fontWeight: '900' as const, color: '#fff', letterSpacing: 0.5 },
  hudSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '700' },

  xpBadge: { position: 'absolute' as const, right: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#166534', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#22c55e' },
  xpBadgeMain: { fontSize: 14, fontWeight: '900' as const, color: '#fff' },
  xpBadgeSub: { fontSize: 8, color: 'rgba(255,255,255,0.8)', fontWeight: '700', letterSpacing: 0.5 },
  zoomControls: { position: 'absolute' as const, bottom: 10, right: 10, flexDirection: 'column', alignItems: 'center', gap: 2, zIndex: 20 },
  zoomBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' as const, lineHeight: 24 },
  zoomLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.4 },

  bottomPanel: { backgroundColor: '#0d0d0d', paddingTop: 12, paddingHorizontal: 10, paddingBottom: 4, gap: 10 },
  slotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  slotFilled: { width: 62, height: 62, borderRadius: 14, backgroundColor: '#1c1c1c', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  slotFilledSelected: { backgroundColor: '#2d1b69', borderWidth: 2, borderColor: '#7c3aed' },
  slotEmpty: { width: 62, height: 62, borderRadius: 14, backgroundColor: '#1c1c1c', alignItems: 'center', justifyContent: 'center' },
  slotRemove: { position: 'absolute' as const, top: -4, right: -4, width: 17, height: 17, borderRadius: 9, backgroundColor: '#444', alignItems: 'center', justifyContent: 'center', zIndex: 10 },

  notifBtn: { position: 'absolute' as const, right: 14, zIndex: 30 },
  notifIcon: { fontSize: 32 },
  notifDot: { position: 'absolute' as const, top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#0d0d0d' },

  actionPanel: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  actionPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionName: { fontSize: 14, fontWeight: '900' as const },
  satBarOuter: { height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 3, overflow: 'hidden' as const },
  satBarInner: { height: '100%', borderRadius: 3 },
  battleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  battleBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  feedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, padding: 10 },
  feedBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 10, paddingHorizontal: 14 },

  foodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodSlot: { width: 80, alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 8, gap: 2 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 16, fontWeight: '900' as const, marginBottom: 16 },
  pickerEmpty: { alignItems: 'center', padding: 40, gap: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 10 },

  rewardOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  rewardBox: { width: '100%', borderRadius: 20, borderWidth: 2, padding: 28, alignItems: 'center', gap: 12 },
  rewardTitle: { fontSize: 18, fontWeight: '900' as const },

  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  tabBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#1c1c1c', alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#2d1b69', borderWidth: 1.5, borderColor: '#7c3aed' },
  tabBtnText: { fontSize: 12, fontWeight: '700' as const, color: 'rgba(255,255,255,0.4)' },
  tabBtnTextActive: { color: '#fff' },

  placingOverlay: { backgroundColor: 'rgba(0,0,0,0.75)', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  placingHint: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  placingBtn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 26, alignItems: 'center' },
  placingBtnText: { color: '#fff', fontWeight: '900' as const, fontSize: 14 },

  decoInventoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#1c1c1c' },
  decoInventoryName: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
  decoInventorySub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  decoPlaceBtn: { backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  decoPlaceBtnText: { color: '#fff', fontWeight: '800' as const, fontSize: 12 },

  decoActionBubble: { position: 'absolute' as const, bottom: '100%', left: '50%', transform: [{ translateX: -65 }], flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 10, padding: 6, zIndex: 30 },
  decoActionBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  decoActionBtnText: { color: '#fff', fontWeight: '800' as const, fontSize: 12 },
  rewardLabel: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  rewardClose: { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
});
