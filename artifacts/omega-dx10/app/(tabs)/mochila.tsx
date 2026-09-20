import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Image, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/context/GameContext';
import { pixelStyle } from '@/constants/pixelStyle';
import {
  EQUIP_SLOT_ICONS, EQUIPMENT_ITEMS, EQUIP_SLOTS_ORDER,
  RARITY_COLORS, ELEMENTS, EquipSlot, RarityId, ElementId,
  CRAFT_RECIPES, ITEM_NAMES,
} from '@/constants/gameData';
import EQUIP_ITEM_IMAGES from '@/constants/equipImages';
import { useLanguage } from '@/context/LanguageContext';
import SaveManagerSection from '@/components/SaveManagerSection';
import { getCharacter } from '@/constants/extendedCharacters';
import { CharacterAvatar } from '@/components/GameComponents';

const XP_BATTERIES = [
  { id: 'piece_battery_green',  name: 'Bateria Verde',   xp: 100, color: '#22c55e', img: require('../../assets/images/battery_green.webp') },
  { id: 'piece_battery_blue',   name: 'Bateria Azul',    xp: 200, color: '#3b82f6', img: require('../../assets/images/battery_blue.webp') },
  { id: 'piece_battery_purple', name: 'Bateria Roxa',    xp: 400, color: '#a855f7', img: require('../../assets/images/battery_purple.webp') },
  { id: 'piece_battery_gold',   name: 'Bateria Dourada', xp: 800, color: '#f59e0b', img: require('../../assets/images/battery_gold.webp') },
] as const;

export default function MochilaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const game = useGame();
  const {
    inventory, equippedItems, pieces, bits, collection,
    equipItem, unequipItem, craftItem, useXpItem,
  } = game;

  const { t } = useLanguage();
  const [selectedSlot, setSelectedSlot] = useState<EquipSlot | null>(null);
  const [batteryModalVisible, setBatteryModalVisible] = useState(false);
  const [selectedBatteryId, setSelectedBatteryId] = useState<string>('piece_battery_green');
  const [selectedDigimonId, setSelectedDigimonId] = useState<string | null>(null);
  const [batteryQty, setBatteryQty] = useState(1);

  const topPad = 0;
  const botPad = insets.bottom + 20;

  const totalBonus = game.totalEquipBonus();
  const bonusEntries = Object.entries(totalBonus).filter(([, v]) => (v ?? 0) > 0);

  const { customEquipItems } = game;
  const allEquipmentItems = [...EQUIPMENT_ITEMS, ...customEquipItems];
  const slotItems = selectedSlot
    ? allEquipmentItems.filter((i) => i.slot === selectedSlot && inventory.includes(i.id))
    : [];

  function handleSlotPress(slot: EquipSlot) {
    setSelectedSlot((prev) => (prev === slot ? null : slot));
  }

  function handleEquip(itemId: string) {
    if (!selectedSlot) return;
    if (equippedItems[selectedSlot] === itemId) {
      unequipItem(selectedSlot);
    } else {
      equipItem(selectedSlot, itemId);
    }
  }

  function openBattery(batteryId: string) {
    setSelectedBatteryId(batteryId);
    setSelectedDigimonId(collection[0]?.ownedId ?? null);
    setBatteryQty(1);
    setBatteryModalVisible(true);
  }

  const selectedBattery = XP_BATTERIES.find((battery) => battery.id === selectedBatteryId) ?? XP_BATTERIES[0];
  const selectedBatteryStock = pieces[selectedBattery.id] ?? 0;
  const inventoryCounts = inventory.reduce<Record<string, number>>((counts, itemId) => {
    counts[itemId] = (counts[itemId] ?? 0) + 1;
    return counts;
  }, {});
  const visibleInventoryItems = Object.entries(inventoryCounts);
  const batteryIds = new Set(XP_BATTERIES.map((battery) => battery.id));
  const visibleMaterials = Object.entries(pieces).filter(
    ([itemId, quantity]) => quantity > 0 && !batteryIds.has(itemId as any),
  );

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Gerenciar Save ── */}
      <SaveManagerSection />

      {/* ── Equipamentos ── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t('mochila.equipment')}</Text>
      <View style={styles.slotsGrid}>
        {EQUIP_SLOTS_ORDER.map((slot) => {
          const equippedId = equippedItems[slot];
          const equippedItem = equippedId ? EQUIPMENT_ITEMS.find((i) => i.id === equippedId) : null;
          const isSelected = selectedSlot === slot;
          const rarityCol = equippedItem ? RARITY_COLORS[equippedItem.rarity] : null;

          return (
            <TouchableOpacity
              key={slot}
              style={[
                styles.slotCard,
                {
                  backgroundColor: isSelected
                    ? colors.primary + '18'
                    : equippedItem ? rarityCol + '12' : colors.card,
                  borderColor: isSelected
                    ? colors.primary
                    : equippedItem ? rarityCol + '88' : colors.border,
                },
                pixelStyle,
              ]}
              onPress={() => handleSlotPress(slot)}
              activeOpacity={0.8}
            >
              <View style={[styles.slotIconWrap, { backgroundColor: (rarityCol ?? colors.primary) + '22' }]}>
                {equippedItem && EQUIP_ITEM_IMAGES[equippedItem.id] ? (
                  <Image source={EQUIP_ITEM_IMAGES[equippedItem.id]} style={{ width: 28, height: 28 }} resizeMode="contain" />
                ) : (
                  <Feather
                    name={EQUIP_SLOT_ICONS[slot] as any}
                    size={18}
                    color={rarityCol ?? colors.primary}
                  />
                )}
              </View>
              <Text style={[styles.slotName, { color: colors.mutedForeground }]}>{t(`slot.${slot}`)}</Text>
              {equippedItem ? (
                <>
                  <Text style={[styles.slotItemName, { color: rarityCol ?? colors.foreground }]} numberOfLines={1}>
                    {t(`item.${equippedItem.id}`) || equippedItem.name}
                  </Text>
                  <View style={[styles.rarityPill, { backgroundColor: rarityCol + '33' }]}>
                    <Text style={[styles.rarityPillText, { color: rarityCol ?? colors.foreground }]}>
                      {t(`rarity.${equippedItem.rarity}`)}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.slotEmpty, { color: colors.mutedForeground }]}>{t('mochila.emptySlot')}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Item Picker ── */}
      {selectedSlot && (
        <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }, pixelStyle]}>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
            {t(`slot.${selectedSlot}`)} — {t('mochila.selectItem')}
          </Text>

          {slotItems.length === 0 ? (
            <View style={styles.pickerEmpty}>
              <Feather name="package" size={28} color={colors.mutedForeground} />
              <Text style={[styles.pickerEmptyText, { color: colors.mutedForeground }]}>
                {t('mochila.noItemsSlot')}
              </Text>
            </View>
          ) : (
            slotItems.map((item) => {
              const isEquipped = equippedItems[selectedSlot] === item.id;
              const rc = RARITY_COLORS[item.rarity as RarityId];
              const flatBonusStr = Object.entries(item.bonuses)
                .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
                .join('  ');
              const pctBonusStr = item.percentBonuses
                ? Object.entries(item.percentBonuses)
                    .map(([k, v]) => `+${Math.round(((v as number) ?? 0) * 100)}% ${k.toUpperCase()}`)
                    .join('  ')
                : '';
              const specialBonuses: string[] = [];
              if ((item as any).xpBonusPercent)      specialBonuses.push(`⚔️ +${Math.round((item as any).xpBonusPercent * 100)}% ${t('mochila.xpBattle')}`);
              if ((item as any).xpSharePercent)      specialBonuses.push(`📡 +${Math.round((item as any).xpSharePercent * 100)}% ${t('mochila.xpReserve')}`);
              if ((item as any).tamerXpBonusPercent) specialBonuses.push(`⭐ +${Math.round((item as any).tamerXpBonusPercent * 100)}% ${t('mochila.xpTamer')}`);
              const bonusStr = [flatBonusStr, pctBonusStr, ...specialBonuses].filter(Boolean).join('  ');

              const itemImg = EQUIP_ITEM_IMAGES[item.id];
              const elemBonus = item.elementBonus;
              const elemLabel = elemBonus ? elemBonus.elements.map((e: ElementId) => ELEMENTS[e]?.label).join(' & ') : null;
              const elemColor = elemBonus ? ELEMENTS[elemBonus.elements[0] as ElementId]?.color : null;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickerItem,
                    {
                      backgroundColor: isEquipped ? rc + '22' : colors.background,
                      borderColor: isEquipped ? rc : colors.border,
                    },
                    pixelStyle,
                  ]}
                  onPress={() => handleEquip(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerItemLeft}>
                    {itemImg ? (
                      <Image source={itemImg} style={styles.pickerItemImg} resizeMode="contain" />
                    ) : (
                      <View style={[styles.pickerRarityDot, { backgroundColor: rc }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.pickerItemNameRow}>
                        <Text style={[styles.pickerItemName, { color: colors.foreground }]}>{t(`item.${item.id}`) || item.name}</Text>
                        <View style={[styles.rarityPill, { backgroundColor: rc + '33', marginLeft: 6 }]}>
                          <Text style={[styles.rarityPillText, { color: rc }]}>{t(`rarity.${item.rarity}`)}</Text>
                        </View>
                      </View>
                      {bonusStr.length > 0 && (
                        <Text style={[styles.pickerItemBonus, { color: rc }]}>{bonusStr}</Text>
                      )}
                      {elemBonus && elemLabel && elemColor && (
                        <View style={[styles.elemBonusRow, { backgroundColor: elemColor + '22', borderColor: elemColor + '55' }]}>
                          <Text style={[styles.elemBonusText, { color: elemColor }]}>
                            ✦ +{Math.round(elemBonus.percent * 100)}% {t('mochila.allStats')} — {elemLabel}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.pickerItemDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.equipBtn,
                    { backgroundColor: isEquipped ? rc + '33' : colors.primary + '22', borderColor: isEquipped ? rc : colors.primary },
                  ]}>
                    <Text style={[styles.equipBtnText, { color: isEquipped ? rc : colors.primary }]}>
                      {isEquipped ? t('mochila.unequip') : t('mochila.equip')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}


      {/* ── Total Bonus ── */}
      {bonusEntries.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t('mochila.totalBonus')}</Text>
          <View style={[styles.bonusCard, { backgroundColor: colors.card, borderColor: colors.border }, pixelStyle]}>
            <View style={styles.bonusGrid}>
              {bonusEntries.map(([key, val]) => (
                <View key={key} style={[styles.bonusChip, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
                  <Text style={[styles.bonusKey, { color: colors.mutedForeground }]}>{key.toUpperCase()}</Text>
                  <Text style={[styles.bonusVal, { color: colors.primary }]}>+{val}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.bonusNote, { color: colors.mutedForeground }]}>
              {t('mochila.appliedInBattle')}
            </Text>
          </View>
        </>
      )}

      {/* ── Baterias de EXP ── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Baterias de EXP</Text>
      <View style={styles.batteryGrid}>
        {XP_BATTERIES.map((battery) => {
          const quantity = pieces[battery.id] ?? 0;
          return (
            <TouchableOpacity
              key={battery.id}
              style={[
                styles.batteryCard,
                { borderColor: battery.color + '88', backgroundColor: battery.color + '14', opacity: quantity > 0 ? 1 : 0.5 },
                pixelStyle,
              ]}
              onPress={() => openBattery(battery.id)}
              disabled={quantity <= 0}
              activeOpacity={0.8}
            >
              <Image source={battery.img} style={styles.batteryImage} resizeMode="contain" />
              <View style={styles.batteryCardInfo}>
                <Text style={[styles.batteryName, { color: battery.color }]}>{battery.name}</Text>
                <Text style={[styles.batteryXp, { color: colors.mutedForeground }]}>+{battery.xp} EXP</Text>
              </View>
              <View style={[styles.batteryQuantity, { backgroundColor: battery.color }]}> 
                <Text style={styles.batteryQuantityText}>×{quantity}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Itens obtidos ── */}
      {visibleInventoryItems.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Itens da Mochila</Text>
          <View style={styles.inventoryGrid}>
            {visibleInventoryItems.map(([itemId, quantity]) => {
              const equipment = allEquipmentItems.find((item) => item.id === itemId);
              const itemName = ITEM_NAMES[itemId] ?? equipment?.name ?? itemId;
              const itemImg = EQUIP_ITEM_IMAGES[itemId];
              return (
                <View key={itemId} style={[styles.inventoryCard, { backgroundColor: colors.card, borderColor: colors.border }, pixelStyle]}>
                  {itemImg ? (
                    <Image source={itemImg} style={styles.inventoryImage} resizeMode="contain" />
                  ) : (
                    <Feather name="package" size={30} color={colors.primary} />
                  )}
                  <Text style={[styles.inventoryName, { color: colors.foreground }]} numberOfLines={2}>{itemName}</Text>
                  <View style={[styles.inventoryQuantity, { backgroundColor: colors.primary }]}> 
                    <Text style={styles.inventoryQuantityText}>×{quantity}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── Materiais e fragmentos obtidos ── */}
      {visibleMaterials.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Materiais e Fragmentos</Text>
          <View style={styles.inventoryGrid}>
            {visibleMaterials.map(([itemId, quantity]) => {
              const itemImg = EQUIP_ITEM_IMAGES[itemId];
              return (
                <View key={itemId} style={[styles.inventoryCard, { backgroundColor: colors.card, borderColor: colors.border }, pixelStyle]}>
                  {itemImg ? (
                    <Image source={itemImg} style={styles.inventoryImage} resizeMode="contain" />
                  ) : (
                    <Feather name="box" size={30} color={colors.primary} />
                  )}
                  <Text style={[styles.inventoryName, { color: colors.foreground }]} numberOfLines={2}>{ITEM_NAMES[itemId] ?? itemId}</Text>
                  <View style={[styles.inventoryQuantity, { backgroundColor: colors.primary }]}> 
                    <Text style={styles.inventoryQuantityText}>×{quantity}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── Itens Forjados ── */}
      {CRAFT_RECIPES.some((r) => inventory.includes(r.resultItemId)) && (
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t('mochila.craftedItems')}</Text>
      )}

      {/* Fragmentos disponíveis */}
      {(() => {
        const knownPieces = [
          { pieceId: 'piece_tecido',  label: t('item.piece_tecido'),  icon: 'layers', color: '#ec4899' },
          { pieceId: 'piece_linha',   label: t('item.piece_linha'),   icon: 'wind',   color: '#06b6d4' },
          { pieceId: 'piece_agulha',  label: t('item.piece_agulha'),  icon: 'edit-2', color: '#8b5cf6' },
        ];
        const hasAny = knownPieces.some((p) => (pieces[p.pieceId] ?? 0) > 0);
        const hasCrafted = CRAFT_RECIPES.some((r) => inventory.includes(r.resultItemId));
        if (!hasAny || !hasCrafted) return null;
        return (
          <View style={[styles.fragmentSummaryRow, { borderColor: colors.border, backgroundColor: colors.card, marginBottom: 16 }, pixelStyle]}>
            {knownPieces.map((p) => (
              <View key={p.pieceId} style={styles.fragmentSummaryItem}>
                <View style={[styles.fragmentSummaryIcon, { backgroundColor: p.color + '22' }]}>
                  <Feather name={p.icon as any} size={18} color={p.color} />
                </View>
                <Text style={[styles.fragmentSummaryCount, { color: colors.foreground }]}>
                  {pieces[p.pieceId] ?? 0}
                </Text>
                <Text style={[styles.fragmentSummaryLabel, { color: colors.mutedForeground }]}>{p.label}</Text>
              </View>
            ))}
            <View style={styles.fragmentSummaryItem}>
              <View style={[styles.fragmentSummaryIcon, { backgroundColor: '#facc1522' }]}>
                <Image source={require('../../assets/images/bits-icon.webp')} style={{ width: 22, height: 22 }} resizeMode="contain" />
              </View>
              <Text style={[styles.fragmentSummaryCount, { color: '#facc15' }]}>
                {bits >= 1000 ? `${(bits / 1000).toFixed(1)}k` : bits.toLocaleString()}
              </Text>
              <Text style={[styles.fragmentSummaryLabel, { color: colors.mutedForeground }]}>Bits</Text>
            </View>
          </View>
        );
      })()}

      {CRAFT_RECIPES.filter((r) => inventory.includes(r.resultItemId)).map((recipe, idx) => {
        const alreadyCrafted = true;
        const rc = RARITY_COLORS[recipe.resultRarity];
        const resultImg = EQUIP_ITEM_IMAGES[recipe.resultItemId];

        // Determine requirements list for display
        const reqs = recipe.pieceRequirements && recipe.pieceRequirements.length > 0
          ? recipe.pieceRequirements
          : [{ pieceId: recipe.pieceId, count: recipe.requiredCount, pieceName: recipe.pieceName, pieceIcon: recipe.pieceIcon, pieceColor: recipe.pieceColor }];

        // Check if all piece requirements are met
        const allPiecesMet = reqs.every((r) => (pieces[r.pieceId] ?? 0) >= r.count);
        const bitsMet = !recipe.bitsCost || bits >= recipe.bitsCost;
        const canCraft = !alreadyCrafted && allPiecesMet && bitsMet;

        // Progress: for multi-piece use limiting ratio; for single use normal
        const minRatio = Math.min(...reqs.map((r) => Math.min(1, (pieces[r.pieceId] ?? 0) / r.count)));

        return (
          <View
            key={`${recipe.resultItemId}-${idx}`}
            style={[styles.craftCard, { backgroundColor: colors.card, borderColor: canCraft ? rc : alreadyCrafted ? rc + '66' : colors.border }, pixelStyle]}
          >
            {/* Header */}
            <View style={styles.craftCardHeader}>
              {resultImg ? (
                <Image source={resultImg} style={{ width: 52, height: 52 }} resizeMode="contain" />
              ) : (
                <View style={[styles.craftPieceIcon, { backgroundColor: recipe.pieceColor + '22' }]}>
                  <Feather name={recipe.pieceIcon as any} size={22} color={recipe.pieceColor} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.craftResultName, { color: colors.foreground }]}>{recipe.resultItemName}</Text>
                <View style={styles.craftRarityRow}>
                  <View style={[styles.craftRarityBadge, { backgroundColor: rc + '22' }]}>
                    <Text style={[styles.craftRarityText, { color: rc }]}>{t(`rarity.${recipe.resultRarity}`)}</Text>
                  </View>
                </View>
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, marginTop: 3 }]} numberOfLines={2}>
                  {recipe.pieceDescription}
                </Text>
              </View>
            </View>

            {/* Requirements chips */}
            <View style={styles.craftReqRow}>
              {reqs.map((r) => {
                const have = pieces[r.pieceId] ?? 0;
                const met = have >= r.count;
                return (
                  <View
                    key={r.pieceId}
                    style={[styles.craftReqChip, {
                      backgroundColor: met ? r.pieceColor + '22' : colors.background,
                      borderColor: met ? r.pieceColor : colors.border,
                    }]}
                  >
                    <Feather name={r.pieceIcon as any} size={13} color={met ? r.pieceColor : colors.mutedForeground} />
                    <Text style={[styles.craftReqText, { color: met ? r.pieceColor : colors.mutedForeground }]}>
                      {have}/{r.count} {r.pieceName}
                    </Text>
                  </View>
                );
              })}
              {!!recipe.bitsCost && (
                <View style={[styles.craftReqChip, {
                  backgroundColor: bitsMet ? '#facc1522' : colors.background,
                  borderColor: bitsMet ? '#facc15' : colors.border,
                }]}>
                  <Image source={require('../../assets/images/bits-icon.webp')} style={{ width: 14, height: 14, opacity: bitsMet ? 1 : 0.4 }} resizeMode="contain" />
                  <Text style={[styles.craftReqText, { color: bitsMet ? '#facc15' : colors.mutedForeground }]}>
                    {recipe.bitsCost.toLocaleString()} Bits
                  </Text>
                </View>
              )}
            </View>

            {/* Progress bar */}
            <View style={styles.craftProgressRow}>
              <View style={[styles.craftProgressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.craftProgressFill, { width: `${Math.round(minRatio * 100)}%` as any, backgroundColor: canCraft ? rc : recipe.pieceColor }]} />
              </View>
              <Text style={[styles.craftProgressLabel, { color: canCraft ? rc : colors.mutedForeground }]}>
                {Math.round(minRatio * 100)}%
              </Text>
            </View>

            {/* Action */}
            {alreadyCrafted ? (
              <View style={[styles.craftedBadge, { backgroundColor: rc + '18', borderColor: rc + '55' }]}>
                <Feather name="check-circle" size={16} color={rc} />
                <Text style={[styles.craftedText, { color: rc }]}>{t('mochila.alreadyCrafted')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={canCraft ? 0.8 : 1}
                onPress={() => { if (canCraft) craftItem(recipe); }}
                style={[styles.craftBtn, {
                  backgroundColor: canCraft ? rc + '22' : colors.background,
                  borderColor: canCraft ? rc : colors.border,
                }]}
              >
                <Feather name="tool" size={16} color={canCraft ? rc : colors.mutedForeground} />
                <Text style={[styles.craftBtnText, { color: canCraft ? rc : colors.mutedForeground }]}>
                  {canCraft ? `${t('craft.forge')} ${recipe.resultItemName}` : t('mochila.insufficientMaterials')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>

    <Modal
      visible={batteryModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setBatteryModalVisible(false)}
    >
      <Pressable style={styles.batteryModalOverlay} onPress={() => setBatteryModalVisible(false)}>
        <Pressable
          style={[styles.batteryModalBox, { backgroundColor: colors.card, borderColor: selectedBattery.color }, pixelStyle]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.batteryModalHeader}>
            <Image source={selectedBattery.img} style={styles.batteryModalImage} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.batteryModalTitle, { color: selectedBattery.color }]}>{selectedBattery.name}</Text>
              <Text style={[styles.batteryModalSubtitle, { color: colors.mutedForeground }]}>+{selectedBattery.xp} EXP por bateria</Text>
            </View>
            <TouchableOpacity onPress={() => setBatteryModalVisible(false)} style={styles.batteryCloseButton}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.batteryTargetTitle, { color: colors.foreground }]}>Escolha o Digimon</Text>
          <ScrollView style={styles.batteryDigimonList} showsVerticalScrollIndicator={false}>
            {collection.map((owned) => {
              const character = getCharacter(owned.characterId);
              const selected = selectedDigimonId === owned.ownedId;
              return (
                <TouchableOpacity
                  key={owned.ownedId}
                  style={[
                    styles.batteryDigimonCard,
                    { borderColor: selected ? selectedBattery.color : colors.border, backgroundColor: selected ? selectedBattery.color + '18' : colors.background },
                  ]}
                  onPress={() => setSelectedDigimonId(owned.ownedId)}
                >
                  <CharacterAvatar characterId={owned.characterId} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.batteryDigimonName, { color: colors.foreground }]}>{character?.name ?? owned.characterId}</Text>
                    <Text style={[styles.batteryDigimonLevel, { color: colors.mutedForeground }]}>Nível {owned.level}</Text>
                  </View>
                  {selected && <Feather name="check-circle" size={20} color={selectedBattery.color} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.batteryQtyRow}>
            <TouchableOpacity
              style={[styles.batteryQtyButton, { borderColor: colors.border }]}
              onPress={() => setBatteryQty((quantity) => Math.max(1, quantity - 1))}
            >
              <Feather name="minus" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.batteryQtyCenter}>
              <Text style={[styles.batteryQtyNumber, { color: colors.foreground }]}>{batteryQty}</Text>
              <Text style={[styles.batteryQtyAvailable, { color: colors.mutedForeground }]}>Disponível: {selectedBatteryStock}</Text>
            </View>
            <TouchableOpacity
              style={[styles.batteryQtyButton, { borderColor: colors.border }]}
              onPress={() => setBatteryQty((quantity) => Math.min(selectedBatteryStock, quantity + 1))}
            >
              <Feather name="plus" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.batteryTotalXp, { color: selectedBattery.color }]}>+{(selectedBattery.xp * batteryQty).toLocaleString()} EXP</Text>

          <TouchableOpacity
            style={[
              styles.batteryUseButton,
              { backgroundColor: selectedBattery.color, opacity: selectedDigimonId && selectedBatteryStock > 0 ? 1 : 0.45 },
            ]}
            disabled={!selectedDigimonId || selectedBatteryStock <= 0}
            onPress={() => {
              if (!selectedDigimonId || selectedBatteryStock <= 0) return;
              useXpItem(selectedDigimonId, selectedBattery.id, batteryQty);
              setBatteryModalVisible(false);
            }}
          >
            <Image source={selectedBattery.img} style={styles.batteryUseImage} resizeMode="contain" />
            <Text style={styles.batteryUseText}>Usar no Digimon</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },

  tamerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 24,
  },
  tamerAvatarWrap: { position: 'relative' },
  tamerAvatar: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tamerAvatarImg: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 2.5,
    overflow: 'hidden' as const,
    backgroundColor: 'transparent',
  },
  tamerAvatarImageStyle: {
    width: '100%' as unknown as number,
    height: 180,
    marginTop: -8,
  },
  genderBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  genderBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' as const },
  tamerInfo: { flex: 1 },
  tamerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  genderPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  genderPillText: { fontSize: 11, fontWeight: '700' as const },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  tamerName: { fontSize: 14, fontWeight: '800' as const },
  tamerLabel: { fontSize: 12, marginTop: 2 },
  tamerXpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  tamerXpLabel: { fontSize: 11, fontWeight: '700' as const, minWidth: 28 },
  tamerXpBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' as const },
  tamerXpBarFill: { height: 6, borderRadius: 3 },
  tamerXpNum: { fontSize: 10, minWidth: 36, textAlign: 'right' as const },
  tamerXpMissing: { fontSize: 10, marginTop: 2, textAlign: 'center' as const, opacity: 0.7 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1, fontSize: 15, fontWeight: '700' as const,
    borderBottomWidth: 2, paddingVertical: 2,
  },
  nameConfirm: { padding: 4 },

  sectionTitle: {
    fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.5,
    marginBottom: 12, textTransform: 'uppercase',
  },

  batteryGrid: { gap: 10, marginBottom: 24 },
  batteryCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 10, gap: 12 },
  batteryImage: { width: 50, height: 50 },
  batteryCardInfo: { flex: 1 },
  batteryName: { fontSize: 13, fontWeight: '800' as const },
  batteryXp: { fontSize: 11, marginTop: 3 },
  batteryQuantity: { minWidth: 42, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  batteryQuantityText: { color: '#fff', fontSize: 12, fontWeight: '900' as const },
  inventoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  inventoryCard: {
    width: '47%', minHeight: 118, borderRadius: 14, borderWidth: 1.5,
    padding: 12, alignItems: 'center', justifyContent: 'center', gap: 7,
    position: 'relative',
  },
  inventoryImage: { width: 52, height: 52 },
  inventoryName: { fontSize: 11, fontWeight: '800' as const, textAlign: 'center' as const },
  inventoryQuantity: {
    position: 'absolute', top: 7, right: 7, minWidth: 30, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center',
  },
  inventoryQuantityText: { color: '#fff', fontSize: 10, fontWeight: '900' as const },
  batteryModalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: 20 },
  batteryModalBox: { width: '100%', maxWidth: 390, maxHeight: '88%', borderRadius: 18, borderWidth: 2, padding: 16 },
  batteryModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  batteryModalImage: { width: 48, height: 48 },
  batteryModalTitle: { fontSize: 15, fontWeight: '900' as const },
  batteryModalSubtitle: { fontSize: 11, marginTop: 3 },
  batteryCloseButton: { padding: 6 },
  batteryTargetTitle: { fontSize: 12, fontWeight: '800' as const, marginBottom: 8 },
  batteryDigimonList: { maxHeight: 260, marginBottom: 14 },
  batteryDigimonCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 9, marginBottom: 7 },
  batteryDigimonName: { fontSize: 12, fontWeight: '800' as const },
  batteryDigimonLevel: { fontSize: 10, marginTop: 2 },
  batteryQtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  batteryQtyButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  batteryQtyCenter: { minWidth: 90, alignItems: 'center' },
  batteryQtyNumber: { fontSize: 20, fontWeight: '900' as const },
  batteryQtyAvailable: { fontSize: 10, marginTop: 2 },
  batteryTotalXp: { fontSize: 15, fontWeight: '900' as const, textAlign: 'center' as const, marginVertical: 12 },
  batteryUseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
  batteryUseImage: { width: 24, height: 24 },
  batteryUseText: { color: '#fff', fontSize: 13, fontWeight: '900' as const },

  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  genderBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1.5,
    paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  genderSymbol: { fontSize: 14, fontWeight: '700' as const },
  genderLabel: { fontSize: 11, fontWeight: '600' as const },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  slotCard: {
    width: '47%', borderRadius: 14, borderWidth: 1.5,
    padding: 12, alignItems: 'center', gap: 6,
  },
  slotIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  slotName: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase', letterSpacing: 0.5 },
  slotItemName: { fontSize: 13, fontWeight: '700' as const, textAlign: 'center' },
  slotEmpty: { fontSize: 12, fontStyle: 'italic' },
  rarityPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  rarityPillText: { fontSize: 10, fontWeight: '700' as const },

  pickerCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24, gap: 12,
  },
  pickerTitle: { fontSize: 12, fontWeight: '700' as const, marginBottom: 4 },
  pickerEmpty: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  pickerEmptyText: { fontSize: 13 },
  pickerItem: {
    borderRadius: 14, borderWidth: 1.5, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  pickerItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pickerRarityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  pickerItemImg: { width: 44, height: 44 },
  elemBonusRow: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4, alignSelf: 'flex-start' as const },
  elemBonusText: { fontSize: 11, fontWeight: '700' as const },
  pickerItemNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 },
  pickerItemName: { fontSize: 12, fontWeight: '700' as const },
  pickerItemBonus: { fontSize: 12, fontWeight: '700' as const, marginBottom: 3 },
  pickerItemDesc: { fontSize: 12, lineHeight: 17 },
  equipBtn: {
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  equipBtnText: { fontSize: 12, fontWeight: '700' as const },

  fragmentCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 16, gap: 12 },
  fragmentTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fragmentImg: { width: 52, height: 52 },
  fragmentName: { fontSize: 13, fontWeight: '700' as const, marginBottom: 3 },
  fragmentDesc: { fontSize: 12, lineHeight: 17 },
  fragmentProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fragmentTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' as const },
  fragmentFill: { height: 8, borderRadius: 4 },
  fragmentCount: { fontSize: 13, fontWeight: '700' as const, minWidth: 45, textAlign: 'right' as const },
  // craft summary
  fragmentSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  fragmentSummaryItem: { alignItems: 'center', gap: 4 },
  fragmentSummaryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  fragmentSummaryCount: { fontSize: 14, fontWeight: '800' as const },
  fragmentSummaryLabel: { fontSize: 11 },
  // craft cards
  craftCard: { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 14, gap: 10 },
  craftCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  craftPieceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  craftResultName: { fontSize: 13, fontWeight: '700' as const, marginBottom: 4 },
  craftRarityRow: { flexDirection: 'row' },
  craftRarityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  craftRarityText: { fontSize: 11, fontWeight: '700' as const },
  craftReqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  craftReqChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  craftReqText: { fontSize: 12, fontWeight: '600' as const },
  craftProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  craftProgressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' as const },
  craftProgressFill: { height: 6, borderRadius: 3 },
  craftProgressLabel: { fontSize: 12, fontWeight: '700' as const, minWidth: 36, textAlign: 'right' as const },
  craftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12 },
  craftBtnText: { fontSize: 13, fontWeight: '700' as const },
  craftedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  craftedText: { fontSize: 12, fontWeight: '600' as const },
  bonusCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  bonusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  bonusChip: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', minWidth: 70,
  },
  bonusKey: { fontSize: 10, fontWeight: '600' as const },
  bonusVal: { fontSize: 14, fontWeight: '800' as const },
  bonusNote: { fontSize: 11, textAlign: 'center' },
});
