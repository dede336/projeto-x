import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Dimensions, Animated, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useGame } from '@/context/GameContext';
import { GAME_MAPS } from '@/constants/gameData';
import { getCharacter } from '@/constants/extendedCharacters';

const IMG_WATER = require('@/assets/images/tiles/water_tile.webp');
const IMG_GRASS = require('@/assets/images/tiles/grass_texture.webp');
const MAP_FRAME = require('@/assets/images/farm_frame_transparent.webp');

const MATT_SPRITES: Record<string, any[]> = {
  down: [
    require('@/assets/tamers/matt_walk_down_0.webp'),
    require('@/assets/tamers/matt_walk_down_1.webp'),
    require('@/assets/tamers/matt_walk_down_2.webp'),
  ],
  up: [
    require('@/assets/tamers/matt_walk_up_0.webp'),
    require('@/assets/tamers/matt_walk_up_1.webp'),
    require('@/assets/tamers/matt_walk_up_2.webp'),
  ],
  left: [
    require('@/assets/tamers/matt_walk_left_0.webp'),
    require('@/assets/tamers/matt_walk_left_1.webp'),
    require('@/assets/tamers/matt_walk_left_2.webp'),
  ],
  right: [
    require('@/assets/tamers/matt_walk_right_0.webp'),
    require('@/assets/tamers/matt_walk_right_1.webp'),
    require('@/assets/tamers/matt_walk_right_2.webp'),
  ],
};

// GBA Pokémon-style walk cycle: neutral → left → neutral → right
const WALK_CYCLE = [0, 1, 0, 2] as const;

const PORTAL_FRAMES = [
  require('@/assets/images/portals/portal_frame_0.webp'),
  require('@/assets/images/portals/portal_frame_1.webp'),
  require('@/assets/images/portals/portal_frame_2.webp'),
  require('@/assets/images/portals/portal_frame_3.webp'),
  require('@/assets/images/portals/portal_frame_4.webp'),
  require('@/assets/images/portals/portal_frame_5.webp'),
  require('@/assets/images/portals/portal_frame_6.webp'),
  require('@/assets/images/portals/portal_frame_7.webp'),
  require('@/assets/images/portals/portal_frame_8.webp'),
];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAP_VIEW_W = Math.min(SCREEN_W - 24, 396);
const TILE = 32;
const MAP_W = 20;
const MAP_H = 30;
const MOVE_MS = 90;
const PX = 3;
const MIN_CAM_X = MAP_VIEW_W - MAP_W * TILE;
const MIN_CAM_Y = MAP_VIEW_W - MAP_H * TILE;

const G = 0;
const H = 1;
const T = 2;
const W = 3;
const R = 4;
const P = 5;
const F = 6;
const P1 = 7;
const P2 = 8;
const P3 = 9;
const PB = 10;
const D = 11;
const B = 12;

const MAP_TILES: number[][] = [
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  [T,T,T,R,R,R,R,T,T,T,T,T,R,R,R,R,T,T,T,T],
  [T,T,R,R,D,D,R,T,T,T,T,R,D,D,R,R,T,T,T,T],
  [T,R,R,D,D,D,D,R,P,PB,P,D,D,D,R,R,T,T,T,T],
  [T,R,D,D,D,D,D,P,P,P,P,D,D,D,D,R,T,T,T,T],
  [T,T,R,R,D,D,P,P,P,P,P,P,D,D,R,T,T,T,T,T],
  [T,T,T,R,R,P,P,P,T,T,P,P,R,R,T,T,T,T,T,T],
  [T,T,T,T,P,P,T,T,T,T,T,T,P,P,T,T,T,T,T,T],
  [T,T,T,P,P,T,T,G,G,G,G,T,T,P,P,T,T,T,T,T],
  [T,T,P,P,T,G,G,G,G,G,G,G,G,T,P,P,T,T,T,T],
  [T,T,P,T,G,G,H,H,G,P3,G,H,H,G,G,T,P,T,T,T],
  [T,P,P,G,G,H,H,H,G,G,G,H,H,H,G,G,P,P,T,T],
  [T,P,G,G,H,H,G,G,G,G,G,G,G,H,H,G,G,P,T,T],
  [T,P,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,P,T,T],
  [T,T,P,P,G,G,G,G,G,G,G,G,G,G,P,P,T,T,T,T],
  [T,T,T,P,P,G,G,G,G,G,G,G,G,P,P,T,T,T,T,T],
  [T,T,T,T,P,P,T,T,T,T,T,T,P,P,T,T,T,T,T,T],
  [T,T,T,T,P,P,W,W,W,B,B,W,W,P,P,T,T,T,T,T],
  [T,T,T,G,G,P,P,W,W,P,P,W,P,P,G,G,T,T,T,T],
  [T,T,G,G,P,P,G,G,P,P,P,G,G,P,P,G,G,T,T,T],
  [T,G,G,H,P,P,H,H,P,P,P,H,H,P,P,H,G,G,T,T],
  [G,G,H,H,P1,P,H,H,P,P,P,H,H,P,P2,H,H,G,G,T],
  [G,H,H,H,G,G,H,H,P,P,P,H,H,G,G,H,H,H,G,T],
  [G,G,H,G,G,G,G,G,P,P,P,G,G,G,G,G,H,G,G,T],
  [G,G,G,G,G,G,G,G,P,P,P,G,G,G,G,G,G,G,G,T],
  [G,G,G,G,G,G,F,F,P,P,P,F,F,G,G,G,G,G,G,T],
  [G,G,F,F,G,G,G,P,P,P,P,P,G,G,G,F,F,G,G,T],
  [G,G,G,G,G,P,P,P,P,P,P,P,P,P,G,G,G,G,G,T],
  [P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,T],
  [P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,T],
];

const PLAYER_START = { x: 9, y: 29 };

function isWalkable(tile: number) { return tile !== T && tile !== W && tile !== R; }
function isPortal(tile: number) { return tile === P1 || tile === P2 || tile === P3 || tile === PB; }
function isTallGrass(tile: number) { return tile === H || tile === D; }

const PORTAL_POSITIONS: { row: number; col: number; tile: number }[] = [];
const TREE_POSITIONS:   { row: number; col: number }[] = [];
const ROCK_POSITIONS:   { row: number; col: number }[] = [];
MAP_TILES.forEach((row, rowIdx) => {
  row.forEach((tile, colIdx) => {
    if (isPortal(tile)) PORTAL_POSITIONS.push({ row: rowIdx, col: colIdx, tile });
    if (tile === T && (rowIdx + colIdx) % 2 === 0) TREE_POSITIONS.push({ row: rowIdx, col: colIdx });
    if (tile === R) ROCK_POSITIONS.push({ row: rowIdx, col: colIdx });
  });
});

const TREE_SIZE   = TILE * 2.2;
const TREE_OFFSET = (TREE_SIZE - TILE) / 2;
const ROCK_SIZE   = TILE * 1.4;
const ROCK_OFFSET = (ROCK_SIZE - TILE) / 2;

const TILE_COLORS: Record<number, string> = {
  [G]: '#4a9e4a',
  [H]: '#357535',
  [T]: '#4a9e4a',
  [W]: '#4a9bb0',
  [R]: '#4a9e4a',
  [P]: '#c07a3a',
  [F]: '#4db34d',
  [P1]: '#c07a3a',
  [P2]: '#c07a3a',
  [P3]: '#4a9e4a',
  [PB]: '#357535',
  [D]: '#1e3a1e',
  [B]: '#8a6a3a',
};

const TAMER_COLORS: Record<string, { body: string; hair: string; skin: string }> = {
  tamer_tai:  { body: '#c0392b', hair: '#2c1a0e', skin: '#f0c070' },
  tamer_matt: { body: '#2563eb', hair: '#d4c07a', skin: '#f0c070' },
  tamer_tk:   { body: '#ca8a04', hair: '#2c1a0e', skin: '#f0c070' },
  tamer_kari: { body: '#db2777', hair: '#2c1a0e', skin: '#f0c070' },
  tamer_sora: { body: '#ea580c', hair: '#7a1e1e', skin: '#f0c070' },
  tamer_mimi: { body: '#16a34a', hair: '#7a1e1e', skin: '#f0c070' },
};
const DEFAULT_TAMER_COLOR = { body: '#6366f1', hair: '#2c1a0e', skin: '#f0c070' };

// 7 wide × 12 tall. Keys: n=none h=hair s=skin e=eye m=mouth b=body l=leg k=shoe
// 3 frames per direction: 0=neutral 1=left-step 2=right-step
const HEAD_DOWN = [
  ['n','h','h','h','h','h','n'],
  ['h','h','h','h','h','h','h'],
  ['h','s','s','s','s','s','h'],
  ['h','s','e','s','e','s','h'],
  ['h','s','s','m','s','s','h'],
  ['n','b','b','b','b','b','n'],
  ['n','b','b','b','b','b','n'],
  ['n','b','b','b','b','b','n'],
];
const HEAD_UP = [
  ['n','h','h','h','h','h','n'],
  ['h','h','h','h','h','h','h'],
  ['h','h','h','h','h','h','h'],
  ['h','h','h','h','h','h','h'],
  ['h','h','h','h','h','h','h'],
  ['n','b','b','b','b','b','n'],
  ['n','b','b','b','b','b','n'],
  ['n','b','b','b','b','b','n'],
];
const HEAD_LEFT = [
  ['n','h','h','h','h','n','n'],
  ['h','h','h','h','h','h','n'],
  ['h','s','s','s','s','h','n'],
  ['h','s','e','s','s','h','n'],
  ['h','s','s','s','s','h','n'],
  ['n','b','b','b','b','n','n'],
  ['n','b','b','b','b','n','n'],
  ['n','b','b','b','b','n','n'],
];
const HEAD_RIGHT = [
  ['n','n','h','h','h','h','n'],
  ['n','h','h','h','h','h','h'],
  ['n','h','s','s','s','s','h'],
  ['n','h','s','s','e','s','h'],
  ['n','h','s','s','s','s','h'],
  ['n','n','b','b','b','b','n'],
  ['n','n','b','b','b','b','n'],
  ['n','n','b','b','b','b','n'],
];

const LEGS: Record<string, string[][]> = {
  neutral: [
    ['n','l','l','n','l','l','n'],
    ['n','l','l','n','l','l','n'],
    ['n','k','k','n','k','k','n'],
    ['n','n','n','n','n','n','n'],
  ],
  leftStep: [
    ['l','l','n','n','n','l','n'],
    ['l','l','n','n','n','l','n'],
    ['k','k','n','n','n','n','k'],
    ['n','n','n','n','n','n','n'],
  ],
  rightStep: [
    ['n','l','n','n','l','l','n'],
    ['n','l','n','n','l','l','n'],
    ['k','n','n','n','k','k','n'],
    ['n','n','n','n','n','n','n'],
  ],
  leftStepSide: [
    ['l','l','l','n','n','n','n'],
    ['l','l','l','n','n','n','n'],
    ['k','k','k','n','n','n','n'],
    ['n','n','n','n','n','n','n'],
  ],
  rightStepSide: [
    ['n','n','l','l','n','n','n'],
    ['n','n','l','l','n','n','n'],
    ['n','n','k','k','n','n','n'],
    ['n','n','n','n','n','n','n'],
  ],
};

function buildSprite(head: string[][], legs: string[][]): string[][] {
  return [...head, ...legs];
}

const SPRITES: Record<string, string[][][]> = {
  down: [
    buildSprite(HEAD_DOWN, LEGS.neutral),
    buildSprite(HEAD_DOWN, LEGS.leftStep),
    buildSprite(HEAD_DOWN, LEGS.rightStep),
  ],
  up: [
    buildSprite(HEAD_UP, LEGS.neutral),
    buildSprite(HEAD_UP, LEGS.leftStep),
    buildSprite(HEAD_UP, LEGS.rightStep),
  ],
  left: [
    buildSprite(HEAD_LEFT, LEGS.neutral),
    buildSprite(HEAD_LEFT, LEGS.leftStepSide),
    buildSprite(HEAD_LEFT, LEGS.rightStepSide),
  ],
  right: [
    buildSprite(HEAD_RIGHT, LEGS.neutral),
    buildSprite(HEAD_RIGHT, LEGS.rightStepSide),
    buildSprite(HEAD_RIGHT, LEGS.leftStepSide),
  ],
};

function TamerSprite({ tamerId, dirName, frame }: { tamerId: string; dirName: string; frame: number }) {
  if (tamerId === 'tamer_matt') {
    const frames = MATT_SPRITES[dirName] ?? MATT_SPRITES.down;
    const src = frames[frame] ?? frames[0];
    return (
      <Image
        source={src}
        style={{ width: 7 * PX, height: 12 * PX }}
        resizeMode="contain"
      />
    );
  }

  const tc = TAMER_COLORS[tamerId] || DEFAULT_TAMER_COLOR;
  const rows = SPRITES[dirName]?.[frame] ?? SPRITES.down[0];
  const colorMap: Record<string, string | null> = {
    n: null,
    h: tc.hair,
    s: tc.skin,
    e: '#1a1010',
    m: '#c0605a',
    b: tc.body,
    l: '#1e2a3a',
    k: '#0d0d0d',
  };
  return (
    <View style={{ width: 7 * PX, height: 12 * PX }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((cell, ci) => {
            const color = colorMap[cell] ?? null;
            return (
              <View key={ci} style={{ width: PX, height: PX, backgroundColor: color ?? 'transparent' }} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const PORTAL_SIZE = TILE * 1.7;
const PORTAL_OFFSET = (PORTAL_SIZE - TILE) / 2;

function AnimatedPortal({ isBoss, mirror }: { isBoss?: boolean; mirror?: boolean }) {
  const frameRef = useRef(0);
  const opacities = useRef(
    PORTAL_FRAMES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  useEffect(() => {
    const id = setInterval(() => {
      opacities[frameRef.current].setValue(0);
      frameRef.current = (frameRef.current + 1) % PORTAL_FRAMES.length;
      opacities[frameRef.current].setValue(1);
    }, 110);
    return () => clearInterval(id);
  }, []);

  const webFilter = Platform.OS === 'web' && isBoss
    ? { filter: 'hue-rotate(150deg) saturate(1.4) brightness(1.1)' } as any
    : {};
  const baseStyle: any = {
    position: 'absolute', width: '100%', height: '100%',
    ...(mirror ? { transform: [{ scaleX: -1 }] } : {}),
    ...webFilter,
  };

  return (
    <View style={{ width: '100%', height: '100%' }}>
      {PORTAL_FRAMES.map((src, i) => (
        <Animated.Image
          key={i}
          source={src}
          style={[baseStyle, { opacity: opacities[i] }]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

const GRASS_TEX = 512;

function GrassTile({ col, row }: { col: number; row: number }) {
  const ox = -(col * TILE) % GRASS_TEX;
  const oy = -(row * TILE) % GRASS_TEX;
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Image source={IMG_GRASS} style={{ position: 'absolute', width: GRASS_TEX, height: GRASS_TEX, top: oy, left: ox }} resizeMode="cover" />
    </View>
  );
}

function TreeSprite({ seed }: { seed: number }) {
  const v = seed % 3;
  const base   = ['#2a7a1e', '#1e7a2a', '#287020'][v];
  const mid    = ['#38a028', '#28a038', '#349620'][v];
  const bright = ['#4ec440', '#3cc454', '#48b832'][v];
  const top    = ['#68d858', '#56d86a', '#60cc48'][v];
  return (
    <View style={{ width: '100%', height: '100%' }}>
      <View style={{ position: 'absolute', bottom: '8%', left: '30%', width: '40%', height: '20%', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 999 }} />
      <View style={{ position: 'absolute', bottom: '10%', left: '40%', width: '20%', height: '26%', backgroundColor: '#6b3b0f', borderRadius: 2 }} />
      <View style={{ position: 'absolute', top: '4%', left: '8%', width: '84%', height: '74%', backgroundColor: base, borderRadius: 999 }} />
      <View style={{ position: 'absolute', top: '6%', left: '10%', width: '78%', height: '68%', backgroundColor: mid, borderRadius: 999 }} />
      <View style={{ position: 'absolute', top: '10%', left: '18%', width: '62%', height: '52%', backgroundColor: bright, borderRadius: 999 }} />
      <View style={{ position: 'absolute', top: '14%', left: '24%', width: '38%', height: '30%', backgroundColor: top, borderRadius: 999, opacity: 0.75 }} />
    </View>
  );
}

function RockSprite() {
  return (
    <View style={{ width: '100%', height: '100%' }}>
      <View style={{ position: 'absolute', bottom: '8%', left: '15%', width: '70%', height: '18%', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 999 }} />
      <View style={{ position: 'absolute', bottom: '18%', left: '22%', width: '50%', height: '46%', backgroundColor: '#7a7a6e', borderRadius: 8 }}>
        <View style={{ position: 'absolute', top: 3, left: 4, width: '45%', height: '35%', backgroundColor: '#ababA0', borderRadius: 4, opacity: 0.8 }} />
        <View style={{ position: 'absolute', top: 4, left: 3, width: '20%', height: '20%', backgroundColor: '#c0c0b8', borderRadius: 3, opacity: 0.5 }} />
      </View>
      <View style={{ position: 'absolute', bottom: '24%', right: '14%', width: '28%', height: '34%', backgroundColor: '#6e6e64', borderRadius: 6 }}>
        <View style={{ position: 'absolute', top: 2, left: 2, width: '40%', height: '30%', backgroundColor: '#9a9a90', borderRadius: 3, opacity: 0.7 }} />
      </View>
      <View style={{ position: 'absolute', bottom: '20%', left: '12%', width: '20%', height: '24%', backgroundColor: '#727268', borderRadius: 5 }} />
    </View>
  );
}

const BLADE_CONFIGS = [
  { left: 3,  top: 3,  height: 13, delay: 0 },
  { left: 9,  top: 5,  height: 12, delay: 160 },
  { left: 16, top: 2,  height: 14, delay: 80 },
  { left: 22, top: 6,  height: 11, delay: 240 },
  { left: 7,  top: 10, height: 10, delay: 300 },
  { left: 26, top: 4,  height: 12, delay: 130 },
];

function TallGrassBlade({ left, top, height, delay, dark }: { left: number; top: number; height: number; delay: number; dark: boolean }) {
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 600 + delay * 0.4, useNativeDriver: false, delay }),
        Animated.timing(sway, { toValue: -1, duration: 600 + delay * 0.4, useNativeDriver: false }),
        Animated.timing(sway, { toValue: 0, duration: 350, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const tx = sway.interpolate({ inputRange: [-1, 0, 1], outputRange: [-3, 0, 3] });
  const bladeColor = dark ? '#3a7a3a' : '#5ec45e';
  const tipColor   = dark ? '#2a5a2a' : '#3da03d';
  return (
    <Animated.View style={{
      position: 'absolute', left, top, width: 3, height,
      backgroundColor: bladeColor,
      borderTopWidth: 2, borderTopColor: tipColor,
      borderRadius: 2,
      transform: [{ translateX: tx }],
    }} />
  );
}

function TallGrassTile({ col, row, dark }: { col: number; row: number; dark?: boolean }) {
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <GrassTile col={col} row={row} />
      {dark && <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)' }} />}
      {BLADE_CONFIGS.map((cfg, i) => (
        <TallGrassBlade key={i} left={cfg.left} top={cfg.top} height={cfg.height} delay={cfg.delay} dark={!!dark} />
      ))}
    </View>
  );
}

function WaterTile({ col, row }: { col: number; row: number }) {
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(wave, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Image
        source={IMG_WATER}
        style={{ position: 'absolute', width: MAP_W * TILE, height: MAP_H * TILE, top: -(row * TILE), left: -(col * TILE) }}
        resizeMode="cover"
      />
      <Animated.View style={{
        position: 'absolute', top: 6,
        left: wave.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }),
        right: 0, height: 2, backgroundColor: '#ffffff', opacity: 0.18, borderRadius: 2,
      }} />
      <Animated.View style={{
        position: 'absolute', top: 18,
        left: wave.interpolate({ inputRange: [0, 1], outputRange: [6, -6] }),
        right: 0, height: 2, backgroundColor: '#ffffff', opacity: 0.12, borderRadius: 2,
      }} />
    </View>
  );
}

function FlowerTile({ col, row }: { col: number; row: number }) {
  const flowers = [
    { top: 4,  left: 4,  size: 5, color: '#f9e034' },
    { top: 17, left: 19, size: 4, color: '#f472b6' },
    { top: 8,  left: 22, size: 4, color: '#fff176' },
    { top: 21, left: 7,  size: 3, color: '#fb7185' },
    { top: 13, left: 12, size: 4, color: '#a78bfa' },
  ];
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <GrassTile col={col} row={row} />
      {flowers.map((f, i) => (
        <View key={i} style={{ position: 'absolute', top: f.top, left: f.left, width: f.size, height: f.size, borderRadius: f.size, backgroundColor: f.color }} />
      ))}
    </View>
  );
}

interface Props {
  visible: boolean;
  mapId: string;
  onClose: () => void;
}

export default function WorldMapScreen({ visible, mapId, onClose }: Props) {
  const { tamerId, isStageCleared, isMapUnlocked, customGameMaps } = useGame();
  const gameMap = GAME_MAPS.find(m => m.id === mapId) ?? customGameMaps.find(m => m.id === mapId);

  const activeTiles = useMemo(() => {
    const tg = gameMap?.tileGrid;
    if (tg && Array.isArray(tg) && tg.length === MAP_H && (tg[0] as unknown[])?.length === MAP_W) {
      return tg as number[][];
    }
    return MAP_TILES;
  }, [gameMap?.tileGrid]);

  const activeTilesRef = useRef<number[][]>(activeTiles);
  activeTilesRef.current = activeTiles;

  const activePortalPositions = useMemo(() => {
    const result: { row: number; col: number; tile: number }[] = [];
    activeTiles.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        if (isPortal(tile)) result.push({ row: rowIdx, col: colIdx, tile });
      });
    });
    return result;
  }, [activeTiles]);

  const activeTreePositions = useMemo(() => {
    const result: { row: number; col: number }[] = [];
    activeTiles.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        if (tile === T && (rowIdx + colIdx) % 2 === 0) result.push({ row: rowIdx, col: colIdx });
      });
    });
    return result;
  }, [activeTiles]);

  const activeRockPositions = useMemo(() => {
    const result: { row: number; col: number }[] = [];
    activeTiles.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        if (tile === R) result.push({ row: rowIdx, col: colIdx });
      });
    });
    return result;
  }, [activeTiles]);

  const [tilePos, setTilePos] = useState(PLAYER_START);
  const [playerDir, setPlayerDir] = useState(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const [encounter, setEncounter] = useState<null | { stageIdx: number }>(null);
  const [portalFlash, setPortalFlash] = useState<null | { stageIdx: number; stageName: string }>(null);

  const animPX = useRef(new Animated.Value(PLAYER_START.x * TILE)).current;
  const animPY = useRef(new Animated.Value(PLAYER_START.y * TILE)).current;

  const rawCamX = useMemo(() => Animated.subtract(MAP_VIEW_W / 2 - TILE / 2, animPX), []);
  const rawCamY = useMemo(() => Animated.subtract(MAP_VIEW_W / 2 - TILE / 2, animPY), []);
  const camX = useMemo(() => rawCamX.interpolate({ inputRange: [MIN_CAM_X, 0], outputRange: [MIN_CAM_X, 0], extrapolate: 'clamp' }), [rawCamX]);
  const camY = useMemo(() => rawCamY.interpolate({ inputRange: [MIN_CAM_Y, 0], outputRange: [MIN_CAM_Y, 0], extrapolate: 'clamp' }), [rawCamY]);

  const moveLocked = useRef(false);
  const walkFrameRef = useRef(0);
  const walkTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkTickIdxRef = useRef(0);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const dirNames = ['down', 'up', 'left', 'right'];

  useEffect(() => {
    if (visible) {
      setTilePos(PLAYER_START);
      setPlayerDir(0);
      setWalkFrame(0);
      walkFrameRef.current = 0;
      if (walkTickRef.current) { clearInterval(walkTickRef.current); walkTickRef.current = null; }
      walkTickIdxRef.current = 0;
      setEncounter(null);
      setPortalFlash(null);
      moveLocked.current = false;
      animPX.setValue(PLAYER_START.x * TILE);
      animPY.setValue(PLAYER_START.y * TILE);
    }
  }, [visible, mapId]);

  const move = useCallback((dx: number, dy: number) => {
    if (moveLocked.current) return;
    const dirMap: Record<string, number> = { '0,-1': 1, '0,1': 0, '-1,0': 2, '1,0': 3 };
    const dir = dirMap[`${dx},${dy}`] ?? 0;
    setPlayerDir(dir);

    setTilePos(prev => {
      const nx = prev.x + dx;
      const ny = prev.y + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return prev;
      const tile = activeTilesRef.current[ny][nx];
      if (!isWalkable(tile)) return prev;

      moveLocked.current = true;

      // GBA-style walk cycle: start sub-frame ticker if not already running
      if (!walkTickRef.current) {
        walkTickIdxRef.current = 1; // start at frame 1 (left foot)
        const f0 = WALK_CYCLE[1];
        walkFrameRef.current = f0;
        setWalkFrame(f0);
        walkTickRef.current = setInterval(() => {
          walkTickIdxRef.current = (walkTickIdxRef.current + 1) % 4;
          const f = WALK_CYCLE[walkTickIdxRef.current];
          walkFrameRef.current = f;
          setWalkFrame(f);
        }, Math.floor(MOVE_MS / 4));
      }

      // Animate player pixel position
      Animated.parallel([
        Animated.timing(animPX, { toValue: nx * TILE, duration: MOVE_MS, useNativeDriver: false }),
        Animated.timing(animPY, { toValue: ny * TILE, duration: MOVE_MS, useNativeDriver: false }),
      ]).start(() => {
        moveLocked.current = false;
        // Stop walk animation only when no longer holding a direction
        if (!holdInterval.current) {
          if (walkTickRef.current) { clearInterval(walkTickRef.current); walkTickRef.current = null; }
          walkTickIdxRef.current = 0;
          setWalkFrame(0);
          walkFrameRef.current = 0;
        }

        if (isPortal(tile)) {
          let stageIdx = tile === P1 ? 0 : tile === P2 ? 1 : tile === P3 ? 2 : 3;
          const stage = gameMap?.stages?.[stageIdx];
          setPortalFlash({ stageIdx, stageName: stage?.name ?? `Fase ${stageIdx + 1}` });
        } else if (isTallGrass(tile)) {
          if (Math.random() < 0.30) {
            let stageIdx = 0;
            if (tile === D) stageIdx = 3;
            else if (ny <= 14) stageIdx = 2;
            else if (nx < 10) stageIdx = 0;
            else stageIdx = 1;
            setEncounter({ stageIdx });
          }
        }
      });

      return { x: nx, y: ny };
    });
  }, [gameMap, animPX, animPY]);

  const startHold = useCallback((dx: number, dy: number) => {
    move(dx, dy);
    holdInterval.current = setInterval(() => {
      move(dx, dy);
    }, MOVE_MS - 10);
  }, [move]);

  const stopHold = useCallback(() => {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdInterval.current) clearInterval(holdInterval.current);
      if (walkTickRef.current) clearInterval(walkTickRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (typeof window === 'undefined') return;
    const keys: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const dir = keys[e.key];
      if (!dir) return;
      e.preventDefault();
      if (holdInterval.current) return;
      startHold(dir[0], dir[1]);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (keys[e.key]) stopHold();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopHold();
    };
  }, [visible, startHold, stopHold]);

  function enterBattle(stageIdx: number) {
    setEncounter(null);
    setPortalFlash(null);
    onClose();
    setTimeout(() => {
      router.push(`/battle?mapId=${mapId}&stageIndex=${stageIdx}`);
    }, 300);
  }

  const stagePortalInfo = [
    { label: 'F1', color: '#00bcd4' },
    { label: 'F2', color: '#9c27b0' },
    { label: 'F3', color: '#ff9800' },
    { label: 'BOSS', color: '#c62828' },
  ];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>

        {/* Top bar — fora da moldura */}
        <View style={styles.topBar}>
          {gameMap && (
            <View style={{ flex: 1 }}>
              <Text style={styles.mapNameText}>{gameMap.name}</Text>
              <Text style={styles.mapHint}>Grama alta → batalha  •  Portais → fases</Text>
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Área do mapa + moldura — quadrado igual ao Digifarm */}
        <View style={{ position: 'relative', width: MAP_VIEW_W, height: MAP_VIEW_W }}>

          {/* Viewport do mapa — clipa o conteúdo */}
          <View style={{ width: MAP_VIEW_W, height: MAP_VIEW_W, overflow: 'hidden' }}>

        {/* Map layer */}
        <Animated.View style={[styles.mapContainer, { transform: [{ translateX: camX }, { translateY: camY }] }]}>
          {activeTiles.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', overflow: 'visible' }}>
              {row.map((tile, colIdx) => {
                const bgColor = TILE_COLORS[tile] ?? '#3d8c3d';
                return (
                  <View key={colIdx} style={{ width: TILE, height: TILE, backgroundColor: bgColor, overflow: 'visible' }}>
                    {(tile === G || tile === T || tile === R) && <GrassTile col={colIdx} row={rowIdx} />}
                    {tile === H && <TallGrassTile col={colIdx} row={rowIdx} />}
                    {tile === D && <TallGrassTile col={colIdx} row={rowIdx} dark />}
                    {tile === W && <WaterTile col={colIdx} row={rowIdx} />}
                    {tile === F && <FlowerTile col={colIdx} row={rowIdx} />}
                    {tile === P && (
                      <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                        <View style={{ position: 'absolute', inset: 0, backgroundColor: '#c07a3a' }} />
                        <View style={{ position: 'absolute', top: 5,  left: 2,  right: 9,  height: 1, backgroundColor: '#8a5020', opacity: 0.4 }} />
                        <View style={{ position: 'absolute', top: 13, left: 7,  right: 3,  height: 1, backgroundColor: '#8a5020', opacity: 0.3 }} />
                        <View style={{ position: 'absolute', top: 22, left: 2,  right: 12, height: 1, backgroundColor: '#8a5020', opacity: 0.35 }} />
                        <View style={{ position: 'absolute', top: 9,  left: 17, width: 3, height: 3, backgroundColor: '#7a4418', borderRadius: 2, opacity: 0.45 }} />
                        <View style={{ position: 'absolute', top: 20, left: 7,  width: 2, height: 2, backgroundColor: '#6a3810', borderRadius: 1, opacity: 0.4 }} />
                        <View style={{ position: 'absolute', top: 16, left: 24, width: 3, height: 2, backgroundColor: '#7a4418', borderRadius: 1, opacity: 0.35 }} />
                      </View>
                    )}
                    {tile === B && (
                      <View style={{ position: 'absolute', inset: 0 }}>
                        <View style={{ position: 'absolute', top: 6,  left: 0, right: 0, height: 6,  backgroundColor: '#a0784a', borderTopWidth: 1,    borderColor: '#7a5030' }} />
                        <View style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 6,  backgroundColor: '#956e40', borderTopWidth: 1,    borderColor: '#6a4428' }} />
                        <View style={{ position: 'absolute', top: 22, left: 0, right: 0, height: 6,  backgroundColor: '#a0784a', borderBottomWidth: 1, borderColor: '#7a5030' }} />
                        <View style={{ position: 'absolute', top: 10, left: 0, right: 0, height: 1,  backgroundColor: '#c4a472', opacity: 0.5 }} />
                        <View style={{ position: 'absolute', top: 18, left: 0, right: 0, height: 1,  backgroundColor: '#c4a472', opacity: 0.4 }} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Rock overlay */}
          {activeRockPositions.map(({ row, col }) => (
            <View key={`rock-${row}-${col}`} style={{ position: 'absolute', top: row * TILE - ROCK_OFFSET, left: col * TILE - ROCK_OFFSET, width: ROCK_SIZE, height: ROCK_SIZE, zIndex: 12 }} pointerEvents="none">
              <RockSprite />
            </View>
          ))}

          {/* Tree overlay */}
          {activeTreePositions.map(({ row, col }) => (
            <View key={`tree-${row}-${col}`} style={{ position: 'absolute', top: row * TILE - TREE_OFFSET, left: col * TILE - TREE_OFFSET, width: TREE_SIZE, height: TREE_SIZE, zIndex: 14 }} pointerEvents="none">
              <TreeSprite seed={row + col} />
            </View>
          ))}

          {/* Portal overlay — rendered above all tiles to avoid clipping */}
          {activePortalPositions.map(({ row, col, tile }) => (
            <View
              key={`portal-${row}-${col}`}
              style={{
                position: 'absolute',
                top: row * TILE - PORTAL_OFFSET,
                left: col * TILE - PORTAL_OFFSET,
                width: PORTAL_SIZE,
                height: PORTAL_SIZE,
                zIndex: 20,
              }}
              pointerEvents="none"
            >
              <AnimatedPortal isBoss={tile === PB} mirror={tile === P2} />
            </View>
          ))}
        </Animated.View>

            {/* Character — centrado no viewport quadrado */}
            <View style={styles.playerOverlay} pointerEvents="none">
              <View style={styles.playerShadow} />
              <TamerSprite
                tamerId={tamerId ?? 'tamer_tai'}
                dirName={dirNames[playerDir]}
                frame={walkFrame}
              />
            </View>

          </View>{/* fim viewport clipping */}

          {/* Moldura sobre a área do mapa */}
          <Image
            source={MAP_FRAME}
            style={{ position: 'absolute', top: 0, left: 0, width: MAP_VIEW_W, height: MAP_VIEW_W, zIndex: 10 }}
            resizeMode="stretch"
            pointerEvents="none"
          />

        </View>{/* fim wrapper mapa+moldura */}

        {/* Legenda — abaixo da moldura */}
        <View style={styles.legendRow}>
          {stagePortalInfo.map(l => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>

        {/* D-Pad — abaixo da moldura */}
        <View style={styles.dpad}>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startHold(0, -1)}
              onPressOut={stopHold}
            >
              <Text style={styles.dpadArrow}>▲</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startHold(-1, 0)}
              onPressOut={stopHold}
            >
              <Text style={styles.dpadArrow}>◄</Text>
            </TouchableOpacity>
            <View style={styles.dpadCenter} />
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startHold(1, 0)}
              onPressOut={stopHold}
            >
              <Text style={styles.dpadArrow}>►</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startHold(0, 1)}
              onPressOut={stopHold}
            >
              <Text style={styles.dpadArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Encounter modal — overlay full screen */}
        {encounter && (
          <View style={styles.overlay}>
            <View style={styles.encounterBox}>
              <Text style={styles.encounterTitle}>⚡ Encontro Selvagem!</Text>
              {gameMap && encounter.stageIdx < gameMap.stages.length && (() => {
                const stage = gameMap.stages[encounter.stageIdx];
                const ids = (stage as any).enemyCharacterIds ?? [stage.enemyCharacterId];
                const enemy = ids[Math.floor(Math.random() * ids.length)];
                return (
                  <Text style={styles.encounterEnemy}>{(getCharacter(enemy)?.name ?? enemy ?? 'DESCONHECIDO').toUpperCase()}</Text>
                );
              })()}
              <Text style={styles.encounterSub}>apareceu na grama!</Text>
              <View style={styles.encounterBtns}>
                <TouchableOpacity style={styles.encounterFlee} onPress={() => setEncounter(null)}>
                  <Text style={styles.encounterFleeText}>FUGIR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.encounterFight} onPress={() => enterBattle(encounter.stageIdx)}>
                  <Text style={styles.encounterFightText}>BATALHAR!</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Portal modal — overlay full screen */}
        {portalFlash && (
          <View style={styles.overlay}>
            <View style={styles.portalBox}>
              <Text style={styles.portalIcon}>{portalFlash.stageIdx === 3 ? '💀' : '🌀'}</Text>
              <Text style={styles.portalTitle}>Portal Detectado</Text>
              <Text style={styles.portalName}>{portalFlash.stageName}</Text>
              <View style={styles.encounterBtns}>
                <TouchableOpacity style={styles.encounterFlee} onPress={() => setPortalFlash(null)}>
                  <Text style={styles.encounterFleeText}>VOLTAR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.encounterFight, portalFlash.stageIdx === 3 && { backgroundColor: '#b71c1c' }]}
                  onPress={() => enterBattle(portalFlash.stageIdx)}
                >
                  <Text style={styles.encounterFightText}>ENTRAR!</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const SPRITE_DISPLAY_W = 7 * PX;
const SPRITE_DISPLAY_H = 12 * PX;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a1a0a',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
  },
  mapContainer: { position: 'absolute' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: MAP_VIEW_W,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#ffffff22',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  mapNameText: { color: '#ffe082', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  mapHint: { color: '#ffffffaa', fontSize: 10, marginTop: 2, fontFamily: 'monospace' },
  legendRow: {
    flexDirection: 'row',
    gap: 10,
    width: MAP_VIEW_W,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },

  playerOverlay: {
    position: 'absolute',
    left: MAP_VIEW_W / 2 - TILE / 2,
    top: MAP_VIEW_W / 2 - TILE / 2 - SPRITE_DISPLAY_H + TILE,
    width: TILE,
    height: SPRITE_DISPLAY_H + 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  playerShadow: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 5,
    backgroundColor: '#000',
    opacity: 0.25,
    borderRadius: 9,
  },

  dpad: {
    marginTop: 8,
    alignItems: 'center',
  },
  dpadRow: { flexDirection: 'row', alignItems: 'center' },
  dpadBtn: {
    width: 52, height: 52,
    backgroundColor: 'rgba(0,0,0,0.70)',
    borderWidth: 2, borderColor: '#ffffff44',
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    margin: 2,
  },
  dpadArrow: { color: '#fff', fontSize: 20, fontWeight: '900' },
  dpadCenter: { width: 52, height: 52, margin: 2 },

  overlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center',
  },
  encounterBox: {
    backgroundColor: '#0d1a0d',
    borderWidth: 3, borderColor: '#f59e0b',
    borderRadius: 4, padding: 24, width: 280,
    alignItems: 'center',
  },
  encounterTitle: { color: '#f59e0b', fontSize: 16, fontWeight: '900', fontFamily: 'monospace', marginBottom: 8 },
  encounterEnemy: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: 'monospace', marginBottom: 4 },
  encounterSub: { color: '#ffffffaa', fontSize: 12, fontFamily: 'monospace', marginBottom: 18 },
  encounterBtns: { flexDirection: 'row', gap: 12 },
  encounterFlee: {
    borderWidth: 2, borderColor: '#ffffff44',
    borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10,
  },
  encounterFleeText: { color: '#aaa', fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
  encounterFight: {
    backgroundColor: '#f59e0b',
    borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10,
  },
  encounterFightText: { color: '#000', fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },

  portalBox: {
    backgroundColor: '#0d0d1a',
    borderWidth: 3, borderColor: '#9c27b0',
    borderRadius: 4, padding: 24, width: 280,
    alignItems: 'center',
  },
  portalIcon: { fontSize: 36, marginBottom: 8 },
  portalTitle: { color: '#ce93d8', fontSize: 12, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  portalName: { color: '#fff', fontSize: 18, fontWeight: '900', fontFamily: 'monospace', marginBottom: 18 },
});
