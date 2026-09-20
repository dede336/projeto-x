import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  Image, Animated, Easing, Modal, Pressable, PanResponder,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  CHARACTERS, EVOLUTIONS, ALTERNATE_EVOLUTIONS, EXTRA_ALTERNATE_EVOLUTIONS,
  FUSIONS, RARITY_COLORS, RARITY_LABELS, RarityId, TAMERS, ITEM_NAMES,
  HARDCODED_CUSTOM_ALTERNATE_EVOLUTIONS,
} from '@/constants/gameData';
import { getCharacter } from '@/constants/extendedCharacters';
import { CharacterAvatar } from '@/components/GameComponents';
import { pixelStyle } from '@/constants/pixelStyle';
import { useGame } from '@/context/GameContext';

// ─── Tree data structure ──────────────────────────────────────────────────────

type EvoConditions = {
  fromId: string;
  requiredLevel?: number;
  requiredItem?: string;
  requiredSacrificeCharacter?: string;
  requiredSacrificeCharacters?: string[];
};

type TreeNode = {
  id: string;
  children: TreeNode[];
  conditions?: EvoConditions;
};

function buildReverseMap(): Record<string, string[]> {
  const rev: Record<string, string[]> = {};
  for (const [fromId, { evolvesTo }] of Object.entries(EVOLUTIONS)) {
    if (!rev[evolvesTo]) rev[evolvesTo] = [];
    rev[evolvesTo].push(fromId);
  }
  for (const [fromId, { evolvesTo }] of Object.entries(ALTERNATE_EVOLUTIONS)) {
    if (!rev[evolvesTo]) rev[evolvesTo] = [];
    if (!rev[evolvesTo].includes(fromId)) rev[evolvesTo].push(fromId);
  }
  for (const [fromId, { evolvesTo }] of Object.entries(EXTRA_ALTERNATE_EVOLUTIONS)) {
    if (!rev[evolvesTo]) rev[evolvesTo] = [];
    if (!rev[evolvesTo].includes(fromId)) rev[evolvesTo].push(fromId);
  }
  return rev;
}

function findRoot(charId: string, reverseMap: Record<string, string[]>, visited = new Set<string>()): string {
  if (visited.has(charId)) return charId;
  visited.add(charId);
  const predecessors = reverseMap[charId];
  if (!predecessors || predecessors.length === 0) return charId;
  return findRoot(predecessors[0], reverseMap, visited);
}

function getConditionsForChild(parentId: string, childId: string): EvoConditions | undefined {
  const main = EVOLUTIONS[parentId];
  if (main?.evolvesTo === childId) {
    return { fromId: parentId, requiredLevel: main.requiredLevel, requiredItem: main.requiredItem, requiredSacrificeCharacter: (main as any).requiredSacrificeCharacter, requiredSacrificeCharacters: (main as any).requiredSacrificeCharacters };
  }
  const alt = ALTERNATE_EVOLUTIONS[parentId];
  if (alt?.evolvesTo === childId) {
    return { fromId: parentId, requiredLevel: alt.requiredLevel, requiredItem: alt.requiredItem, requiredSacrificeCharacter: (alt as any).requiredSacrificeCharacter, requiredSacrificeCharacters: (alt as any).requiredSacrificeCharacters };
  }
  const ext = EXTRA_ALTERNATE_EVOLUTIONS[parentId];
  if (ext?.evolvesTo === childId) {
    return { fromId: parentId, requiredLevel: ext.requiredLevel, requiredItem: ext.requiredItem, requiredSacrificeCharacter: (ext as any).requiredSacrificeCharacter };
  }
  const hc = HARDCODED_CUSTOM_ALTERNATE_EVOLUTIONS[parentId];
  if (hc?.evolvesTo === childId) {
    return { fromId: parentId, requiredLevel: hc.requiredLevel, requiredItem: hc.requiredItem, requiredSacrificeCharacters: hc.requiredSacrificeCharacters };
  }
  return undefined;
}

function buildTreeNode(charId: string, visited: Set<string>, parentId?: string): TreeNode {
  const mainNext  = EVOLUTIONS[charId]?.evolvesTo;
  const altNext   = ALTERNATE_EVOLUTIONS[charId]?.evolvesTo;
  const alt2Next  = EXTRA_ALTERNATE_EVOLUTIONS[charId]?.evolvesTo;

  const targets: string[] = [];
  if (mainNext && !visited.has(mainNext)) targets.push(mainNext);
  if (altNext && altNext !== mainNext && !visited.has(altNext)) targets.push(altNext);
  if (alt2Next && alt2Next !== mainNext && alt2Next !== altNext && !visited.has(alt2Next)) targets.push(alt2Next);

  const nextVisited = new Set(visited);
  for (const t of targets) nextVisited.add(t);

  const conditions = parentId ? getConditionsForChild(parentId, charId) : undefined;

  return {
    id: charId,
    conditions,
    children: targets.map(t => buildTreeNode(t, nextVisited, charId)),
  };
}

// ─── Build the active linear path following branch selections ─────────────────

type PathStep = {
  node: TreeNode;
  branchIndex: number;      // which child is selected at this node
  totalBranches: number;    // how many children this node has
};

function buildActivePath(root: TreeNode, selections: Record<string, number>): PathStep[] {
  const steps: PathStep[] = [];
  let current: TreeNode | null = root;

  while (current) {
    const total = current.children.length;
    const idx = total > 0 ? Math.min(selections[current.id] ?? 0, total - 1) : 0;
    steps.push({ node: current, branchIndex: idx, totalBranches: total });
    current = total > 0 ? current.children[idx] : null;
  }

  return steps;
}

// ─── Animated lens-flare glow ─────────────────────────────────────────────────

function LensFlareAura({ size, tintColor }: { size: number; tintColor?: string }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: false }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.88, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const flareSize = size * 2.2;

  return (
    <Animated.Image
      source={require('@/assets/images/lens-flare.webp')}
      tintColor={tintColor}
      style={{ position: 'absolute', width: flareSize, height: flareSize, opacity: 0.32, transform: [{ rotate: spin }, { scale: pulse }] }}
      resizeMode="contain"
    />
  );
}

// ─── Single Digimon card (large, full-width style) ────────────────────────────

function DigiCard({
  charId, isCurrent, size, tamerAccent, onPress,
}: {
  charId: string; isCurrent: boolean; size: number; tamerAccent?: string; onPress?: () => void;
}) {
  const colors = useColors();
  const char = getCharacter(charId) ?? CHARACTERS[charId];
  const name = char?.name ?? charId;
  const rarity = (char?.rarity ?? 'COMMON') as RarityId;
  const stageColor = RARITY_COLORS[rarity] ?? '#888';
  const fusionPartner = FUSIONS[charId]?.partner;
  const fusionName = fusionPartner
    ? (getCharacter(fusionPartner) ?? CHARACTERS[fusionPartner])?.name ?? fusionPartner
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[cardStyles.wrap, { borderColor: isCurrent ? stageColor : colors.border, backgroundColor: isCurrent ? `${stageColor}11` : colors.card }]}
    >
      <View style={[cardStyles.stagePill, { backgroundColor: `${stageColor}22`, borderColor: stageColor }, pixelStyle]}>
        <Text style={[cardStyles.stagePillText, { color: stageColor }]}>
          {RARITY_LABELS[rarity] ?? rarity}
        </Text>
      </View>
      <View style={[cardStyles.avatarWrap, { width: size, height: size }]}>
        {isCurrent && <LensFlareAura size={size} tintColor={tamerAccent} />}
        <CharacterAvatar characterId={charId} size={size} />
      </View>
      <Text style={[cardStyles.name, { color: isCurrent ? stageColor : colors.foreground }]} numberOfLines={2}>
        {name}
      </Text>
      {fusionName && (
        <View style={[cardStyles.fusionBadge, { backgroundColor: '#e879f922', borderColor: '#e879f966' }]}>
          <Text style={[cardStyles.fusionText, { color: '#e879f9' }]}>+ {fusionName}</Text>
        </View>
      )}
      <View style={cardStyles.tapHint}>
        <Feather name="info" size={10} color={colors.mutedForeground} />
        <Text style={[cardStyles.tapHintText, { color: colors.mutedForeground }]}>ver condições</Text>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 20,
    width: '100%',
  },
  stagePill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignItems: 'center', alignSelf: 'center' },
  stagePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  fusionBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  fusionText: { fontSize: 10, fontWeight: '700' },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 },
  tapHintText: { fontSize: 10, fontStyle: 'italic' },
});

// ─── Connector arrow ──────────────────────────────────────────────────────────

function ConnectorArrow({ color }: { color: string }) {
  return (
    <View style={connStyles.wrap}>
      <View style={[connStyles.line, { backgroundColor: color }]} />
      <Feather name="chevron-down" size={14} color={color} />
    </View>
  );
}

const connStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 4 },
  line: { width: 2, height: 18 },
});

// ─── Branch navigator (left/right arrows) ─────────────────────────────────────

function BranchNavigator({
  parentId,
  children,
  selectedIndex,
  onPrev,
  onNext,
}: {
  parentId: string;
  children: TreeNode[];
  selectedIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const colors = useColors();
  const total = children.length;
  if (total <= 1) return null;

  const selectedChild = children[selectedIndex];
  const char = getCharacter(selectedChild.id) ?? CHARACTERS[selectedChild.id];
  const name = char?.name ?? selectedChild.id;
  const rarity = (char?.rarity ?? 'COMMON') as RarityId;
  const stageColor = RARITY_COLORS[rarity] ?? '#888';

  return (
    <View style={[navStyles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={onPrev}
        disabled={selectedIndex === 0}
        style={[navStyles.arrow, { opacity: selectedIndex === 0 ? 0.25 : 1 }]}
        activeOpacity={0.6}
      >
        <Feather name="chevron-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <View style={navStyles.center}>
        <Text style={[navStyles.label, { color: colors.mutedForeground }]}>LINHA EVOLUTIVA</Text>
        <Text style={[navStyles.branchName, { color: stageColor }]} numberOfLines={1}>{name}</Text>
        <View style={navStyles.dots}>
          {children.map((_, i) => (
            <View
              key={i}
              style={[navStyles.dot, {
                backgroundColor: i === selectedIndex ? stageColor : colors.border,
                width: i === selectedIndex ? 16 : 6,
              }]}
            />
          ))}
        </View>
        <Text style={[navStyles.counter, { color: colors.mutedForeground }]}>
          {selectedIndex + 1} / {total}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onNext}
        disabled={selectedIndex === total - 1}
        style={[navStyles.arrow, { opacity: selectedIndex === total - 1 ? 0.25 : 1 }]}
        activeOpacity={0.6}
      >
        <Feather name="chevron-right" size={22} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

const navStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8,
    width: '100%', gap: 8,
  },
  arrow: { padding: 6, borderRadius: 8 },
  center: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  branchName: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  counter: { fontSize: 10 },
});

// ─── Evolution Conditions Modal ───────────────────────────────────────────────

type SelectedNode = { charId: string; conditions?: EvoConditions };

function EvoConditionsModal({
  selected, onClose,
}: {
  selected: SelectedNode | null; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!selected) return null;

  const char = getCharacter(selected.charId) ?? CHARACTERS[selected.charId];
  const rarity = (char?.rarity ?? 'COMMON') as RarityId;
  const stageColor = RARITY_COLORS[rarity] ?? '#888';
  const name = char?.name ?? selected.charId;
  const cond = selected.conditions;

  const fromChar = cond?.fromId
    ? (getCharacter(cond.fromId) ?? CHARACTERS[cond.fromId])
    : null;

  const sacrificeIds: string[] = cond?.requiredSacrificeCharacters
    ? cond.requiredSacrificeCharacters
    : cond?.requiredSacrificeCharacter
      ? [cond.requiredSacrificeCharacter]
      : [];

  const sacrificeNames = sacrificeIds.map(id => {
    const c = getCharacter(id) ?? CHARACTERS[id];
    return c?.name ?? id;
  });

  const itemName = cond?.requiredItem ? (ITEM_NAMES[cond.requiredItem] ?? cond.requiredItem) : null;
  const isRoot = !cond;

  return (
    <Modal transparent animationType="slide" visible={!!selected} onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={[modalStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />

        <View style={modalStyles.header}>
          <View style={[modalStyles.stagePill, { backgroundColor: `${stageColor}22`, borderColor: stageColor }]}>
            <Text style={[modalStyles.stagePillText, { color: stageColor }]}>{RARITY_LABELS[rarity] ?? rarity}</Text>
          </View>
          <CharacterAvatar characterId={selected.charId} size={80} />
          <Text style={[modalStyles.charName, { color: colors.foreground }]}>{name}</Text>
        </View>

        <View style={[modalStyles.divider, { backgroundColor: colors.border }]} />

        {isRoot ? (
          <View style={modalStyles.row}>
            <Feather name="star" size={14} color={colors.mutedForeground} />
            <Text style={[modalStyles.rowText, { color: colors.mutedForeground }]}>Forma inicial da linha evolutiva</Text>
          </View>
        ) : (
          <>
            <Text style={[modalStyles.sectionTitle, { color: colors.mutedForeground }]}>CONDIÇÕES DE EVOLUÇÃO</Text>

            {fromChar && (
              <View style={modalStyles.row}>
                <Feather name="arrow-up-circle" size={14} color={colors.mutedForeground} />
                <Text style={[modalStyles.rowLabel, { color: colors.mutedForeground }]}>Evolui de</Text>
                <Text style={[modalStyles.rowValue, { color: colors.foreground }]}>{fromChar.name}</Text>
              </View>
            )}

            {cond?.requiredLevel != null && (
              <View style={modalStyles.row}>
                <Feather name="trending-up" size={14} color="#4ade80" />
                <Text style={[modalStyles.rowLabel, { color: colors.mutedForeground }]}>Nível mínimo</Text>
                <Text style={[modalStyles.rowValue, { color: '#4ade80', fontWeight: '800' }]}>Lv. {cond.requiredLevel}</Text>
              </View>
            )}

            {itemName && (
              <View style={modalStyles.row}>
                <Feather name="package" size={14} color="#facc15" />
                <Text style={[modalStyles.rowLabel, { color: colors.mutedForeground }]}>Item necessário</Text>
                <Text style={[modalStyles.rowValue, { color: '#facc15' }]}>{itemName}</Text>
              </View>
            )}

            {sacrificeNames.length > 0 && (
              <View style={modalStyles.row}>
                <Feather name="x-circle" size={14} color="#f87171" />
                <Text style={[modalStyles.rowLabel, { color: colors.mutedForeground }]}>
                  {sacrificeNames.length === 1 ? 'Sacrifício' : 'Sacrifícios'}
                </Text>
                <Text style={[modalStyles.rowValue, { color: '#f87171' }]}>{sacrificeNames.join(', ')}</Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={[modalStyles.closeBtn, { backgroundColor: `${stageColor}22`, borderColor: stageColor }]} onPress={onClose}>
          <Text style={[modalStyles.closeBtnText, { color: stageColor }]}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 12, paddingHorizontal: 20, gap: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  header: { alignItems: 'center', gap: 8 },
  stagePill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  stagePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  charName: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  divider: { height: 1 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: -4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 13, flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  rowText: { fontSize: 13, fontStyle: 'italic' },
  closeBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  closeBtnText: { fontSize: 14, fontWeight: '800' },
});

// ─── Full tree helpers ────────────────────────────────────────────────────────

const FULL_TREE_SIZE = 32;
const FULL_NODE_MIN_W = FULL_TREE_SIZE + 8; // 40px minimum per column

function countLeaves(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function SplitConnector({ color, count }: { color: string; count: number }) {
  const legWidth = Math.min(100 / count, 50);
  return (
    <View style={splitStyles.forkWrap}>
      <View style={[splitStyles.stem, { backgroundColor: color }]} />
      <View style={[splitStyles.hBar, { backgroundColor: color, width: `${legWidth * count}%` as any }]} />
      <View style={[splitStyles.legsRow, { width: `${legWidth * count}%` as any }]}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={[splitStyles.leg, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

const splitStyles = StyleSheet.create({
  forkWrap: { alignItems: 'center', width: '100%', paddingHorizontal: 8, marginTop: 2 },
  stem:     { width: 2, height: 10 },
  hBar:     { height: 2, alignSelf: 'center' },
  legsRow:  { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'center' },
  leg:      { width: 2, height: 10 },
});

function FullTreeNodeCard({
  charId, isCurrent, tamerAccent, onPress,
}: {
  charId: string; isCurrent: boolean; tamerAccent?: string; onPress?: () => void;
}) {
  const char = getCharacter(charId) ?? CHARACTERS[charId];
  const rarity = (char?.rarity ?? 'COMMON') as RarityId;
  const stageColor = RARITY_COLORS[rarity] ?? '#888';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={ftCardStyles.wrap}
    >
      <View style={[ftCardStyles.avatarWrap, { width: FULL_TREE_SIZE, height: FULL_TREE_SIZE }]}>
        {isCurrent && <LensFlareAura size={FULL_TREE_SIZE} tintColor={tamerAccent ?? stageColor} />}
        <CharacterAvatar characterId={charId} size={FULL_TREE_SIZE} />
      </View>
    </TouchableOpacity>
  );
}

const ftCardStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
});

function FullTreeNodeView({
  node, currentId, availWidth, tamerAccent, onSelect,
}: {
  node: TreeNode; currentId: string; availWidth: number; tamerAccent?: string;
  onSelect: (node: TreeNode) => void;
}) {
  const colors = useColors();
  const { children } = node;
  const childCount = children.length;

  // Each child gets width proportional to its own leaf count
  const childLeaves = children.map(c => Math.max(1, countLeaves(c)));
  const totalLeaves = childLeaves.reduce((s, l) => s + l, 0);
  const totalRequired = totalLeaves * FULL_NODE_MIN_W;
  const totalWidth = Math.max(availWidth, totalRequired);

  return (
    <View style={{ alignItems: 'center', width: totalWidth }}>
      <FullTreeNodeCard
        charId={node.id}
        isCurrent={node.id === currentId}
        tamerAccent={tamerAccent}
        onPress={() => onSelect(node)}
      />

      {childCount === 1 && (
        <>
          <ConnectorArrow color={colors.border} />
          <FullTreeNodeView node={children[0]} currentId={currentId} availWidth={totalWidth} tamerAccent={tamerAccent} onSelect={onSelect} />
        </>
      )}

      {childCount > 1 && (
        <>
          <SplitConnector color={colors.border} count={childCount} />
          <View style={{ flexDirection: 'row', width: totalWidth, alignItems: 'flex-start' }}>
            {children.map((child, i) => {
              const w = Math.floor((childLeaves[i] / totalLeaves) * totalWidth);
              return (
                <FullTreeNodeView
                  key={child.id}
                  node={child}
                  currentId={currentId}
                  availWidth={w}
                  tamerAccent={tamerAccent}
                  onSelect={onSelect}
                />
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// ─── 2D Pan Canvas (drag anywhere, no scrollbars) ────────────────────────────

function PanCanvas({ contentWidth, children }: { contentWidth: number; children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <ScrollView
        horizontal
        contentContainerStyle={{
          width: contentWidth,
          minHeight: '100%',
          alignItems: 'flex-start',
        }}
        showsHorizontalScrollIndicator={false}
      >
        <View
          style={{
            width: contentWidth,
            alignItems: 'center',
          }}
        >
          {children}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

// ─── Find path to target character (pre-selects correct branches) ─────────────

function buildInitialBranchSelections(root: TreeNode, targetId: string): Record<string, number> {
  const result: Record<string, number> = {};

  function search(node: TreeNode): boolean {
    if (node.id === targetId) return true;
    for (let i = 0; i < node.children.length; i++) {
      if (search(node.children[i])) {
        result[node.id] = i;
        return true;
      }
    }
    return false;
  }

  search(root);
  return result;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AVATAR_SIZE = 120;

export default function EvoTreeScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customCharsRevision, tamerId } = useGame();
  const tamerAccent = TAMERS.find(t => t.id === tamerId)?.accentColor;

  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [viewMode, setViewMode] = useState<'path' | 'full'>('path');
  // For each node ID with multiple children, which branch index is selected
  const [branchSelections, setBranchSelections] = useState<Record<string, number>>({});

  const root = useMemo(() => {
    if (!characterId) return null;
    const reverseMap = buildReverseMap();
    const rootId = findRoot(characterId, reverseMap);
    return buildTreeNode(rootId, new Set([rootId]));
  }, [characterId, customCharsRevision]);

  // Pre-select the branches that lead to the current character
  useEffect(() => {
    if (!root || !characterId) {
      setBranchSelections({});
      return;
    }
    setBranchSelections(buildInitialBranchSelections(root, characterId));
  }, [root]);

  const charName = useMemo(() => {
    if (!characterId) return '';
    const c = getCharacter(characterId) ?? CHARACTERS[characterId];
    return c?.name ?? characterId;
  }, [characterId, customCharsRevision]);

  // Build the active linear path based on current branch selections
  const activePath = useMemo(() => {
    if (!root) return [];
    return buildActivePath(root, branchSelections);
  }, [root, branchSelections]);

  // Width for the full tree based on total leaf count
  const screenW = Dimensions.get('window').width;
  const fullTreeWidth = useMemo(() => {
    if (!root) return screenW;
    const leaves = countLeaves(root);
    return Math.max(screenW - 24, leaves * FULL_NODE_MIN_W);
  }, [root, screenW]);

  function setBranchFor(nodeId: string, index: number) {
    setBranchSelections(prev => ({ ...prev, [nodeId]: index }));
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/evo-tree-icon.webp')} style={{ width: 18, height: 18 }} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            Árvore Evolutiva
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode toggle */}
      <View style={[styles.toggleRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setViewMode('path')}
          style={[styles.toggleBtn, viewMode === 'path' && { backgroundColor: `${colors.foreground}15`, borderColor: colors.foreground }]}
          activeOpacity={0.7}
        >
          <Feather name="git-commit" size={13} color={viewMode === 'path' ? colors.foreground : colors.mutedForeground} />
          <Text style={[styles.toggleText, { color: viewMode === 'path' ? colors.foreground : colors.mutedForeground, fontWeight: viewMode === 'path' ? '800' : '500' }]}>
            Por Linha
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('full')}
          style={[styles.toggleBtn, viewMode === 'full' && { backgroundColor: `${colors.foreground}15`, borderColor: colors.foreground }]}
          activeOpacity={0.7}
        >
          <Feather name="git-branch" size={13} color={viewMode === 'full' ? colors.foreground : colors.mutedForeground} />
          <Text style={[styles.toggleText, { color: viewMode === 'full' ? colors.foreground : colors.mutedForeground, fontWeight: viewMode === 'full' ? '800' : '500' }]}>
            Árvore Completa
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── PATH MODE ── vertical scrolling page */}
      {viewMode === 'path' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{charName}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Use ◀ ▶ para navegar entre ramificações · toque para ver condições
          </Text>
          {activePath.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Linha evolutiva não encontrada.</Text>
            </View>
          ) : (
            <View style={styles.pathWrap}>
              {activePath.map((step, i) => {
                const isLast = i === activePath.length - 1;
                const hasBranches = step.totalBranches > 1;
                return (
                  <View key={`${step.node.id}-${i}`} style={styles.stepWrap}>
                    <DigiCard
                      charId={step.node.id}
                      isCurrent={step.node.id === characterId}
                      size={AVATAR_SIZE}
                      tamerAccent={tamerAccent}
                      onPress={() => setSelectedNode({ charId: step.node.id, conditions: step.node.conditions })}
                    />
                    {hasBranches && (
                      <BranchNavigator
                        parentId={step.node.id}
                        children={step.node.children}
                        selectedIndex={step.branchIndex}
                        onPrev={() => setBranchFor(step.node.id, Math.max(0, step.branchIndex - 1))}
                        onNext={() => setBranchFor(step.node.id, Math.min(step.totalBranches - 1, step.branchIndex + 1))}
                      />
                    )}
                    {!isLast && <ConnectorArrow color={colors.border} />}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── FULL TREE MODE ── true 2D scroll: horizontal outer → vertical inner */}
      {viewMode === 'full' && (
        <View style={{ flex: 1 }}>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, marginTop: 10, textAlign: 'center' }]}>{charName}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center', marginBottom: 4 }]}>
            Arraste para os lados e para cima/baixo · toque para ver condições
          </Text>
          {root ? (
            <PanCanvas contentWidth={fullTreeWidth}>
              <View style={{ paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' }}>
                <FullTreeNodeView
                  node={root}
                  currentId={characterId ?? ''}
                  availWidth={fullTreeWidth - 16}
                  tamerAccent={tamerAccent}
                  onSelect={(node) => setSelectedNode({ charId: node.id, conditions: node.conditions })}
                />
              </View>
            </PanCanvas>
          ) : (
            <View style={styles.emptyWrap}>
              <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Linha evolutiva não encontrada.</Text>
            </View>
          )}
        </View>
      )}

      <EvoConditionsModal selected={selectedNode} onClose={() => setSelectedNode(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 36, justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  toggleText: { fontSize: 12 },
  content: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 16, gap: 4 },
  subtitle: { fontSize: 12, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { fontSize: 10, textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  emptyWrap: { alignItems: 'center', gap: 12, marginTop: 60 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  pathWrap: { width: '100%', alignItems: 'center', gap: 0 },
  stepWrap: { width: '100%', alignItems: 'center', gap: 8 },
});
