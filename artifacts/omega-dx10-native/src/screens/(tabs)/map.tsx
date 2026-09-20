import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { pixelStyle } from '@/constants/pixelStyle';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/context/GameContext';
import { GAME_MAPS, MapStage, StageDrop } from '@/constants/gameData';
import { useLanguage } from '@/context/LanguageContext';

const STARS_3  = require('../../assets/images/ui/stars3.webp');
const PADLOCK  = require('../../assets/images/ui/padlock.png');

type TabId = 'digimundo' | 'dungeon' | 'eventos';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function StarRating({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Text
          key={i}
          style={{ fontSize: 14, color: '#f59e0b', textShadowColor: '#92400e', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
        >★</Text>
      ))}
    </View>
  );
}

function getMsToMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function isMapAvailableToday(availableDays?: number[]): boolean {
  if (!availableDays || availableDays.length === 0) return true;
  const today = new Date().getDay();
  return availableDays.includes(today);
}

function getNextAvailableDay(availableDays: number[]): string {
  const today = new Date().getDay();
  for (let i = 1; i <= 7; i++) {
    const day = (today + i) % 7;
    if (availableDays.includes(day)) return DAY_NAMES_FULL[day];
  }
  return '';
}

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isStageCleared, isMapUnlocked, selectedCharacter, collection, totalPlayerLevel, isDailyDungeonAvailable, customGameMaps } = useGame();

  const allMaps = [
    ...GAME_MAPS,
    ...customGameMaps.map((m) => ({
      ...m,
      backgroundImage: m.backgroundImageUri ? { uri: m.backgroundImageUri } : undefined,
    })),
  ];

  const worldMaps = allMaps.filter((m) => !m.isDungeon && !(m as any).expiresAt);
  const dungeonMaps = allMaps.filter((m) => m.isDungeon === true);
  const eventMaps = allMaps.filter((m) => !m.isDungeon && (m as any).expiresAt);

  const [activeTab, setActiveTab] = useState<TabId>('digimundo');
  const [expandedMap, setExpandedMap] = useState<string>('map_forest');
  const [countdown, setCountdown] = useState(() => formatCountdown(getMsToMidnight()));

  useEffect(() => {
    const tick = setInterval(() => setCountdown(formatCountdown(getMsToMidnight())), 1000);
    return () => clearInterval(tick);
  }, []);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  function handleStagePress(mapId: string, stageIndex: number, isDaily?: boolean, availableDays?: number[]) {
    if (!selectedCharacter) return;
    if (isDaily && !isDailyDungeonAvailable) return;
    if (!isMapAvailableToday(availableDays)) return;
    router.push(`/battle?mapId=${mapId}&stageIndex=${stageIndex}`);
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'digimundo', label: 'Digimundo', icon: 'globe' },
    { id: 'dungeon',   label: 'Dungeon',   icon: 'shield-off' },
    { id: 'eventos',   label: 'Eventos',   icon: 'star' },
  ];

  const currentMaps =
    activeTab === 'digimundo' ? worldMaps :
    activeTab === 'dungeon'   ? dungeonMaps :
    eventMaps;

  function renderMap(map: typeof allMaps[0]) {
    const unlocked = isMapUnlocked(map.id);
    const expanded = expandedMap === map.id;
    const clearedInMap = map.stages.filter((s: MapStage) => isStageCleared(map.id, s.index)).length;
    const allCleared = clearedInMap === map.stages.length;
    const isDungeon = map.isDungeon === true;
    const isDaily  = map.isDaily === true;
    const dailyDone = isDaily && !isDailyDungeonAvailable;
    const availableDays = (map as any).availableDays as number[] | undefined;
    const hasAvailableDays = availableDays && availableDays.length > 0;
    const availableToday = isMapAvailableToday(availableDays);
    const dayLocked = hasAvailableDays && !availableToday;

    const dungeonBorderColor = isDaily
      ? (isDailyDungeonAvailable ? '#f59e0b' : '#6b7280')
      : hasAvailableDays
        ? (availableToday ? '#f97316' : '#6b7280')
        : '#8b5cf6';

    const borderColor = isDungeon
      ? dungeonBorderColor
      : unlocked ? (allCleared ? '#22c55e' : colors.border) : colors.border + '44';

    const isEvent = !!(map as any).expiresAt;
    const expiresAt = isEvent ? new Date((map as any).expiresAt) : null;

    return (
      <View key={map.id} style={[
        styles.mapCard,
        { borderColor, backgroundColor: isDungeon ? '#1a0f2e' : isEvent ? '#0f1a2e' : colors.card },
        pixelStyle,
        dayLocked && { opacity: 0.7 },
      ]}>
        {isDungeon && !isDaily && !hasAvailableDays && (
          <View style={[styles.dungeonBanner, { backgroundColor: dungeonBorderColor + '33', borderBottomColor: dungeonBorderColor + '55' }]}>
            <Feather name="alert-triangle" size={12} color={dungeonBorderColor} />
            <Text style={[styles.dungeonBannerText, { color: dungeonBorderColor }]}>{t('map.dungeon')}</Text>
          </View>
        )}

        {hasAvailableDays && (
          <View style={[styles.dungeonBanner, { backgroundColor: (availableToday ? '#f97316' : '#6b728066') + '33', borderBottomColor: (availableToday ? '#f97316' : '#6b7280') + '55' }]}>
            <Feather name="calendar" size={12} color={availableToday ? '#f97316' : '#9ca3af'} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.dungeonBannerText, { color: availableToday ? '#f97316' : '#9ca3af' }]}>
                {availableToday ? '🟠 Disponível hoje' : `🔒 Fechado — abre ${getNextAvailableDay(availableDays!)}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 3, marginLeft: 'auto' }}>
                {[0,1,2,3,4,5,6].map((d) => {
                  const active = availableDays!.includes(d);
                  const isToday = new Date().getDay() === d;
                  return (
                    <View key={d} style={[
                      styles.dayPill,
                      { backgroundColor: active ? '#f97316' : '#374151', borderColor: isToday ? '#ffffff66' : 'transparent' },
                    ]}>
                      <Text style={[styles.dayPillText, { color: active ? '#fff' : '#6b7280' }]}>{DAY_NAMES[d]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {isDaily && (
          <View style={[styles.dungeonBanner, { backgroundColor: (isDailyDungeonAvailable ? '#f59e0b' : '#6b728066') + '33', borderBottomColor: (isDailyDungeonAvailable ? '#f59e0b' : '#6b7280') + '55' }]}>
            <Feather name={isDailyDungeonAvailable ? 'sun' : 'clock'} size={12} color={isDailyDungeonAvailable ? '#f59e0b' : '#9ca3af'} />
            <Text style={[styles.dungeonBannerText, { color: isDailyDungeonAvailable ? '#f59e0b' : '#9ca3af' }]}>
              {isDailyDungeonAvailable ? t('map.daily.available') : `${t('map.daily.resetsIn')} ${countdown}`}
            </Text>
          </View>
        )}

        {isEvent && expiresAt && (
          <View style={[styles.dungeonBanner, { backgroundColor: '#7c3aed33', borderBottomColor: '#7c3aed55' }]}>
            <Feather name="clock" size={12} color="#c4b5fd" />
            <Text style={[styles.dungeonBannerText, { color: '#c4b5fd' }]}>
              Evento até {expiresAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (!unlocked || dayLocked) return;
            setExpandedMap(expanded ? '' : map.id);
          }}
        >
          {map.backgroundImage ? (
            <ImageBackground
              source={map.backgroundImage}
              style={styles.mapBanner}
              imageStyle={styles.mapBannerImage}
            >
              <View style={styles.mapBannerOverlay}>
                {(!unlocked || dayLocked) && (
                  <Image source={PADLOCK} style={styles.padlockImg} resizeMode="contain" />
                )}
                <View style={styles.mapBannerInfo}>
                  <Text style={styles.mapBannerName}>{map.name}</Text>
                  <Text style={styles.mapBannerDesc} numberOfLines={1}>{map.description}</Text>
                  {!unlocked && !isDungeon && (
                    <Text style={styles.mapBannerLock}>{t('map.lockPrevMap')}</Text>
                  )}
                  {!unlocked && isDungeon && map.requiredTamerLevel && (
                    <Text style={[styles.mapBannerLock, { color: '#c4b5fd' }]}>
                      {t('map.lockTamerLv')}{map.requiredTamerLevel} ({t('map.lockCurrentLv')}{totalPlayerLevel})
                    </Text>
                  )}
                </View>
                <View style={styles.mapBannerRight}>
                  {clearedInMap > 0 ? (
                    <StarRating count={allCleared ? 3 : Math.min(clearedInMap, 2)} />
                  ) : (
                    <Text style={[styles.mapProgress, { color: '#ffffff' }]}>
                      {clearedInMap}/{map.stages.length}
                    </Text>
                  )}
                  {unlocked && !dayLocked && (
                    <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#ffffffaa" />
                  )}
                </View>
              </View>
            </ImageBackground>
          ) : (
            <View style={styles.mapHeader}>
              {(!unlocked || dayLocked) && (
                <Image source={PADLOCK} style={styles.padlockImg} resizeMode="contain" />
              )}
              {isDungeon && unlocked && !dayLocked && (
                <Feather name="shield-off" size={20} color={dungeonBorderColor} />
              )}
              <View style={styles.mapInfo}>
                <Text style={[styles.mapName, { color: isDungeon ? '#c4b5fd' : isEvent ? '#a5b4fc' : (unlocked ? colors.foreground : colors.mutedForeground) }]}>{map.name}</Text>
                <Text style={[styles.mapDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{map.description}</Text>
                {!unlocked && !isDungeon && (
                  <Text style={[styles.lockHint, { color: colors.mutedForeground }]}>{t('map.lockPrevMap')}</Text>
                )}
                {!unlocked && isDungeon && map.requiredTamerLevel && (
                  <Text style={[styles.lockHint, { color: '#a78bfa' }]}>
                    {t('map.lockTamerLv')}{map.requiredTamerLevel} ({t('map.lockCurrentLv')}{totalPlayerLevel})
                  </Text>
                )}
              </View>
              <View style={styles.mapRight}>
                {clearedInMap > 0 ? (
                  <StarRating count={allCleared ? 3 : Math.min(clearedInMap, 2)} />
                ) : (
                  <Text style={[styles.mapProgress, { color: colors.primary }]}>
                    {clearedInMap}/{map.stages.length}
                  </Text>
                )}
                {unlocked && !dayLocked && (
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>


        {expanded && unlocked && !dayLocked && (
          <View style={[styles.stagesContainer, { borderTopColor: colors.border }]}>
            {map.stages.map((stage: MapStage) => {
              const cleared = isStageCleared(map.id, stage.index);
              const stageDailyLocked = isDaily && !isDailyDungeonAvailable;
              const isBossStage = stage.isBoss === true;
              const regularStagesCleared = !isBossStage ? true :
                map.stages.filter((s: MapStage) => !s.isBoss).every((s: MapStage) => isStageCleared(map.id, s.index));
              const bossLocked = isBossStage && !regularStagesCleared;
              const canPlay = !!selectedCharacter && !stageDailyLocked && !bossLocked;

              return (
                <TouchableOpacity
                  key={stage.index}
                  activeOpacity={canPlay ? 0.8 : 1}
                  onPress={() => canPlay && handleStagePress(map.id, stage.index, isDaily, availableDays)}
                  style={[
                    styles.stageRow,
                    isBossStage && { backgroundColor: '#3b000011', borderLeftWidth: 3, borderLeftColor: '#ef4444' },
                    { borderBottomColor: colors.border, backgroundColor: isDungeon ? '#2a0f4e22' : 'transparent' },
                    isBossStage && { backgroundColor: '#3b000022' },
                    cleared && !isDaily && { backgroundColor: isBossStage ? '#22c55e22' : '#22c55e11' },
                    (stageDailyLocked || bossLocked) && { opacity: 0.55 },
                    pixelStyle,
                  ]}
                >
                  <View style={styles.stageInfo}>
                    <Text style={[styles.stageName, { color: isBossStage ? '#ef4444' : (isDungeon ? '#e9d5ff' : colors.foreground) }]}>{stage.name}</Text>
                    {isBossStage && !cleared && (stage as any).tamerCrestReward && (
                      <View style={styles.rewardRow}>
                        <Text style={{ fontSize: 11 }}>🏅</Text>
                        <Text style={[styles.rewardText, { color: '#f59e0b' }]}>
                          +{(stage as any).tamerCrestReward.amount}× {t('map.tamerCrest')}
                        </Text>
                      </View>
                    )}
                    {isBossStage && bossLocked && (
                      <View style={styles.rewardRow}>
                        <Feather name="lock" size={11} color="#ef4444" />
                        <Text style={[styles.rewardText, { color: '#ef4444' }]}>{t('map.bossLocked')}</Text>
                      </View>
                    )}
                    {!cleared && !isDungeon && !isBossStage && (stage as any).gemsFirstClear > 0 && (
                      <View style={styles.rewardRow}>
                        <Text style={{ fontSize: 11 }}>💎</Text>
                        <Text style={[styles.rewardText, { color: '#a78bfa' }]}>
                          +{(stage as any).gemsFirstClear} {t('map.firstClearGems')}
                        </Text>
                      </View>
                    )}
                    {cleared && !isDungeon && (
                      <View style={styles.rewardRow}>
                        <Text style={{ fontSize: 10 }}>✅</Text>
                        <Text style={[styles.rewardText, { color: '#22c55e' }]}>{t('map.cleared')}</Text>
                      </View>
                    )}
                    {!cleared && !isDungeon && !isBossStage && (
                      <View style={styles.rewardRow}>
                        <Feather name="cpu" size={11} color="#3b82f6" />
                        <Text style={[styles.rewardText, { color: '#3b82f6' }]}>{t('map.scanReward')}</Text>
                      </View>
                    )}
                    {isDungeon && stage.drops && (() => {
                      const bitsDrops  = stage.drops.filter((d: StageDrop) => d.type === 'bits');
                      const pieceDrops = stage.drops.filter((d: StageDrop) => d.type === 'piece');
                      const PIECE_KEY_MAP: Record<string, string> = {
                        piece_brasao_coragem:      'map.piece.coragem',
                        piece_brasao_esperanca:    'map.piece.esperanca',
                        piece_brasao_amizade:      'map.piece.amizade',
                        piece_brasao_confianca:    'map.piece.confianca',
                        piece_brasao_pureza:       'map.piece.pureza',
                        piece_brasao_conhecimento: 'map.piece.conhecimento',
                        piece_brasao_luz:          'map.piece.luz',
                        piece_brasao_amor:         'map.piece.amor',
                      };
                      return (
                        <>
                          {bitsDrops.map((drop: StageDrop, di: number) => (
                            <View key={`bits-${di}`} style={styles.rewardRow}>
                              <Image source={require('../../assets/images/bits-icon.webp')} style={{ width: 14, height: 14 }} resizeMode="contain" />
                              <Text style={[styles.rewardText, { color: '#facc15' }]}>
                                {drop.amount.toLocaleString()} Bits ({Math.round(drop.chance * 100)}%)
                              </Text>
                            </View>
                          ))}
                          {pieceDrops.length > 0 && (
                            <View style={styles.rewardRow}>
                              <Feather name="gift" size={11} color="#f59e0b" />
                              <Text style={[styles.rewardText, { color: '#f59e0b' }]}>
                                {pieceDrops.length === 1
                                  ? t(PIECE_KEY_MAP[(pieceDrops[0] as any).id] ?? 'map.brasaoFragment')
                                  : `${t('map.brasaoFragment')} (${pieceDrops.length} ${t('map.brasaoFragmentTypes')})`}
                              </Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  <View style={styles.stageRight}>
                    {stage.expReward > 0 && (
                      <View style={[styles.expTag, { backgroundColor: colors.primary + '22' }]}>
                        <Text style={[styles.expText, { color: colors.primary }]}>+{stage.expReward} EXP</Text>
                      </View>
                    )}
                    {!cleared && !isDungeon && (stage as any).gemsFirstClear > 0 && (
                      <View style={[styles.gemTag]}>
                        <Text style={styles.gemTagText}>💎 {(stage as any).gemsFirstClear}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{t('map.title')}</Text>
        {!selectedCharacter && (
          <View style={[styles.warnBadge, { backgroundColor: '#facc15' + '22', borderColor: '#facc15' }]}>
            <Feather name="alert-triangle" size={12} color="#facc15" />
            <Text style={[styles.warnText, { color: '#facc15' }]}>{t('map.selectDigimon')}</Text>
          </View>
        )}
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const accent =
            tab.id === 'digimundo' ? '#22c55e' :
            tab.id === 'dungeon'   ? '#8b5cf6' :
            '#f97316';
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && { borderBottomColor: accent, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <Feather name={tab.icon as any} size={14} color={isActive ? accent : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: isActive ? accent : colors.mutedForeground, fontWeight: isActive ? '700' : '500' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'eventos' && eventMaps.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="star" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem Eventos</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Nenhum evento ativo no momento.{'\n'}Fique de olho para novidades!
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {currentMaps.map((map) => renderMap(map))}
        </ScrollView>
      )}

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
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '800' as const },
  warnBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  warnText: { fontSize: 11, fontWeight: '600' as const },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 12 },

  content: { padding: 16, gap: 14 },
  mapCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  mapBanner: { width: '100%', height: 120 },
  mapBannerImage: { resizeMode: 'cover' },
  mapBannerOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  mapBannerInfo: { flex: 1 },
  mapBannerName: { fontSize: 14, fontWeight: '800' as const, color: '#ffffff', marginBottom: 3 },
  mapBannerDesc: { fontSize: 11, color: '#ffffffbb', lineHeight: 14 },
  mapBannerLock: { fontSize: 10, color: '#facc15cc', marginTop: 3 },
  mapBannerRight: { alignItems: 'center', gap: 4 },

  mapHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  mapInfo: { flex: 1 },
  mapName: { fontSize: 14, fontWeight: '700' as const, marginBottom: 4 },
  mapDesc: { fontSize: 12, lineHeight: 16 },
  lockHint: { fontSize: 11, marginTop: 4 },
  mapRight: { alignItems: 'center', gap: 4 },
  mapProgress: { fontSize: 14, fontWeight: '800' as const },
  padlockImg: { width: 36, height: 36 },

  dungeonBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1 },
  dungeonBannerText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },

  dayPill: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1 },
  dayPillText: { fontSize: 8, fontWeight: '700' as const },

  stagesContainer: { borderTopWidth: 1 },
  stageRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 12 },
  stageInfo: { flex: 1, gap: 4 },
  stageName: { fontSize: 12, fontWeight: '600' as const },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardText: { fontSize: 11, fontWeight: '600' as const },
  stageRight: { alignItems: 'center', gap: 8 },
  expTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  expText: { fontSize: 11, fontWeight: '700' as const },
  gemTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44' },

  exploreBtn: {
    marginHorizontal: 14, marginVertical: 8,
    paddingVertical: 11, paddingHorizontal: 16,
    backgroundColor: '#166534',
    borderRadius: 8, borderWidth: 2, borderColor: '#22c55e',
    alignItems: 'center',
  },
  exploreBtnText: { color: '#86efac', fontSize: 13, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 1 },
  gemTagText: { fontSize: 11, fontWeight: '700' as const, color: '#a78bfa' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800' as const },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
