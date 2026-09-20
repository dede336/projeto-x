import { Router } from "express";
import { db, customDigimonsTable, usersTable, gameSavesTable } from "@workspace/db";
import { eq, sql, and, getTableColumns } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { broadcastUpdateMail } from "../lib/broadcastMail.js";


const router = Router();
const MAX_CUSTOM_DIGIMONS = 2000;

function canCreateDigimon(auth: { isAdmin: boolean; role: string }): boolean {
  return auth.isAdmin || auth.role === "digimon_creator";
}

function canEditDigimon(auth: { isAdmin: boolean; role: string }): boolean {
  return auth.isAdmin || auth.role === 'digimon_creator';
}

// Shape shared between full rows and summary rows (no imageBase64)
function rowToDigimon(r: typeof customDigimonsTable.$inferSelect): ReturnType<typeof shapeDigimon> & { hasImage: boolean } {
  return { ...shapeDigimon(r), hasImage: !!r.imageBase64 };
}

function shapeDigimon(r: Omit<typeof customDigimonsTable.$inferSelect, 'imageBase64'> & { hasImageFlag?: boolean }) {
  return {
    id: `custom_${r.id}`,
    dbId: r.id,
    name: r.name,
    attribute: r.attribute,
    rarity: r.rarity,
    element: r.element,
    baseStats: { hp: r.hp, mp: r.mp, atk: r.atk, def: r.def, spt: r.spt, spd: r.spd },
    description: r.description,
    attackName: r.attackName ?? undefined,
    attackElement: r.attackElement ?? undefined,
    spiritName: r.spiritName ?? undefined,
    spiritElement: r.spiritElement ?? undefined,
    isBaseForm: r.isBaseForm,
    evolvesFromId: r.evolvesFromId ?? undefined,
    requiredLevel: r.requiredLevel ?? undefined,
    requiredItem: r.requiredItem ?? undefined,
    requiredSacrificeCharacter: r.requiredSacrificeCharacter ?? undefined,
    isFusion: r.isFusion,
    fusionPartner: r.fusionPartner ?? undefined,
    scannable: r.scannable,
    isActive: r.isActive,
    hasImage: r.hasImageFlag ?? false,
    imageMimeType: r.imageMimeType ?? undefined,
    imageScale: r.imageScale ?? 0.8,
    imageUpdatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
  };
}

// GET /digimons/custom
// - Players only see active digimons
// - Admins see all (active + inactive)
// - Supports ?attribute=VC &rarity=LEGENDARY &element=FIRE filters
router.get("/custom", optionalAuth, async (req, res) => {
  const isAdmin = req.auth?.isAdmin ?? false;

  const { attribute, rarity, element } = req.query as Record<string, string | undefined>;

  const conditions = [];

  if (!isAdmin) {
    conditions.push(eq(customDigimonsTable.isActive, true));
  }
  if (attribute) {
    conditions.push(eq(customDigimonsTable.attribute, attribute));
  }
  if (rarity) {
    conditions.push(eq(customDigimonsTable.rarity, rarity));
  }
  if (element) {
    conditions.push(eq(customDigimonsTable.element, element));
  }

  // Exclude imageBase64 from the list query — it's fetched separately per image endpoint.
  // Sending all base64 images in one payload would be 40+ MB and break the editor.
  const { imageBase64: _excluded, ...summaryColumns } = getTableColumns(customDigimonsTable);
  const listQuery = db.select({
    ...summaryColumns,
    hasImageFlag: sql<boolean>`(image_base64 IS NOT NULL)`,
  }).from(customDigimonsTable);

  const phaseOrder = sql`CASE ${customDigimonsTable.rarity}
    WHEN 'EGG'       THEN 0
    WHEN 'BABY'      THEN 1
    WHEN 'TRAINING'  THEN 2
    WHEN 'COMMON'    THEN 3
    WHEN 'RARE'      THEN 4
    WHEN 'CHAMPION'  THEN 5
    WHEN 'EPIC'      THEN 6
    WHEN 'LEGENDARY' THEN 7
    WHEN 'ULTRA'     THEN 8
    WHEN 'BURST'     THEN 9
    ELSE 10
  END`;

  const rows = conditions.length > 0
    ? await listQuery.where(and(...conditions)).orderBy(customDigimonsTable.name)
    : await listQuery.orderBy(customDigimonsTable.name);

  res.json({ digimons: rows.map(shapeDigimon) });
});

// GET /digimons/custom/:id/image
router.get("/custom/:id/image", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [row] = await db.select({ imageBase64: customDigimonsTable.imageBase64, imageMimeType: customDigimonsTable.imageMimeType }).from(customDigimonsTable).where(eq(customDigimonsTable.id, id)).limit(1);
  if (!row || !row.imageBase64) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  const buf = Buffer.from(row.imageBase64, "base64");
  res.set("Content-Type", row.imageMimeType ?? "image/gif");
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(buf);
});

// GET /digimons/users — list all players (admin only)
router.get("/users", requireAuth, async (req, res) => {
  if (!req.auth!.isAdmin) { res.status(403).json({ error: "Apenas admins podem fazer isso" }); return; }
  const users = await db.select({ id: usersTable.id, username: usersTable.username, isAdmin: usersTable.isAdmin, role: usersTable.role }).from(usersTable).orderBy(usersTable.username);
  res.json({ users });
});

// PATCH /digimons/:id/toggle — admin toggles isActive on/off
router.patch("/:id/toggle", requireAuth, async (req, res) => {
  if (!req.auth!.isAdmin) {
    res.status(403).json({ error: "Apenas admins podem ativar/desativar Digimons" }); return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [current] = await db.select({ isActive: customDigimonsTable.isActive, name: customDigimonsTable.name })
    .from(customDigimonsTable).where(eq(customDigimonsTable.id, id)).limit(1);
  if (!current) { res.status(404).json({ error: "Digimon não encontrado" }); return; }

  const newState = !current.isActive;
  await db.update(customDigimonsTable)
    .set({ isActive: newState, updatedAt: new Date() })
    .where(eq(customDigimonsTable.id, id));

  res.json({ success: true, isActive: newState, name: current.name });
});

// POST /digimons — create new custom Digimon (admin OR digimon_creator)
router.post("/", requireAuth, async (req, res) => {
  if (!canCreateDigimon(req.auth!)) {
    res.status(403).json({ error: "Sem permissão para criar Digimons" }); return;
  }

  const count = await db.$count(customDigimonsTable);
  if (count >= MAX_CUSTOM_DIGIMONS) { res.status(400).json({ error: "Limite máximo de Digimons atingido" }); return; }

  const {
    name, attribute, rarity, element,
    hp, mp, atk, def, spt, spd,
    description, attackName, attackElement, spiritName, spiritElement,
    isBaseForm, evolvesFromId, requiredLevel, requiredItem, requiredSacrificeCharacter,
    isFusion, fusionPartner, scannable, imageBase64, imageMimeType, imageScale,
  } = req.body as Record<string, unknown>;

  if (!name || !attribute || !rarity || !element || !hp || !mp || !atk || !def || !spt || !spd) {
    res.status(400).json({ error: "Campos obrigatórios faltando" }); return;
  }

  const hasImage = !!imageBase64;

  const [inserted] = await db.insert(customDigimonsTable).values({
    name: String(name),
    attribute: String(attribute),
    rarity: String(rarity),
    element: String(element),
    hp: Number(hp), mp: Number(mp), atk: Number(atk), def: Number(def), spt: Number(spt), spd: Number(spd),
    description: description ? String(description) : '',
    attackName: attackName ? String(attackName) : null,
    attackElement: attackElement ? String(attackElement) : null,
    spiritName: spiritName ? String(spiritName) : null,
    spiritElement: spiritElement ? String(spiritElement) : null,
    isBaseForm: isBaseForm === true || isBaseForm === 'true',
    evolvesFromId: evolvesFromId ? String(evolvesFromId) : null,
    requiredLevel: requiredLevel ? Number(requiredLevel) : null,
    requiredItem: requiredItem ? String(requiredItem) : null,
    requiredSacrificeCharacter: requiredSacrificeCharacter ? String(requiredSacrificeCharacter) : null,
    isFusion: isFusion === true || isFusion === 'true',
    fusionPartner: fusionPartner ? String(fusionPartner) : null,
    scannable: scannable === false || scannable === 'false' ? false : true,
    isActive: hasImage,
    manualEdit: true,
    imageBase64: imageBase64 ? String(imageBase64) : null,
    imageMimeType: imageMimeType ? String(imageMimeType) : null,
    imageScale: imageScale ? Number(imageScale) : 0.8,
  }).returning();

  broadcastUpdateMail(
    `🐉 Novo Digimon: ${name}`,
    `O administrador adicionou o Digimon "${name}" ao jogo! Abra o Banco de Digimons para ver como obtê-lo.`
  ).catch(() => {});

  res.status(201).json({ id: `custom_${inserted.id}`, dbId: inserted.id });
});

// PUT /digimons/:id — edit existing custom Digimon
router.put("/:id", requireAuth, async (req, res) => {
  if (!canEditDigimon(req.auth!)) {
    res.status(403).json({ error: "Apenas o administrador principal pode editar Digimons" }); return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const {
    name, attribute, rarity, element,
    hp, mp, atk, def, spt, spd,
    description, attackName, attackElement, spiritName, spiritElement,
    isBaseForm, evolvesFromId, requiredLevel, requiredItem, requiredSacrificeCharacter,
    isFusion, fusionPartner, scannable, imageBase64, imageMimeType, imageScale,
  } = req.body as Record<string, unknown>;

  const updateData: Partial<typeof customDigimonsTable.$inferInsert> = { updatedAt: new Date(), manualEdit: true };
  if (name !== undefined) updateData.name = String(name);
  if (attribute !== undefined) updateData.attribute = String(attribute);
  if (rarity !== undefined) updateData.rarity = String(rarity);
  if (element !== undefined) updateData.element = String(element);
  if (hp !== undefined) updateData.hp = Number(hp);
  if (mp !== undefined) updateData.mp = Number(mp);
  if (atk !== undefined) updateData.atk = Number(atk);
  if (def !== undefined) updateData.def = Number(def);
  if (spt !== undefined) updateData.spt = Number(spt);
  if (spd !== undefined) updateData.spd = Number(spd);
  if (description !== undefined) updateData.description = String(description);
  if (attackName !== undefined) updateData.attackName = attackName ? String(attackName) : null;
  if (attackElement !== undefined) updateData.attackElement = attackElement ? String(attackElement) : null;
  if (spiritName !== undefined) updateData.spiritName = spiritName ? String(spiritName) : null;
  if (spiritElement !== undefined) updateData.spiritElement = spiritElement ? String(spiritElement) : null;
  if (isBaseForm !== undefined) updateData.isBaseForm = isBaseForm === true || isBaseForm === 'true';
  if (evolvesFromId !== undefined) updateData.evolvesFromId = evolvesFromId ? String(evolvesFromId) : null;
  if (requiredLevel !== undefined) updateData.requiredLevel = requiredLevel ? Number(requiredLevel) : null;
  if (requiredItem !== undefined) updateData.requiredItem = requiredItem ? String(requiredItem) : null;
  if (requiredSacrificeCharacter !== undefined) updateData.requiredSacrificeCharacter = requiredSacrificeCharacter ? String(requiredSacrificeCharacter) : null;
  if (isFusion !== undefined) updateData.isFusion = isFusion === true || isFusion === 'true';
  if (fusionPartner !== undefined) updateData.fusionPartner = fusionPartner ? String(fusionPartner) : null;
  if (scannable !== undefined) updateData.scannable = scannable === true || scannable === 'true';
  if (imageBase64 !== undefined) updateData.imageBase64 = imageBase64 ? String(imageBase64) : null;
  if (imageMimeType !== undefined) updateData.imageMimeType = imageMimeType ? String(imageMimeType) : null;
  if (imageScale !== undefined) updateData.imageScale = Number(imageScale);

  const [updated] = await db.update(customDigimonsTable).set(updateData).where(eq(customDigimonsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Digimon não encontrado" }); return; }

  broadcastUpdateMail(
    `🐉 Digimon atualizado: ${updated.name}`,
    `O administrador modificou o Digimon "${updated.name}". Recarregue o jogo para ver as novidades!`
  ).catch(() => {});

  res.json({ digimon: rowToDigimon(updated) });
});

// DELETE /digimons/:id — delete custom Digimon
router.delete("/:id", requireAuth, async (req, res) => {
  if (!canEditDigimon(req.auth!)) {
    res.status(403).json({ error: "Apenas o administrador principal pode deletar Digimons" }); return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  await db.delete(customDigimonsTable).where(eq(customDigimonsTable.id, id));
  res.json({ success: true });
});

// POST /digimons/send — admin sends Digimon, items, or fragments to a player
router.post("/send", requireAuth, async (req, res) => {
  if (!req.auth!.isAdmin) { res.status(403).json({ error: "Apenas admins podem fazer isso" }); return; }

  const { username, characterId, level, items, fragments, gemas, decorations } = req.body as {
    username?: string; characterId?: string; level?: number;
    items?: string[]; fragments?: { pieceId: string; amount: number }[];
    gemas?: number; decorations?: { type: string; qty: number; name: string }[];
  };
  if (!username) { res.status(400).json({ error: "username é obrigatório" }); return; }

  const [targetUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, String(username))).limit(1);
  if (!targetUser) { res.status(404).json({ error: "Jogador não encontrado" }); return; }

  const [existingSave] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, targetUser.id)).limit(1);
  if (!existingSave) { res.status(404).json({ error: "Save do jogador não encontrado" }); return; }

  const saveData = { ...(existingSave.saveData as Record<string, unknown>) };
  const { characterName } = req.body as { characterName?: string };

  const messages = (saveData.messages ?? []) as Array<Record<string, unknown>>;

  if (characterId) {
    const displayName = characterName ? String(characterName) : String(characterId);
    const msgId = `admin_gift_${String(characterId).replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    messages.push({
      id: msgId,
      title: `🎁 Digimon recebido: ${displayName}!`,
      body: `O administrador enviou um ${displayName} (Lv ${level ? Number(level) : 1}) para você. Clique em Resgatar para adicioná-lo à sua coleção!`,
      reward: { digimonWithLevel: [{ characterId: String(characterId), level: level ? Number(level) : 1 }] },
      rewardClaimed: false,
      isRead: false,
      createdAt: Date.now(),
    });
  }
  const notifLines: string[] = [];

  if (items && items.length > 0) {
    const inventory = (saveData.inventory ?? []) as string[];
    saveData.inventory = [...inventory, ...items.map(String)];
    const names = (req.body as any).itemNames as string[] | undefined;
    const label = names && names.length > 0 ? names.join(', ') : items.join(', ');
    notifLines.push(`⚔️ Itens: ${label}`);
  }

  if (fragments && fragments.length > 0) {
    const pieces = (saveData.pieces ?? {}) as Record<string, number>;
    for (const f of fragments) {
      pieces[f.pieceId] = (pieces[f.pieceId] ?? 0) + Number(f.amount);
    }
    saveData.pieces = pieces;
    const fragNames = (req.body as any).fragmentNames as string[] | undefined;
    const fragLines = fragments.map((f, i) => {
      const name = fragNames?.[i] ?? f.pieceId;
      return `${name} x${f.amount}`;
    });
    notifLines.push(`🔮 Fragmentos: ${fragLines.join(', ')}`);
  }

  if (gemas && Number(gemas) > 0) {
    saveData.gemas = ((saveData.gemas as number) ?? 0) + Number(gemas);
    notifLines.push(`💎 Gemas: ${Number(gemas)}`);
  }

  if (decorations && decorations.length > 0) {
    const decoArray: string[] = [];
    const decoLines: string[] = [];
    for (const d of decorations) {
      const qty = Math.max(1, Math.min(99, Number(d.qty) || 1));
      for (let i = 0; i < qty; i++) decoArray.push(String(d.type));
      decoLines.push(`${d.name ?? d.type} ×${qty}`);
    }
    const decoMsgId = `admin_deco_${Date.now()}`;
    messages.push({
      id: decoMsgId,
      title: `🛣️ Decoração recebida!`,
      body: `O administrador enviou decorações para a sua Digifarm:\n${decoLines.join('\n')}\n\nClique em Resgatar para adicionar ao seu inventário de decorações.`,
      reward: { decoration: decoArray },
      rewardClaimed: false,
      isRead: false,
      createdAt: Date.now(),
    });
  }

  if (notifLines.length > 0) {
    const notifId = `admin_notif_${Date.now()}`;
    messages.push({
      id: notifId,
      title: `🎁 Presente do Administrador!`,
      body: `Você recebeu um presente:\n${notifLines.join('\n')}\n\nOs itens já foram adicionados automaticamente ao seu inventário.`,
      reward: null,
      rewardClaimed: true,
      isRead: false,
      createdAt: Date.now(),
    });
  }

  saveData.messages = messages;

  await db.update(gameSavesTable).set({ saveData, updatedAt: new Date() }).where(eq(gameSavesTable.userId, targetUser.id));
  res.json({ success: true, message: `Enviado para ${username}` });
});

export default router;
