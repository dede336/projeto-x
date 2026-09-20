import React, { useMemo, useState, useCallback } from 'react';
import {
  Dimensions, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  ATTRIBUTES, ELEMENTS, CHARACTERS, RARITY_COLORS, RARITY_LABELS, RARITY_ORDER,
  CODEX_ORDER, EVOLUTIONS, ALTERNATE_EVOLUTIONS, EXTRA_ALTERNATE_EVOLUTIONS, FUSIONS, SCANNABLE_CHARACTERS,
} from '@/constants/gameData';
import { pixelStyle } from '@/constants/pixelStyle';
import { CharacterAvatar, ScanCard, AttributeBadge, ElementBadge } from '@/components/GameComponents';
import { CustomDigimonRaw, getRawCustomDigimons } from '@/constants/extendedCharacters';
import { useLanguage } from '@/context/LanguageContext';

// ─── Obtain data ────────────────────────────────────────────────────────────

const MAIL_REWARDS: Record<string, number> = {
  guilmon: 5,
  agumonSaver: 10,
};

const STARTER_TAMERS: Record<string, string> = {
  agumon:  'Tai',
  patamon: 'T.K.',
  gabumon: 'Matt',
  salamon: 'Kari',
  pyomon:  'Sora',
  palmon:  'Mimi',
};

type ObtainMethod =
  | { type: 'starter'; tamer: string }
  | { type: 'scan' }
  | { type: 'mail'; rank: number }
  | { type: 'evolution'; from: string; level: number; item?: string }
  | { type: 'altEvo'; from: string; level: number; sacrifice?: string; sacrifices?: string[]; item?: string }
  | { type: 'fusion'; a: string; b: string; level: number }
  | { type: 'customEvo'; fromId: string; fromName: string; level?: number; item?: string }
  | { type: 'customFusion'; partnerAId: string; partnerAName: string; partnerBId: string; partnerBName: string }
  | { type: 'adminGift' };

function getObtainMethods(charId: string): ObtainMethod[] {
  const methods: ObtainMethod[] = [];

  if (STARTER_TAMERS[charId]) {
    methods.push({ type: 'starter', tamer: STARTER_TAMERS[charId] });
  }
  if (SCANNABLE_CHARACTERS.includes(charId)) {
    methods.push({ type: 'scan' });
  }
  if (MAIL_REWARDS[charId] !== undefined) {
    methods.push({ type: 'mail', rank: MAIL_REWARDS[charId] });
  }
  for (const [fromId, evo] of Object.entries(EVOLUTIONS)) {
    if (evo.evolvesTo === charId) {
      methods.push({ type: 'evolution', from: fromId, level: evo.requiredLevel, item: evo.requiredItem });
    }
  }
  for (const [fromId, altEvo] of Object.entries(ALTERNATE_EVOLUTIONS)) {
    if (altEvo.evolvesTo === charId) {
      methods.push({
        type: 'altEvo', from: fromId, level: altEvo.requiredLevel,
        sacrifice: altEvo.requiredSacrificeCharacter,
        sacrifices: (altEvo as any).requiredSacrificeCharacters as string[] | undefined,
        item: altEvo.requiredItem,
      });
    }
  }
  for (const [fromId, altEvo] of Object.entries(EXTRA_ALTERNATE_EVOLUTIONS)) {
    if (altEvo.evolvesTo === charId) {
      methods.push({
        type: 'altEvo', from: fromId, level: altEvo.requiredLevel,
        sacrifice: altEvo.requiredSacrificeCharacter,
        sacrifices: undefined,
        item: altEvo.requiredItem,
      });
    }
  }
  const fusionSeen = new Set<string>();
  for (const [, fusion] of Object.entries(FUSIONS)) {
    if (fusion.resultId === charId) {
      const key = [fusion.partner, ...Object.keys(FUSIONS).filter(k => FUSIONS[k].resultId === charId && FUSIONS[k].partner !== fusion.partner)].sort().join('-');
      if (!fusionSeen.has(key)) {
        fusionSeen.add(key);
        const partnerA = Object.entries(FUSIONS).find(([, f]) => f.resultId === charId);
        if (partnerA) {
          methods.push({ type: 'fusion', a: partnerA[0], b: partnerA[1].partner, level: partnerA[1].requiredLevel });
        }
        break;
      }
    }
  }
  return methods;
}

function resolveDigimonName(id: string, allChars: Record<string, { name: string }>): string {
  if (allChars[id]) return allChars[id].name;
  const withPrefix = `custom_${id}`;
  if (allChars[withPrefix]) return allChars[withPrefix].name;
  return id;
}

function getCustomObtainMethods(d: CustomDigimonRaw, allChars: Record<string, { name: string }>): ObtainMethod[] {
  const methods: ObtainMethod[] = [];
  if (d.scannable) methods.push({ type: 'scan' });
  if (!d.isBaseForm && d.evolvesFromId) {
    const fromName = resolveDigimonName(d.evolvesFromId, allChars);
    methods.push({ type: 'customEvo', fromId: d.evolvesFromId, fromName, level: d.requiredLevel, item: d.requiredItem });
  }
  if (d.isFusion && d.fusionPartner) {
    const partnerName = allChars[d.fusionPartner]?.name ?? d.fusionPartner;
    methods.push({ type: 'customFusion', partnerAId: d.id, partnerAName: d.name, partnerBId: d.fusionPartner, partnerBName: partnerName });
  }
  if (methods.length === 0) methods.push({ type: 'adminGift' });
  return methods;
}

function renderMethodLabel(m: ObtainMethod): { icon: string; label: string; color: string } {
  switch (m.type) {
    case 'starter':
      return { icon: '🌟', label: `Inicial do Tamer ${m.tamer}`, color: '#f59e0b' };
    case 'scan':
      return { icon: '📡', label: 'Escaneie em batalha', color: '#22c55e' };
    case 'mail':
      return { icon: '📬', label: `Correio — Tamer Rank ${m.rank}`, color: '#a78bfa' };
    case 'evolution': {
      const fromName = CHARACTERS[m.from]?.name ?? m.from;
      const extra = m.item ? ` + Item` : '';
      return { icon: '⬆️', label: `Evolução de ${fromName} (Lv ${m.level})${extra}`, color: '#60a5fa' };
    }
    case 'altEvo': {
      const fromName = CHARACTERS[m.from]?.name ?? m.from;
      const sacrificeName = m.sacrifice ? (CHARACTERS[m.sacrifice]?.name ?? m.sacrifice) : null;
      const multiSacNames = m.sacrifices && m.sacrifices.length > 0
        ? m.sacrifices.map((cid) => CHARACTERS[cid]?.name ?? cid).join(', ')
        : null;
      const itemLabel = m.item ? ' + Item Especial' : '';
      const sacLabel = multiSacNames ? ` + Sacrificar [${multiSacNames}]` : sacrificeName ? ` + Sacrificar ${sacrificeName}` : '';
      return { icon: '✨', label: `Evolução Alt. de ${fromName} (Lv ${m.level})${sacLabel}${itemLabel}`, color: '#fb923c' };
    }
    case 'fusion': {
      const aName = CHARACTERS[m.a]?.name ?? m.a;
      const bName = CHARACTERS[m.b]?.name ?? m.b;
      return { icon: '🔀', label: `Fusão: ${aName} + ${bName} (Lv ${m.level})`, color: '#e879f9' };
    }
    case 'customEvo': {
      const extra = m.item ? ` + Item` : '';
      const lvLabel = m.level ? ` (Lv ${m.level})` : '';
      return { icon: '⬆️', label: `Evolução de ${m.fromName}${lvLabel}${extra}`, color: '#60a5fa' };
    }
    case 'customFusion':
      return { icon: '🔀', label: `Fusão: ${m.partnerAName} + ${m.partnerBName}`, color: '#e879f9' };
    case 'adminGift':
      return { icon: '🎁', label: 'Distribuído pelo admin', color: '#f59e0b' };
  }
}

// ─── Filter types ────────────────────────────────────────────────────────────

type Filter = 'all' | 'owned' | 'missing' | 'available' | 'unavailable';

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all',         label: 'Todos'        },
  { key: 'owned',       label: 'Obtidos'      },
  { key: 'missing',     label: 'Faltam'       },
  { key: 'available',   label: 'Disponíveis'  },
  { key: 'unavailable', label: 'Indisponíveis'},
];

const ATTR_FILTERS = [
  { key: '', label: 'Todos', color: '#6b7280' },
  { key: 'VC', label: 'Vacina',        color: '#22c55e' },
  { key: 'VR', label: 'Vírus',         color: '#ef4444' },
  { key: 'DA', label: 'Data',          color: '#3b82f6' },
  { key: 'NO', label: 'Nulo',          color: '#6b7280' },
  { key: 'UN', label: 'Desconhecido',  color: '#a855f7' },
  { key: 'FR', label: 'Livre',         color: '#f59e0b' },
];

const RARITY_FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'EGG',       label: 'Ovo'         },
  { key: 'BABY',      label: 'Bebê'        },
  { key: 'TRAINING',  label: 'Treinamento' },
  { key: 'COMMON',    label: 'Rookie'      },
  { key: 'RARE',      label: 'Champion'    },
  { key: 'EPIC',      label: 'Ultimate'    },
  { key: 'LEGENDARY', label: 'Mega'        },
  { key: 'ULTRA',     label: 'Ultra'       },
  { key: 'BURST',     label: 'Burst'       },
];

const ELEM_FILTERS = [
  { key: '', label: 'Todos', color: '#6b7280' },
  { key: 'FIRE',      label: 'Fogo',   color: '#ff6b35' },
  { key: 'PLANT',     label: 'Planta', color: '#22c55e' },
  { key: 'WATER',     label: 'Água',   color: '#3b82f6' },
  { key: 'WIND',      label: 'Vento',  color: '#84cc16' },
  { key: 'EARTH',     label: 'Terra',  color: '#a16207' },
  { key: 'LIGHTNING', label: 'Raio',   color: '#facc15' },
  { key: 'LIGHT',     label: 'Luz',    color: '#fde68a' },
  { key: 'DARK',      label: 'Trevas', color: '#8b5cf6' },
  { key: 'NULL',      label: 'Nulo',   color: '#6b7280' },
  { key: 'ICE',       label: 'Gelo',   color: '#a8d8f0' },
  { key: 'METAL',     label: 'Metal',  color: '#94a3b8' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function BancoScreen() {
  const colors = useColors();
  const router = useRouter();
  const { collection, isAdmin, scanProgress, createFromScan, customCharsReady, customCharsRevision, refreshCustomData } = useGame();
  const { getApiUrl, token } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [attrFilter, setAttrFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [elemFilter, setElemFilter] = useState('');
  const [selected, setSelected] = useState<null | typeof entries[0]>(null);
  const [filterModalOpen, setFilterModalOpen] = useState<'elem' | 'rarity' | 'attr' | null>(null);

  // Use the custom digimons already loaded by GameContext — no separate fetch needed.
  // customCharsRevision increments every time GameContext reloads custom data.
  const customDigimons = useMemo(
    () => getRawCustomDigimons(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customCharsRevision],
  );

  const handleToggleBanco = useCallback(async (dbId: number) => {
    try {
      const res = await fetch(`${getApiUrl()}/digimons/${dbId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      await refreshCustomData(getApiUrl());
    } catch {}
  }, [getApiUrl, token, refreshCustomData]);

  const ownedSet = useMemo(
    () => new Set(collection.map((c) => c.characterId)),
    [collection],
  );

  const allCharsMap = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    Object.entries(CHARACTERS).forEach(([id, c]) => { map[id] = { name: c.name }; });
    customDigimons.forEach((c) => { map[c.id] = { name: c.name }; });
    return map;
  }, [customDigimons]);

  const baseEntries = useMemo(() => {
    return CODEX_ORDER.map((id) => {
      const char = CHARACTERS[id];
      if (!char) return null;
      if (char.rarity === 'EGG') return null;
      const methods = getObtainMethods(id);
      const isOwned = ownedSet.has(id);
      const isAvailable = methods.length > 0;
      return { id, char, methods, isOwned, isAvailable, isCustom: false, isActive: true };
    }).filter(Boolean) as {
      id: string;
      char: (typeof CHARACTERS)[string];
      methods: ObtainMethod[];
      isOwned: boolean;
      isAvailable: boolean;
      isCustom: boolean;
      isActive: boolean;
    }[];
  }, [ownedSet]);

  // DB uses "CHAMPION" as a synonym for the client's "RARE" (Champion tier).
  // Normalize here so sorting and filters work correctly.
  const normalizeRarity = (r: string): string =>
    r === 'CHAMPION' ? 'RARE' : r;

  const customEntries = useMemo(() => {
    return customDigimons
      .filter((d) => d.rarity !== 'EGG')
      .filter((d) => !Object.values(CHARACTERS).some(
        (c) => c.name.toLowerCase() === d.name.toLowerCase()
      ))
      .map((d) => {
        const methods = getCustomObtainMethods(d, allCharsMap);
        const isOwned = ownedSet.has(d.id);
        const isAvailable = methods.length > 0;
        const isActive = (d as any).isActive !== false;
        const char = {
          id: d.id, name: d.name,
          attribute: d.attribute as any,
          rarity: normalizeRarity(d.rarity) as any,
          element: d.element as any,
          description: d.description,
          baseStats: d.baseStats,
        };
        return { id: d.id, char, methods, isOwned, isAvailable, isCustom: true, isActive };
      });
  }, [customDigimons, ownedSet, allCharsMap]);

  const entries = useMemo(() => {
    const all = [...baseEntries, ...customEntries];
    // Non-admins never see inactive entries
    if (!isAdmin) return all.filter((e) => e.isActive);
    return all;
  }, [baseEntries, customEntries, isAdmin]);

  const totalCount = entries.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = entries.filter((e) => {
      if (q && !e.char.name.toLowerCase().includes(q)) return false;
      if (filter === 'owned' && !e.isOwned) return false;
      if (filter === 'missing' && e.isOwned) return false;
      if (filter === 'available' && (!e.isAvailable || e.isOwned)) return false;
      if (filter === 'unavailable' && e.isAvailable) return false;
      if (attrFilter && e.char.attribute !== attrFilter) return false;
      if (rarityFilter && e.char.rarity !== rarityFilter) return false;
      if (elemFilter && e.char.element !== elemFilter) return false;
      return true;
    });
    return result.sort((a, b) => {
      const ai = RARITY_ORDER.indexOf(a.char.rarity as any);
      const bi = RARITY_ORDER.indexOf(b.char.rarity as any);
      // Unknown rarities (indexOf = -1) go to the end instead of the beginning
      const safeAi = ai < 0 ? 999 : ai;
      const safeBi = bi < 0 ? 999 : bi;
      if (safeAi !== safeBi) return safeAi - safeBi;
      return a.char.name.localeCompare(b.char.name);
    });
  }, [entries, search, filter, attrFilter, rarityFilter, elemFilter]);

  const st = styles(colors);

  const activeFiltersCount = [attrFilter, rarityFilter, elemFilter].filter(Boolean).length;

  return (
    <View style={st.root}>
      {/* Search */}
      <View style={[st.searchRow, pixelStyle]}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={st.searchInput}
          placeholder={t('banco.search')}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter buttons row */}
      <View style={st.filterBtnRow}>
        {/* Elemento */}
        <TouchableOpacity
          style={[st.filterBtn, elemFilter && { borderColor: ELEM_FILTERS.find(f => f.key === elemFilter)?.color ?? colors.primary, backgroundColor: (ELEM_FILTERS.find(f => f.key === elemFilter)?.color ?? '#888') + '22' }, pixelStyle]}
          onPress={() => setFilterModalOpen('elem')}
        >
          <Text style={[st.filterBtnText, { color: elemFilter ? (ELEM_FILTERS.find(f => f.key === elemFilter)?.color ?? colors.foreground) : colors.mutedForeground }]}>
            {elemFilter ? ELEM_FILTERS.find(f => f.key === elemFilter)?.label : 'Elemento'}
          </Text>
          <Feather name="chevron-down" size={12} color={elemFilter ? (ELEM_FILTERS.find(f => f.key === elemFilter)?.color ?? colors.mutedForeground) : colors.mutedForeground} />
        </TouchableOpacity>

        {/* Fase */}
        <TouchableOpacity
          style={[st.filterBtn, rarityFilter && { borderColor: RARITY_COLORS[rarityFilter as keyof typeof RARITY_COLORS] ?? colors.primary, backgroundColor: (RARITY_COLORS[rarityFilter as keyof typeof RARITY_COLORS] ?? '#888') + '22' }, pixelStyle]}
          onPress={() => setFilterModalOpen('rarity')}
        >
          <Text style={[st.filterBtnText, { color: rarityFilter ? (RARITY_COLORS[rarityFilter as keyof typeof RARITY_COLORS] ?? colors.foreground) : colors.mutedForeground }]}>
            {rarityFilter ? RARITY_FILTERS.find(f => f.key === rarityFilter)?.label : 'Fase'}
          </Text>
          <Feather name="chevron-down" size={12} color={rarityFilter ? (RARITY_COLORS[rarityFilter as keyof typeof RARITY_COLORS] ?? colors.mutedForeground) : colors.mutedForeground} />
        </TouchableOpacity>

        {/* Atributo */}
        <TouchableOpacity
          style={[st.filterBtn, attrFilter && { borderColor: ATTR_FILTERS.find(f => f.key === attrFilter)?.color ?? colors.primary, backgroundColor: (ATTR_FILTERS.find(f => f.key === attrFilter)?.color ?? '#888') + '22' }, pixelStyle]}
          onPress={() => setFilterModalOpen('attr')}
        >
          <Text style={[st.filterBtnText, { color: attrFilter ? (ATTR_FILTERS.find(f => f.key === attrFilter)?.color ?? colors.foreground) : colors.mutedForeground }]}>
            {attrFilter ? ATTR_FILTERS.find(f => f.key === attrFilter)?.label : 'Atributo'}
          </Text>
          <Feather name="chevron-down" size={12} color={attrFilter ? (ATTR_FILTERS.find(f => f.key === attrFilter)?.color ?? colors.mutedForeground) : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Filter Modal */}
      <Modal visible={filterModalOpen !== null} transparent animationType="fade" onRequestClose={() => setFilterModalOpen(null)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setFilterModalOpen(null)}>
          <View style={[st.modalSheet, { backgroundColor: colors.card }, pixelStyle]}>
            <View style={[st.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.modalTitle, { color: colors.foreground }]}>
              {filterModalOpen === 'elem' ? `⚡ ${t('banco.element')}` : filterModalOpen === 'rarity' ? `🎖 ${t('banco.phase')}` : `🛡 ${t('banco.attribute')}`}
            </Text>
            <View style={st.modalOptions}>
              {filterModalOpen === 'elem' && ELEM_FILTERS.map(({ key, label, color }) => (
                <TouchableOpacity
                  key={key}
                  style={[st.modalOption, { borderColor: elemFilter === key ? color : colors.border, backgroundColor: elemFilter === key ? color + '22' : colors.background }]}
                  onPress={() => { setElemFilter(elemFilter === key ? '' : key); setFilterModalOpen(null); }}
                >
                  <Text style={[st.modalOptionText, { color: elemFilter === key ? color : colors.foreground }]}>{label}</Text>
                  {elemFilter === key && <Feather name="check" size={14} color={color} />}
                </TouchableOpacity>
              ))}
              {filterModalOpen === 'rarity' && RARITY_FILTERS.map(({ key, label }) => {
                const c = key ? (RARITY_COLORS[key as keyof typeof RARITY_COLORS] ?? '#888') : '#6b7280';
                return (
                  <TouchableOpacity
                    key={key}
                    style={[st.modalOption, { borderColor: rarityFilter === key ? c : colors.border, backgroundColor: rarityFilter === key ? c + '22' : colors.background }]}
                    onPress={() => { setRarityFilter(rarityFilter === key ? '' : key); setFilterModalOpen(null); }}
                  >
                    <Text style={[st.modalOptionText, { color: rarityFilter === key ? c : colors.foreground }]}>{label}</Text>
                    {rarityFilter === key && <Feather name="check" size={14} color={c} />}
                  </TouchableOpacity>
                );
              })}
              {filterModalOpen === 'attr' && ATTR_FILTERS.map(({ key, label, color }) => (
                <TouchableOpacity
                  key={key}
                  style={[st.modalOption, { borderColor: attrFilter === key ? color : colors.border, backgroundColor: attrFilter === key ? color + '22' : colors.background }]}
                  onPress={() => { setAttrFilter(attrFilter === key ? '' : key); setFilterModalOpen(null); }}
                >
                  <Text style={[st.modalOptionText, { color: attrFilter === key ? color : colors.foreground }]}>{label}</Text>
                  {attrFilter === key && <Feather name="check" size={14} color={color} />}
                </TouchableOpacity>
              ))}
            </View>
            {activeFiltersCount > 0 && (
              <TouchableOpacity
                onPress={() => { setAttrFilter(''); setRarityFilter(''); setElemFilter(''); setFilterModalOpen(null); }}
                style={[st.modalClearBtn, { borderColor: '#ef4444', backgroundColor: '#ef444422' }, pixelStyle]}
              >
                <Feather name="x" size={13} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>{t('banco.clearFilters')} ({activeFiltersCount})</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Count row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 4 }}>
        <Text style={[st.countText, { color: colors.mutedForeground, flex: 1 }]}>
          {ownedSet.size}/{totalCount} {t('banco.obtained')} · {filtered.length} {t('banco.shown')}
          {!customCharsReady && ` · ${t('banco.loading')}`}
        </Text>
        {activeFiltersCount > 0 && (
          <TouchableOpacity onPress={() => { setAttrFilter(''); setRarityFilter(''); setElemFilter(''); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#ef444422', borderWidth: 1, borderColor: '#ef4444' }}>
            <Feather name="x" size={11} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '700' }}>{t('banco.clear')} ({activeFiltersCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Detail bottom sheet modal */}
      {selected && (() => {
        const item = selected;
        const rarity = item.char.rarity as keyof typeof RARITY_COLORS;
        const rarityColor = RARITY_COLORS[rarity] ?? '#888';
        const ownedDigimon = collection.find((c) => c.characterId === item.id);
        const isInactive = !item.isActive;
        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}>
            <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setSelected(null)}>
              <View style={[st.detailSheet, { backgroundColor: colors.card }, pixelStyle]}>
                <View style={[st.modalHandle, { backgroundColor: colors.border }]} />

                {/* Header: avatar + name + status */}
                <View style={st.detailHeader}>
                  <View style={[st.detailAvatarWrap, !item.isOwned && st.avatarGray]}>
                    <CharacterAvatar characterId={item.id} size={72} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={[st.detailName, { color: colors.foreground }]}>{item.char.name}</Text>
                      <Text style={{ fontSize: 18 }}>{item.isOwned ? '✅' : '🔒'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <View style={[st.rarityBadge, { backgroundColor: rarityColor + '33', borderColor: rarityColor }, pixelStyle]}>
                        <Text style={[st.rarityText, { color: rarityColor }]}>{RARITY_LABELS[rarity]}</Text>
                      </View>
                      {ownedDigimon && (
                        <View style={[st.rarityBadge, { backgroundColor: '#22c55e22', borderColor: '#22c55e' }, pixelStyle]}>
                          <Text style={[st.rarityText, { color: '#22c55e' }]}>Lv {ownedDigimon.level}</Text>
                        </View>
                      )}
                      {isAdmin && isInactive && (
                        <View style={[st.rarityBadge, { backgroundColor: '#ef444422', borderColor: '#ef4444' }, pixelStyle]}>
                          <Text style={[st.rarityText, { color: '#ef4444' }]}>INATIVO</Text>
                        </View>
                      )}
                    </View>
                    {item.char.rarity !== 'EGG' && (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <AttributeBadge attr={item.char.attribute as any} />
                        <ElementBadge elem={item.char.element as any} />
                      </View>
                    )}
                  </View>

                  {isAdmin && item.isCustom && (
                    <TouchableOpacity
                      onPress={() => {
                        const d = customDigimons.find(c => c.id === item.id);
                        if (d && (d as any).dbId) handleToggleBanco((d as any).dbId);
                      }}
                      style={[st.toggleBadge, {
                        backgroundColor: item.isActive ? '#22c55e22' : '#ef444422',
                        borderColor: item.isActive ? '#22c55e' : '#ef4444',
                      }, pixelStyle]}
                    >
                      <Text style={{ color: item.isActive ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: '800' }}>
                        {item.isActive ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[st.divider, { backgroundColor: colors.border, marginVertical: 10 }]} />

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                  {/* Obtain methods */}
                  <Text style={[st.detailSectionTitle, { color: colors.mutedForeground }]}>Como obter</Text>
                  {item.methods.length === 0 ? (
                    <View style={st.methodRow}>
                      <Text style={st.methodIcon}>🚫</Text>
                      <Text style={[st.methodLabel, { color: colors.mutedForeground }]}>{t('banco.unavailable')}</Text>
                    </View>
                  ) : (
                    item.methods.map((m, i) => {
                      const { icon, label, color } = renderMethodLabel(m);
                      return (
                        <View key={i} style={st.methodRow}>
                          <Text style={st.methodIcon}>{icon}</Text>
                          <Text style={[st.methodLabel, { color }]} numberOfLines={2}>{label}</Text>
                        </View>
                      );
                    })
                  )}

                  {/* Description */}
                  {!!item.char.description && (
                    <Text style={[st.description, { color: colors.mutedForeground, marginTop: 10 }]}>
                      {item.char.description}
                    </Text>
                  )}
                </ScrollView>

                {/* Árvore Evolutiva button */}
                <TouchableOpacity
                  style={[st.evoTreeBtn, { borderColor: '#06b6d4' }, pixelStyle]}
                  onPress={() => { setSelected(null); router.push(`/evo-tree/${item.id}` as any); }}
                  activeOpacity={0.85}
                >
                  <Image source={require('@/assets/images/evo-tree-icon.webp')} style={{ width: 18, height: 18 }} />
                  <Text style={[st.evoTreeBtnText, { color: '#06b6d4' }]}>Árvore Evolutiva</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        );
      })()}

      {!customCharsReady && entries.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={{ gap: 6 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 10, paddingBottom: 40, gap: 6 }}
          ListFooterComponent={
            <View style={{ marginTop: 8 }}>
              {SCANNABLE_CHARACTERS
                .filter((charId) => !collection.some((c) => c.characterId === charId))
                .filter((charId) => {
                  const q = search.trim().toLowerCase();
                  if (!q) return true;
                  const char = CHARACTERS[charId];
                  return char ? char.name.toLowerCase().includes(q) : true;
                })
                .map((charId) => {
                  const scan = scanProgress[charId] ?? 0;
                  return (
                    <ScanCard
                      key={charId}
                      characterId={charId}
                      scanPct={scan}
                      onCreate={() => createFromScan(charId)}
                    />
                  );
                })
              }
              {SCANNABLE_CHARACTERS.some((charId) => !collection.some((c) => c.characterId === charId)) && (
                <View style={[st.scanInfoBanner, { backgroundColor: colors.card, borderColor: colors.border }, pixelStyle]}>
                  <Text style={[st.scanInfoText, { color: colors.mutedForeground }]}>
                    {t('banco.scanInfo')}
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const rarity = item.char.rarity as keyof typeof RARITY_COLORS;
            const rarityColor = RARITY_COLORS[rarity] ?? '#888';
            const isInactive = !item.isActive;
            const ownedDigimon = collection.find((c) => c.characterId === item.id);

            return (
              <TouchableOpacity
                style={[
                  st.gridCard,
                  { borderColor: colors.border, borderWidth: 1 },
                  isInactive && { opacity: 0.55 },
                  pixelStyle,
                ]}
                onPress={() => setSelected(item)}
                activeOpacity={0.8}
              >
                {/* LV badge — top right */}
                <View style={st.lvBadge}>
                  {ownedDigimon ? (
                    <Text style={[st.lvText, { color: rarityColor }]}>Lv{ownedDigimon.level}</Text>
                  ) : (
                    <Text style={[st.lvText, { color: colors.mutedForeground }]}>—</Text>
                  )}
                </View>

                {/* Avatar */}
                <View style={[st.gridAvatarWrap, !item.isOwned && st.avatarGray]}>
                  <CharacterAvatar characterId={item.id} size={60} />
                </View>

                {/* Attr + Element */}
                {item.char.rarity !== 'EGG' && (
                  <View style={st.gridBadgeRow}>
                    <AttributeBadge attr={item.char.attribute as any} />
                    <ElementBadge elem={item.char.element as any} />
                  </View>
                )}

                {/* Name */}
                <Text
                  style={[st.gridName, { color: item.isOwned ? colors.foreground : colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {item.char.name}
                </Text>

              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function styles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'ios' ? 54 : 16,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 10,
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      fontSize: 12,
      padding: 0,
    },
    filterBtnRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 6,
    },
    filterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      paddingBottom: 32,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 12,
      textAlign: 'center',
    },
    modalOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    modalOptionText: {
      fontSize: 13,
      fontWeight: '600',
    },
    modalClearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    toggleBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    countText: {
      fontSize: 11,
    },
    gridCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 10,
      overflow: 'hidden',
      alignItems: 'center',
      paddingBottom: 0,
    },
    topAccent: {
      height: 3,
      width: '100%',
    },
    bottomAccent: {
      height: 3,
      width: '100%',
      marginTop: 6,
    },
    lvBadge: {
      alignSelf: 'flex-end',
      paddingHorizontal: 5,
      paddingTop: 3,
    },
    lvText: {
      fontSize: 9,
      fontWeight: '800',
    },
    gridAvatarWrap: {
      marginTop: 2,
      marginBottom: 4,
      borderRadius: 6,
      overflow: 'visible',
    },
    avatarGray: {
      filter: 'grayscale(1)' as any,
      opacity: 0.6,
    },
    gridBadgeRow: {
      flexDirection: 'row',
      gap: 3,
      marginBottom: 4,
      flexWrap: 'wrap',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    gridName: {
      fontSize: 9,
      fontWeight: '700',
      textAlign: 'center',
      paddingHorizontal: 4,
    },

    detailSheet: {
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 4,
    },
    detailAvatarWrap: {
      borderRadius: 10,
      overflow: 'visible',
    },
    detailName: {
      fontSize: 16,
      fontWeight: '800',
    },
    detailSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },

    rarityBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 1,
    },
    rarityText: {
      fontSize: 10,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      marginBottom: 8,
    },
    methodRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginBottom: 4,
    },
    methodIcon: {
      fontSize: 12,
      lineHeight: 20,
    },
    methodLabel: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 20,
      flex: 1,
    },
    description: {
      fontSize: 11,
      lineHeight: 16,
      fontStyle: 'italic',
    },
    evoTreeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    evoTreeBtnText: { fontSize: 13, fontWeight: '700' as const },
    scanInfoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginTop: 8,
    },
    scanInfoText: {
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
  });
}
