import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder,
  ScrollView, Modal,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

const MAP_W = 20;
const MAP_H = 30;
const TILE_SZ = 13;

const TG  = 0;
const TH  = 1;
const TT  = 2;
const TW  = 3;
const TR  = 4;
const TP  = 5;
const TF  = 6;
const TP1 = 7;
const TP2 = 8;
const TP3 = 9;
const TPB = 10;
const TD  = 11;
const TB  = 12;

const PALETTE = [
  { id: TG,  short: 'G',  label: 'Grama',    color: '#4a9e4a' },
  { id: TH,  short: 'H',  label: 'G.Alta',   color: '#357535' },
  { id: TT,  short: 'T',  label: 'Árvore',   color: '#1e5c14' },
  { id: TW,  short: 'W',  label: 'Água',     color: '#4a9bb0' },
  { id: TR,  short: 'R',  label: 'Pedra',    color: '#7a7a6a' },
  { id: TP,  short: 'P',  label: 'Caminho',  color: '#c07a3a' },
  { id: TF,  short: 'F',  label: 'Flores',   color: '#4db34d' },
  { id: TD,  short: 'D',  label: 'G.Densa',  color: '#1e3a1e' },
  { id: TB,  short: 'B',  label: 'Ponte',    color: '#8a6a3a' },
  { id: TP1, short: 'P1', label: 'Portal 1', color: '#00bcd4' },
  { id: TP2, short: 'P2', label: 'Portal 2', color: '#8bc34a' },
  { id: TP3, short: 'P3', label: 'Portal 3', color: '#ff9800' },
  { id: TPB, short: 'PB', label: 'Boss',     color: '#e53935' },
];

function makeGrid(): number[][] {
  return Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TG));
}

interface Props {
  visible: boolean;
  initialGrid?: number[][] | null;
  onSave: (grid: number[][]) => void;
  onClose: () => void;
}

export default function MapTileEditor({ visible, initialGrid, onSave, onClose }: Props) {
  const colors = useColors();
  const [grid, setGrid] = useState<number[][]>(makeGrid);
  const [selected, setSelected] = useState(TG);
  const selectedRef = useRef(TG);
  const gridAbsRef = useRef<{ x: number; y: number } | null>(null);
  const gridViewRef = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      setSelected(TG);
      selectedRef.current = TG;
      if (
        initialGrid &&
        initialGrid.length === MAP_H &&
        initialGrid[0]?.length === MAP_W
      ) {
        setGrid(initialGrid.map((r) => [...r]));
      } else {
        setGrid(makeGrid());
      }
    }
  }, [visible]);

  function measureGrid() {
    (gridViewRef.current as any)?.measureInWindow(
      (x: number, y: number) => { gridAbsRef.current = { x, y }; }
    );
  }

  function paintTile(pageX: number, pageY: number) {
    if (!gridAbsRef.current) return;
    const col = Math.floor((pageX - gridAbsRef.current.x) / TILE_SZ);
    const row = Math.floor((pageY - gridAbsRef.current.y) / TILE_SZ);
    if (col < 0 || col >= MAP_W || row < 0 || row >= MAP_H) return;
    const tile = selectedRef.current;
    setGrid((prev) => {
      if (prev[row][col] === tile) return prev;
      const next = prev.map((r) => [...r]);
      next[row][col] = tile;
      return next;
    });
  }

  const paintRef = useRef(paintTile);
  paintRef.current = paintTile;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        paintRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => {
        paintRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
    })
  ).current;

  const selPal = PALETTE.find((p) => p.id === selected) ?? PALETTE[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[st.container, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <Text style={[st.title, { color: colors.foreground }]}>🗺️ Editor de Mapa</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              onPress={() => setGrid(makeGrid())}
              style={[st.hBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 11 }}>Resetar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const t = selectedRef.current;
                setGrid(Array.from({ length: MAP_H }, () => Array(MAP_W).fill(t)));
              }}
              style={[st.hBtn, { borderColor: colors.primary }]}
            >
              <Text style={{ color: colors.primary, fontSize: 11 }}>Preencher</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(grid)}
              style={[st.hBtn, { backgroundColor: '#22c55e', borderColor: '#22c55e' }]}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓ Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={[st.hBtn, { borderColor: '#ef4444' }]}
            >
              <Text style={{ color: '#ef4444', fontSize: 11 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Paleta ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[st.paletteBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 7 }}
        >
          {PALETTE.map((pal) => {
            const isSelected = selected === pal.id;
            return (
              <TouchableOpacity
                key={pal.id}
                onPress={() => { setSelected(pal.id); selectedRef.current = pal.id; }}
                style={[
                  st.palItem,
                  { backgroundColor: pal.color },
                  isSelected && { borderColor: '#fff', borderWidth: 2.5, transform: [{ scale: 1.12 }] },
                  !isSelected && { opacity: 0.72, borderColor: 'transparent', borderWidth: 1 },
                ]}
              >
                <Text style={st.palShort}>{pal.short}</Text>
                <Text style={st.palLabel}>{pal.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Barra de info ── */}
        <View style={[st.infoBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[st.infoSwatch, { backgroundColor: selPal.color }]} />
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Selecionado: <Text style={{ color: selPal.color, fontWeight: '700' }}>{selPal.label}</Text>
            {'  ·  '}Toque ou arraste para pintar{'  ·  '}
            <Text style={{ color: colors.mutedForeground }}>20 × 30 tiles</Text>
          </Text>
        </View>

        {/* ── Grid ── */}
        <ScrollView
          contentContainerStyle={{ alignItems: 'center', paddingVertical: 10 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            ref={gridViewRef}
            onLayout={measureGrid}
            {...panResponder.panHandlers}
            style={{ width: MAP_W * TILE_SZ, height: MAP_H * TILE_SZ }}
          >
            {grid.map((row, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row' }}>
                {row.map((tile, cIdx) => {
                  const pal = PALETTE.find((p) => p.id === tile) ?? PALETTE[0];
                  return (
                    <View
                      key={cIdx}
                      style={{
                        width: TILE_SZ,
                        height: TILE_SZ,
                        backgroundColor: pal.color,
                        borderWidth: 0.3,
                        borderColor: '#00000033',
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  title: { fontSize: 14, fontWeight: '700' },
  hBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  paletteBar: { borderBottomWidth: 1, maxHeight: 72, flexGrow: 0 },
  palItem: {
    width: 46, height: 50, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  palShort: {
    color: '#fff', fontSize: 13, fontWeight: '800',
    textShadowColor: '#000', textShadowOffset: { width: 0.5, height: 0.5 }, textShadowRadius: 1,
  },
  palLabel: {
    color: '#fff', fontSize: 8, opacity: 0.9,
    textShadowColor: '#000', textShadowOffset: { width: 0.5, height: 0.5 }, textShadowRadius: 1,
  },
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 1,
  },
  infoSwatch: { width: 14, height: 14, borderRadius: 3 },
});
