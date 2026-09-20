import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Modal, Pressable, Animated, Image, Easing, FlatList,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame, OwnedCharacter, SacrificeResult } from '@/context/GameContext';
import {
  CHARACTERS, EVOLUTIONS, ALTERNATE_EVOLUTIONS, EXTRA_ALTERNATE_EVOLUTIONS, FORM_CHANGES,
  RARITY_COLORS, RARITY_LABELS,
  SACRIFICE_DROPS, ROOKIE_OF, SACRIFICE_SCAN_OVERRIDES, SACRIFICE_SCAN_PCT, ITEM_NAMES, TAMERS,
} from '@/constants/gameData';
import { getCharacter, getCharacterImageSource } from '@/constants/extendedCharacters';
import { pixelStyle } from '@/constants/pixelStyle';
import { CharacterCard, LockedCard, CharacterAvatar, AttributeBadge, ElementBadge } from '@/components/GameComponents';
import { useLanguage } from '@/context/LanguageContext';

const DIGIVO_GIF       = require('../../assets/images/digivolution.webp');
const DIGIVO_INTRO_GIF = require('../../assets/images/digivolution_intro.webp');
const OMEGAMON_GIF          = require('../../assets/images/omegamon_digivolve.webp');
const SHINEGREYMON_BM_GIF   = require('../../assets/images/characters/shinegreymonbm_special.webp');
const ROSEMON_BM_GIF        = require('../../assets/images/characters/rosemonBurstMode_status.webp');
const IMPERIALDRAMON_PM_GIF = require('../../assets/images/characters/imperialDramonPM_status.webp');


type EvoPhase = 'playing' | 'reveal' | 'done';

const DIGIVICE_IMG   = require('../../assets/images/digivice.webp');
const LENS_FLARE_IMG = require('../../assets/images/lens-flare.webp');

// ─── Animated digivice evolution indicator ────────────────────────────────────
function DigiviceEvoIndicator({ tintColor }: { tintColor?: string }) {
  const spin   = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(1)).current;
  const rock   = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: false }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2,  duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.85, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rock, { toValue: 1,    duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(rock, { toValue: -1,   duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(rock, { toValue: 0.5,  duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(rock, { toValue: -0.5, duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(rock, { toValue: 0,    duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.delay(1200),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(bounce, { toValue: 0,  duration: 150, easing: Easing.in(Easing.quad),  useNativeDriver: false }),
        Animated.delay(2000),
      ])
    ).start();
  }, []);

  const spinDeg    = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateDeg  = rock.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-12deg', '0deg', '12deg'] });
  const translateY = bounce.interpolate({ inputRange: [-1, 0], outputRange: [-4, 0] });

  return (
    <View style={digiviceStyles.wrap}>
      <Animated.Image
        source={LENS_FLARE_IMG}
        tintColor={tintColor ?? '#f59e0b'}
        style={[digiviceStyles.flare, { transform: [{ rotate: spinDeg }, { scale: pulse }] }]}
        resizeMode="contain"
      />
      <Animated.Image
        source={DIGIVICE_IMG}
        style={[digiviceStyles.digivice, { transform: [{ rotate: rotateDeg }, { translateY }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const digiviceStyles = StyleSheet.create({
  wrap:     { position: 'absolute', top: 2, left: 2, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  flare:    { position: 'absolute', width: 36, height: 36, opacity: 0.45 },
  digivice: { width: 14, height: 14 },
});

// ─── Grid card component (must be outside CollectionScreen for hooks) ─────────
interface DigiGridCardProps {
  owned: OwnedCharacter;
  isSelected: boolean;
  canEvolve: boolean;
  tamerAccent?: string;
  onPress: () => void;
}

function DigiGridCard({ owned, isSelected, canEvolve, tamerAccent, onPress }: DigiGridCardProps) {
  const colors = useColors();
  const char = getCharacter(owned.characterId) ?? CHARACTERS[owned.characterId];
  if (!char) return null;
  const rarityColor = RARITY_COLORS[char.rarity as keyof typeof RARITY_COLORS] ?? '#888';
  return (
    <TouchableOpacity
      style={[
        gridCardStyles.card,
        { borderColor: isSelected ? colors.primary : colors.border, borderWidth: isSelected ? 2 : 1 },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={gridCardStyles.lvBadge}>
        <Text style={[gridCardStyles.lvText, { color: rarityColor }]}>Lv{owned.level}</Text>
      </View>
      {canEvolve && <DigiviceEvoIndicator tintColor={tamerAccent} />}
      <CharacterAvatar characterId={owned.characterId} size={60} />
      {char.rarity !== 'EGG' && (
        <View style={gridCardStyles.badgeRow}>
          <AttributeBadge attr={char.attribute} />
          <ElementBadge elem={char.element} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const gridCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  lvBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 5,
    paddingTop: 3,
  },
  lvText: {
    fontSize: 9,
    fontWeight: '800' as const,
  },
  evoBadge: {
    position: 'absolute' as const,
    top: 3,
    left: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  evoBadgeText: {
    fontSize: 8,
    color: '#000',
    fontWeight: '900' as const,
  },
  badgeRow: {
    flexDirection: 'row' as const,
    gap: 3,
    marginTop: 2,
    marginBottom: 4,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  name: {
    fontSize: 9,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    paddingHorizontal: 4,
  },
  bottomAccent: {
    height: 3,
    width: '100%',
    marginTop: 6,
  },
});

export default function CollectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { collection, selectedCharacter, setSelectedCharacter, evolveDigimon, changeFormDigimon, pieces, sacrificeDigimon, isAdmin, tamerId } = useGame();
  const tamerAccent = TAMERS.find(t => t.id === tamerId)?.accentColor;

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const DIGIBANK_LIMIT = 500;
  const ownedCount = collection.length;

  const [digiTab, setDigiTab] = useState<'digimons' | 'eggs'>('digimons');

  const digimons = collection.filter(owned => {
    const char = getCharacter(owned.characterId) ?? CHARACTERS[owned.characterId];
    return char?.rarity !== 'EGG';
  });
  const eggs = collection.filter(owned => {
    const char = getCharacter(owned.characterId) ?? CHARACTERS[owned.characterId];
    return char?.rarity === 'EGG';
  });
  const activeCollection = digiTab === 'digimons' ? digimons : eggs;

  // Modal state
  const [modalOwned, setModalOwned] = useState<OwnedCharacter | null>(null);
  const [confirmSacrificeVisible, setConfirmSacrificeVisible] = useState(false);
  const [sacrificeResult, setSacrificeResult] = useState<SacrificeResult | null>(null);

  // Alt-evo sacrifice picker
  const [sacrificePickerVisible, setSacrificePickerVisible] = useState(false);
  const [pendingAltEvo, setPendingAltEvo] = useState<{ ownedId: string; fromCharId: string; toCharId: string } | null>(null);

  // Evolution animation state
  const [evoAnim, setEvoAnim] = useState<{ fromCharId: string; toCharId: string } | null>(null);
  const [evoPhase, setEvoPhase] = useState<EvoPhase>('playing');
  const fromOpacity   = useRef(new Animated.Value(1)).current;
  const newFormOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.7)).current;

  function openModal(owned: OwnedCharacter) {
    setModalOwned(owned);
  }

  function closeModal() {
    setModalOwned(null);
  }

  const handleEvolve = useCallback((ownedId: string, fromCharId: string, toCharId: string, alternate?: boolean, sacrificeOwnedId?: string, alternate2?: boolean) => {
    closeModal();
    setSacrificePickerVisible(false);
    setPendingAltEvo(null);
    fromOpacity.setValue(1);
    newFormOpacity.setValue(0);
    titleScale.setValue(0.7);
    setEvoPhase('playing');
    setEvoAnim({ fromCharId, toCharId });
    evolveDigimon(ownedId, alternate, sacrificeOwnedId, alternate2);
  }, [evolveDigimon]);

  // Drive the animation phases
  useEffect(() => {
    if (!evoAnim) return;

    if (evoPhase === 'playing') {
      // Intro GIF is 5.20s — wait for it to finish, then crossfade forms
      const t = setTimeout(() => setEvoPhase('reveal'), 5200);
      return () => clearTimeout(t);
    }

    if (evoPhase === 'reveal') {
      Animated.parallel([
        Animated.timing(fromOpacity,    { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.timing(newFormOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(titleScale,     { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]).start(() => setEvoPhase('done'));
    }
  }, [evoAnim, evoPhase]);

  // Computed evolution info for modal
  const modalEvo       = modalOwned ? EVOLUTIONS[modalOwned.characterId] : undefined;
  const hasReqItem     = !modalEvo?.requiredItem || (pieces[modalEvo.requiredItem] ?? 0) > 0;
  const modalCanEvolve = !!(modalOwned && modalEvo && modalOwned.level >= modalEvo.requiredLevel && hasReqItem);
  const modalEvoChar   = modalEvo ? (getCharacter(modalEvo.evolvesTo) ?? CHARACTERS[modalEvo.evolvesTo]) : undefined;

  const modalFormChangeId      = modalOwned ? (FORM_CHANGES[modalOwned.characterId] ?? null) : null;
  const modalFormChangeChar    = modalFormChangeId ? (getCharacter(modalFormChangeId) ?? CHARACTERS[modalFormChangeId]) : null;

  const modalAltEvo            = modalOwned ? ALTERNATE_EVOLUTIONS[modalOwned.characterId] : undefined;
  const hasAltReqItem          = !modalAltEvo?.requiredItem || (pieces[modalAltEvo.requiredItem] ?? 0) > 0;
  const altSacrificeCharId     = modalAltEvo?.requiredSacrificeCharacter;
  const altSacrificeCharIds    = (modalAltEvo as any)?.requiredSacrificeCharacters as string[] | undefined;
  const altSacrificeChar       = altSacrificeCharId ? (getCharacter(altSacrificeCharId) ?? CHARACTERS[altSacrificeCharId]) : undefined;
  const altSacrificeCopies     = altSacrificeCharId
    ? collection.filter((c) => c.ownedId !== modalOwned?.ownedId && c.characterId === altSacrificeCharId)
    : [];
  // Multi-sacrifice: all required characters must exist in collection
  const hasAltMultiSacrifice   = !altSacrificeCharIds || altSacrificeCharIds.length === 0
    ? true
    : altSacrificeCharIds.every((cid) => collection.some((c) => c.ownedId !== modalOwned?.ownedId && c.characterId === cid));
  const hasAltSacrifice        = altSacrificeCharIds && altSacrificeCharIds.length > 0
    ? hasAltMultiSacrifice
    : (!altSacrificeCharId || altSacrificeCopies.length > 0);
  const modalCanAltEvolve = !!(modalOwned && modalAltEvo && modalOwned.level >= modalAltEvo.requiredLevel && hasAltReqItem && hasAltSacrifice);
  const modalAltEvoChar   = modalAltEvo ? (getCharacter(modalAltEvo.evolvesTo) ?? CHARACTERS[modalAltEvo.evolvesTo]) : undefined;

  // ── Extra Alternate Evolution (alt2) ──────────────────────────────────────
  const modalAlt2Evo          = modalOwned ? EXTRA_ALTERNATE_EVOLUTIONS[modalOwned.characterId] : undefined;
  const hasAlt2ReqItem        = !modalAlt2Evo?.requiredItem || (pieces[modalAlt2Evo.requiredItem] ?? 0) > 0;
  const modalCanAlt2Evolve    = !!(modalOwned && modalAlt2Evo && modalOwned.level >= modalAlt2Evo.requiredLevel && hasAlt2ReqItem);
  const modalAlt2EvoChar      = modalAlt2Evo ? (getCharacter(modalAlt2Evo.evolvesTo) ?? CHARACTERS[modalAlt2Evo.evolvesTo]) : undefined;

  // Sacrifice info for current modal character
  const modalChar = modalOwned ? (getCharacter(modalOwned.characterId) ?? CHARACTERS[modalOwned.characterId] ?? null) : null;
  const sacrificeDrops = modalOwned ? (SACRIFICE_DROPS[modalOwned.characterId] ?? []) : [];
  const sacrificeOverride = modalOwned ? SACRIFICE_SCAN_OVERRIDES[modalOwned.characterId] : undefined;
  const sacrificeRookieId = modalOwned ? (ROOKIE_OF[modalOwned.characterId] ?? null) : null;
  const sacrificeScanPct  = modalChar ? (SACRIFICE_SCAN_PCT[modalChar.rarity] ?? 0) : 0;
  const canSacrifice = !!(modalChar && modalChar.rarity !== 'COMMON');

  const toChar = evoAnim ? (getCharacter(evoAnim.toCharId) ?? CHARACTERS[evoAnim.toCharId]) : null;
  const fromChar = evoAnim ? (getCharacter(evoAnim.fromCharId) ?? CHARACTERS[evoAnim.fromCharId]) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{t('collection.title')}</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary }, pixelStyle]}>
          <Text style={[styles.countText, { color: colors.primary }]}>{ownedCount} / {DIGIBANK_LIMIT}</Text>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, digiTab === 'digimons' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setDigiTab('digimons')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, { color: digiTab === 'digimons' ? colors.primary : colors.mutedForeground }]}>
            Digimons {digimons.length > 0 ? `(${digimons.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, digiTab === 'eggs' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setDigiTab('eggs')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, { color: digiTab === 'eggs' ? colors.primary : colors.mutedForeground }]}>
            Ovos {eggs.length > 0 ? `(${eggs.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeCollection}
        keyExtractor={(item) => item.ownedId}
        numColumns={3}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomPad + 40 }]}
        columnWrapperStyle={{ gap: 6 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews={true}
        renderItem={({ item: owned }) => {
          const evo = EVOLUTIONS[owned.characterId];
          const canEvolve = !!(evo && owned.level >= evo.requiredLevel);
          return (
            <DigiGridCard
              owned={owned}
              isSelected={selectedCharacter?.ownedId === owned.ownedId}
              canEvolve={canEvolve}
              tamerAccent={tamerAccent}
              onPress={() => openModal(owned)}
            />
          );
        }}
      />

      {/* ── Evolution Modal ── */}
      <Modal
        visible={modalOwned !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }, pixelStyle]}
            onPress={(e) => e.stopPropagation()}
          >
            {modalOwned && (() => {
              const char = getCharacter(modalOwned.characterId) ?? CHARACTERS[modalOwned.characterId];
              const rarityColor = char ? RARITY_COLORS[char.rarity as keyof typeof RARITY_COLORS] : colors.primary;
              // Only show alt evo if its target is different from the primary evo target
              const showAltEvo = !!(modalAltEvo && modalAltEvoChar && modalAltEvo.evolvesTo !== modalEvo?.evolvesTo);

              return (
                <>
                  {/* Handle bar */}
                  <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

                  {/* Avatar + Name + Level */}
                  <View style={styles.sheetHero}>
                    {(() => {
                      const mImg = getCharacterImageSource(modalOwned.characterId);
                      const hasMApiUri = mImg && typeof mImg === 'object' && 'uri' in mImg;
                      if (hasMApiUri) {
                        return (
                          <ExpoImage
                            source={mImg}
                            style={{ width: 90, height: 90 }}
                            contentFit="contain"
                            autoplay
                          />
                        );
                      }
                      return <CharacterAvatar characterId={modalOwned.characterId} size={72} />;
                    })()}
                    <View style={styles.sheetHeroText}>
                      <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                        {char?.name ?? modalOwned.characterId}
                      </Text>
                      <View style={styles.sheetSubRow}>
                        <Text style={[styles.sheetSub, { color: rarityColor }]}>Lv {modalOwned.level}</Text>
                        <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                          {' '}· {char ? RARITY_LABELS[char.rarity] : ''}
                        </Text>
                      </View>
                      {char && (
                        <View style={styles.sheetBadgeRow}>
                          <AttributeBadge attr={char.attribute} />
                          <ElementBadge elem={char.element} />
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {/* Evolution row */}
                  {modalEvo && modalEvoChar ? (
                    modalCanEvolve ? (
                      <TouchableOpacity
                        style={[styles.evoRow, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (!modalOwned || !modalEvo) return;
                          handleEvolve(modalOwned.ownedId, modalOwned.characterId, modalEvo.evolvesTo);
                        }}
                      >
                        <Feather name="arrow-up-circle" size={18} color="#f59e0b" />
                        <Text style={[styles.evoRowText, { color: '#f59e0b' }]}>
                          {t('collection.evolveBtn')} {modalEvo.label}
                        </Text>
                        <CharacterAvatar characterId={modalEvo.evolvesTo} size={32} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.evoRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Feather name="lock" size={16} color={colors.mutedForeground} />
                        <Text style={[styles.evoRowText, { color: colors.mutedForeground, flex: 1 }]}>
                          → {modalEvoChar.name}
                          {' · Lv '}{modalEvo.requiredLevel}
                          {modalEvo.requiredItem ? `  · ${ITEM_NAMES[modalEvo.requiredItem] ?? modalEvo.requiredItem}` : ''}
                        </Text>
                        <CharacterAvatar characterId={modalEvo.evolvesTo} size={32} />
                      </View>
                    )
                  ) : (
                    <View style={[styles.evoRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Feather name="check-circle" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.evoRowText, { color: colors.mutedForeground }]}>{t('collection.finalForm')}</Text>
                    </View>
                  )}

                  {/* Alt evo row (only if different target) */}
                  {showAltEvo && (
                    modalCanAltEvolve ? (
                      <TouchableOpacity
                        style={[styles.evoRow, { backgroundColor: '#a855f722', borderColor: '#a855f7' }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (!modalOwned || !modalAltEvo) return;
                          if (altSacrificeCharIds && altSacrificeCharIds.length > 0) {
                            // Multi-sacrifice: GameContext auto-finds all sacrifices, no picker needed
                            handleEvolve(modalOwned.ownedId, modalOwned.characterId, modalAltEvo.evolvesTo, true);
                          } else if (altSacrificeCharId) {
                            setPendingAltEvo({ ownedId: modalOwned.ownedId, fromCharId: modalOwned.characterId, toCharId: modalAltEvo.evolvesTo });
                            setSacrificePickerVisible(true);
                          } else {
                            handleEvolve(modalOwned.ownedId, modalOwned.characterId, modalAltEvo.evolvesTo, true);
                          }
                        }}
                      >
                        <Feather name="arrow-up-circle" size={18} color="#a855f7" />
                        <Text style={[styles.evoRowText, { color: '#a855f7' }]}>
                          {t('collection.evolveBtn')} {modalAltEvo!.label}
                        </Text>
                        <CharacterAvatar characterId={modalAltEvo!.evolvesTo} size={32} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.evoRow, { backgroundColor: colors.background, borderColor: '#a855f744' }]}>
                        <Feather name="lock" size={16} color="#a855f7" />
                        <Text style={[styles.evoRowText, { color: colors.mutedForeground, flex: 1 }]}>
                          → {modalAltEvoChar!.name}
                          {' · Lv '}{modalAltEvo!.requiredLevel}
                          {altSacrificeCharIds && altSacrificeCharIds.length > 0
                            ? `  · ⚔️ ${altSacrificeCharIds.map((cid) => {
                                const c = getCharacter(cid) ?? CHARACTERS[cid];
                                return c ? c.name : cid;
                              }).join(', ')}`
                            : altSacrificeChar ? `  · ⚔️ ${altSacrificeChar.name}` : ''}
                          {modalAltEvo!.requiredItem ? `  · ${ITEM_NAMES[modalAltEvo!.requiredItem] ?? modalAltEvo!.requiredItem}` : ''}
                        </Text>
                        <CharacterAvatar characterId={modalAltEvo!.evolvesTo} size={32} />
                      </View>
                    )
                  )}

                  {/* Alt2 evo row — extra alternate evolution (e.g. Black Digitron) */}
                  {modalAlt2Evo && modalAlt2EvoChar && (
                    modalCanAlt2Evolve ? (
                      <TouchableOpacity
                        style={[styles.evoRow, { backgroundColor: '#0f172a', borderColor: '#6366f1' }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (!modalOwned || !modalAlt2Evo) return;
                          handleEvolve(modalOwned.ownedId, modalOwned.characterId, modalAlt2Evo.evolvesTo, false, undefined, true);
                        }}
                      >
                        <Feather name="arrow-up-circle" size={18} color="#6366f1" />
                        <Text style={[styles.evoRowText, { color: '#6366f1' }]}>
                          Evoluir → {modalAlt2Evo.label}
                        </Text>
                        <CharacterAvatar characterId={modalAlt2Evo.evolvesTo} size={32} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.evoRow, { backgroundColor: colors.background, borderColor: '#6366f144' }]}>
                        <Feather name="lock" size={16} color="#6366f1" />
                        <Text style={[styles.evoRowText, { color: colors.mutedForeground, flex: 1 }]}>
                          → {modalAlt2EvoChar.name}
                          {' · Lv '}{modalAlt2Evo.requiredLevel}
                          {modalAlt2Evo.requiredItem ? `  · ${ITEM_NAMES[modalAlt2Evo.requiredItem] ?? modalAlt2Evo.requiredItem}` : ''}
                        </Text>
                        <CharacterAvatar characterId={modalAlt2Evo.evolvesTo} size={32} />
                      </View>
                    )
                  )}

                  {/* Form change row */}
                  {modalFormChangeId && modalFormChangeChar && (
                    <TouchableOpacity
                      style={[styles.evoRow, { backgroundColor: '#06b6d422', borderColor: '#06b6d4' }]}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (!modalOwned) return;
                        changeFormDigimon(modalOwned.ownedId);
                        closeModal();
                      }}
                    >
                      <Feather name="refresh-cw" size={16} color="#06b6d4" />
                      <Text style={[styles.evoRowText, { color: '#06b6d4', flex: 1 }]}>
                        {t('collection.changeTo')} {modalFormChangeChar.name}
                      </Text>
                      <CharacterAvatar characterId={modalFormChangeId} size={32} />
                    </TouchableOpacity>
                  )}

                  {/* Sacrifice row */}
                  {canSacrifice && (
                    <TouchableOpacity
                      style={[styles.evoRow, { backgroundColor: '#ef444408', borderColor: '#ef444433' }]}
                      activeOpacity={0.8}
                      onPress={() => setConfirmSacrificeVisible(true)}
                    >
                      <Feather name="trash-2" size={15} color="#ef4444" />
                      <Text style={[styles.evoRowText, { color: '#ef4444', flex: 1 }]}>
                        {t('collection.sacrificeBtn')}
                        {(sacrificeOverride || sacrificeRookieId) && (
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                            {' '}(+{Math.round((sacrificeOverride?.percent ?? sacrificeScanPct) * 100)}% scan)
                          </Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Divider */}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {/* Actions */}
                  <TouchableOpacity
                    style={[styles.setActiveBtn, { backgroundColor: colors.primary }, pixelStyle]}
                    onPress={() => {
                      setSelectedCharacter(modalOwned.ownedId);
                      closeModal();
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name="star" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.setActiveBtnText, { color: colors.primaryForeground }]}>{t('collection.setActive')}</Text>
                  </TouchableOpacity>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.detailBtn, { borderColor: colors.border }, pixelStyle]}
                      onPress={() => { closeModal(); router.push(`/character/${modalOwned.ownedId}`); }}
                    >
                      <Feather name="info" size={15} color={colors.foreground} />
                      <Text style={[styles.detailBtnText, { color: colors.foreground }]}>{t('collection.details')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.closeBtn, { borderColor: colors.border }, pixelStyle]}
                      onPress={closeModal}
                    >
                      <Text style={[styles.closeBtnText, { color: colors.mutedForeground }]}>{t('common.close')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Digivolution Animation Overlay ── */}
      <Modal
        visible={evoAnim !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { if (evoPhase === 'done') setEvoAnim(null); }}
      >
        <Pressable
          style={styles.evoOverlay}
          onPress={() => { if (evoPhase === 'done') setEvoAnim(null); }}
        >
          {/* GIF background — intro during 'playing', reveal GIF after */}
          <Image
            source={
              evoPhase === 'playing'
                ? (evoAnim?.toCharId === 'omegamon' ? OMEGAMON_GIF : evoAnim?.toCharId === 'shineGreymonBurstMode' ? SHINEGREYMON_BM_GIF : evoAnim?.toCharId === 'rosemonBurstMode' ? ROSEMON_BM_GIF : evoAnim?.toCharId === 'imperialDramonPM' ? IMPERIALDRAMON_PM_GIF : DIGIVO_INTRO_GIF)
                : (evoAnim?.toCharId === 'omegamon' ? OMEGAMON_GIF : evoAnim?.toCharId === 'shineGreymonBurstMode' ? SHINEGREYMON_BM_GIF : evoAnim?.toCharId === 'rosemonBurstMode' ? ROSEMON_BM_GIF : evoAnim?.toCharId === 'imperialDramonPM' ? IMPERIALDRAMON_PM_GIF : DIGIVO_GIF)
            }
            style={styles.evoGifBg}
            resizeMode="cover"
          />
          <View style={styles.evoOverlayDim} />

          {/* Content */}
          <View style={styles.evoContent} pointerEvents="none">
            {(evoPhase === 'reveal' || evoPhase === 'done') && evoAnim && (
              <>
                {/* Crossfade: old form fades out, new form fades in */}
                <View style={styles.evoAvatarWrap}>
                  <Animated.View style={[StyleSheet.absoluteFill, { opacity: fromOpacity, alignItems: 'center', justifyContent: 'center' }]}>
                    <CharacterAvatar characterId={evoAnim.fromCharId} size={140} />
                  </Animated.View>
                  <Animated.View style={{ opacity: newFormOpacity }}>
                    <CharacterAvatar characterId={evoAnim.toCharId} size={140} />
                  </Animated.View>
                </View>
                <Animated.Text style={[styles.evoToName, { opacity: newFormOpacity }]}>
                  {toChar?.name ?? ''}
                </Animated.Text>
                {toChar && (
                  <Animated.View style={[styles.evoBadgesRowBig, { opacity: newFormOpacity }]}>
                    <AttributeBadge attr={toChar.attribute} />
                    <ElementBadge elem={toChar.element} />
                  </Animated.View>
                )}
                {evoPhase === 'done' && (
                  <Text style={styles.evoDismiss}>Toque para continuar</Text>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ── Sacrifice Confirm Modal ───────────────────────────────────── */}
      <Modal visible={confirmSacrificeVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.confirmTitle, { color: '#ef4444' }]}>Sacrificar Digimon?</Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
              <Text style={{ fontWeight: '700', color: colors.foreground }}>
                {modalChar?.name}
              </Text>
              {' '}será removido permanentemente da sua DigiBank.{'\n\n'}
              Possíveis recompensas:{'\n'}
              {sacrificeOverride
                ? `• +${Math.round(sacrificeOverride.percent * 100)}% scan de ${CHARACTERS[sacrificeOverride.characterId]?.name}`
                : sacrificeRookieId
                  ? `• +${Math.round(sacrificeScanPct * 100)}% scan de ${CHARACTERS[sacrificeRookieId]?.name ?? sacrificeRookieId}`
                  : '• Sem bônus de scan'}
              {sacrificeDrops.length > 0
                ? `\n• ${Math.round(sacrificeDrops[0].chance * 100)}% de ${ITEM_NAMES[sacrificeDrops[0].itemId] ?? sacrificeDrops[0].itemId}`
                : ''}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: colors.border }]}
                onPress={() => setConfirmSacrificeVisible(false)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSacrificeBtn}
                onPress={() => {
                  if (!modalOwned) return;
                  const result = sacrificeDigimon(modalOwned.ownedId);
                  setConfirmSacrificeVisible(false);
                  setSacrificeResult(result);
                  setModalOwned(null);
                }}
              >
                <Feather name="trash-2" size={15} color="#fff" />
                <Text style={styles.confirmSacrificeText}>Confirmar Sacrifício</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Alt-evo Sacrifice Picker Modal ─────────────────────────────── */}
      <Modal visible={sacrificePickerVisible} transparent animationType="slide" onRequestClose={() => setSacrificePickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSacrificePickerVisible(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.card }, pixelStyle]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              ⚔️ Escolher Sacrifício
            </Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground, marginBottom: 12 }]}>
              {t('collection.pickSacrifice')} {altSacrificeChar?.name}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {altSacrificeCopies.map((copy) => {
                const copyChar = getCharacter(copy.characterId) ?? CHARACTERS[copy.characterId];
                const rc = copyChar ? RARITY_COLORS[copyChar.rarity as keyof typeof RARITY_COLORS] : colors.primary;
                return (
                  <View key={copy.ownedId} style={[styles.sacrificePickerCard, { backgroundColor: colors.background, borderColor: '#a855f755' }, pixelStyle]}>
                    <CharacterAvatar characterId={copy.characterId} size={56} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 14 }}>
                        {copyChar?.name ?? copy.characterId}
                      </Text>
                      <Text style={{ color: rc, fontSize: 12, marginTop: 2 }}>Lv {copy.level}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                        {copyChar ? RARITY_LABELS[copyChar.rarity] : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.sacrificePickerBtn, { backgroundColor: '#a855f7' }, pixelStyle]}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (!pendingAltEvo) return;
                        handleEvolve(pendingAltEvo.ownedId, pendingAltEvo.fromCharId, pendingAltEvo.toCharId, true, copy.ownedId);
                      }}
                    >
                      <Feather name="zap" size={13} color="#fff" />
                      <Text style={styles.sacrificePickerBtnText}>{t('collection.sacrificeBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.evoRow, { borderColor: colors.border, marginTop: 12, justifyContent: 'center' }, pixelStyle]}
              onPress={() => setSacrificePickerVisible(false)}
            >
              <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontWeight: '700' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Sacrifice Result Modal ────────────────────────────────────── */}
      <Modal visible={!!sacrificeResult} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>Resultado do Sacrifício</Text>
            {sacrificeResult?.scanGained && (
              <View style={styles.resultRow}>
                <Feather name="search" size={16} color={colors.primary} />
                <Text style={[styles.resultText, { color: colors.foreground }]}>
                  +{sacrificeResult.scanGained.amount}% scan de{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {CHARACTERS[sacrificeResult.scanGained.characterId]?.name ?? sacrificeResult.scanGained.characterId}
                  </Text>
                </Text>
              </View>
            )}
            {sacrificeResult?.droppedItem && (
              <View style={styles.resultRow}>
                <Feather name="package" size={16} color="#f59e0b" />
                <Text style={[styles.resultText, { color: colors.foreground }]}>
                  Obteve:{' '}
                  <Text style={{ fontWeight: '700', color: '#f59e0b' }}>
                    {ITEM_NAMES[sacrificeResult.droppedItem] ?? sacrificeResult.droppedItem}
                  </Text>
                </Text>
              </View>
            )}
            {!sacrificeResult?.scanGained && !sacrificeResult?.droppedItem && (
              <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
                Nenhuma recompensa desta vez.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.confirmSacrificeBtn, { backgroundColor: colors.primary }]}
              onPress={() => setSacrificeResult(null)}
            >
              <Text style={styles.confirmSacrificeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: Platform.select({ web: 18, default: 20 }), fontWeight: '800' as const },
  countBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 11, fontWeight: '700' as const },
  tabBar: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  list: { paddingHorizontal: Platform.select({ web: 12, default: 20 }), paddingTop: 12 },
  grid: {
    padding: 10,
    gap: 6,
  },

  // ── Grid cards ──────────────────────────────────────────────────────────────
  gridCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    position: 'relative' as const,
  },
  gridLvBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 5,
    paddingTop: 3,
  },
  gridLvText: {
    fontSize: 9,
    fontWeight: '800' as const,
  },
  gridEvoBadge: {
    position: 'absolute' as const,
    top: 3,
    left: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  gridEvoBadgeText: {
    fontSize: 8,
    color: '#000',
    fontWeight: '900' as const,
  },
  gridBadgeRow: {
    flexDirection: 'row' as const,
    gap: 3,
    marginTop: 2,
    marginBottom: 4,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  gridName: {
    fontSize: 9,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    paddingHorizontal: 4,
    marginBottom: 0,
  },
  gridBottomAccent: {
    height: 3,
    width: '100%',
    marginTop: 6,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sheetHeroText: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800' as const },
  sheetSubRow: { flexDirection: 'row', alignItems: 'center' },
  sheetSub: { fontSize: 13, fontWeight: '600' as const },
  sheetBadgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' as const },
  divider: { height: 1, borderRadius: 1 },

  // Compact evo rows
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  evoRowText: { fontSize: 13, fontWeight: '700' as const, flex: 1 },

  setActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  setActiveBtnText: { fontSize: 13, fontWeight: '800' as const },
  modalActions: { flexDirection: 'row', gap: 10 },
  detailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  detailBtnText: { fontSize: 13, fontWeight: '700' as const },
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  closeBtnText: { fontSize: 13, fontWeight: '600' as const },
  // ── Digivolution overlay ──────────────────────────────────────────────────
  evoOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  evoGifBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  evoOverlayDim: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    opacity: 0.35,
  },
  evoContent: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  evoTopLabel: {
    fontSize: 17,
    fontWeight: '900' as const,
    color: '#f59e0b',
    textAlign: 'center',
    letterSpacing: 1.5,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  evoAvatarWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  evoSilhouette: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#000',
  },
  evoFromName: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  evoToName: {
    fontSize: 17,
    fontWeight: '900' as const,
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    textAlign: 'center',
  },
  evoBadgesRowBig: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  evoDismiss: {
    fontSize: 13,
    color: '#ffffff88',
    marginTop: 8,
  },

  // ── Sacrifice section ─────────────────────────────────────────────────────
  sacrificeSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  sacrificeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sacrificeTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  sacrificeDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  sacrificeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
    marginTop: 2,
  },
  sacrificeBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },

  // ── Sacrifice picker card ─────────────────────────────────────────────────
  sacrificePickerCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  sacrificePickerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sacrificePickerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },

  // ── Confirm & result sheets ───────────────────────────────────────────────
  confirmSheet: {
    margin: 24,
    borderRadius: 20,
    padding: 22,
    gap: 14,
    alignSelf: 'center' as const,
    width: '88%',
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
  },
  confirmBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  confirmCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  confirmSacrificeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
  },
  confirmSacrificeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  resultText: {
    fontSize: 12,
    lineHeight: 20,
    flex: 1,
  },
});
