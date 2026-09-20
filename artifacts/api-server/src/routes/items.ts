import { Router } from "express";
import { db, customItemsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { broadcastUpdateMail } from "../lib/broadcastMail.js";

const router = Router();

async function assertAdmin(userId: number, res: any): Promise<boolean> {
  const [u] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u?.isAdmin) { res.status(403).json({ error: "Apenas admins" }); return false; }
  return true;
}

function rowToItem(r: typeof customItemsTable.$inferSelect) {
  return {
    id: `custom_item_${r.id}`, dbId: r.id,
    name: r.name, type: r.type, slot: r.slot ?? undefined,
    description: r.description, rarity: r.rarity,
    howToObtain: r.howToObtain, isActive: r.isActive,
    bonuses: r.bonuses ?? {},
    percentBonuses: r.percentBonuses ?? undefined,
    hasImage: !!r.imageBase64, imageMimeType: r.imageMimeType ?? undefined,
  };
}

// GET /items
router.get("/", async (_req, res) => {
  const rows = await db.select().from(customItemsTable).orderBy(customItemsTable.id);
  res.json({ items: rows.map(rowToItem) });
});

// GET /items/:id/image
router.get("/:id/image", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [row] = await db.select({ imageBase64: customItemsTable.imageBase64, imageMimeType: customItemsTable.imageMimeType })
    .from(customItemsTable).where(eq(customItemsTable.id, id)).limit(1);
  if (!row?.imageBase64) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  const buf = Buffer.from(row.imageBase64, "base64");
  res.set("Content-Type", row.imageMimeType ?? "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(buf);
});

// POST /items
router.post("/", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const { name, type, slot, description, rarity, howToObtain, bonuses, percentBonuses, imageBase64, imageMimeType } = req.body as Record<string, unknown>;
  if (!name) { res.status(400).json({ error: "name é obrigatório" }); return; }
  const [inserted] = await db.insert(customItemsTable).values({
    name: String(name), type: String(type ?? "equipment"),
    slot: slot ? String(slot) : null,
    description: description ? String(description) : "",
    rarity: String(rarity ?? "COMMON"),
    howToObtain: String(howToObtain ?? "drop"),
    bonuses: (bonuses ?? {}) as any,
    percentBonuses: percentBonuses ? percentBonuses as any : null,
    imageBase64: imageBase64 ? String(imageBase64) : null,
    imageMimeType: imageMimeType ? String(imageMimeType) : null,
  }).returning();
  broadcastUpdateMail(
    `🎒 Novo Item: ${name}`,
    `O administrador adicionou o item "${name}" ao jogo! Confira na Mochila e na Banca.`
  ).catch(() => {});

  res.status(201).json({ item: rowToItem(inserted) });
});

// PUT /items/:id
router.put("/:id", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const body = req.body as Record<string, unknown>;
  const update: Partial<typeof customItemsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = String(body.name);
  if (body.type !== undefined) update.type = String(body.type);
  if (body.slot !== undefined) update.slot = body.slot ? String(body.slot) : null;
  if (body.description !== undefined) update.description = String(body.description);
  if (body.rarity !== undefined) update.rarity = String(body.rarity);
  if (body.howToObtain !== undefined) update.howToObtain = String(body.howToObtain);
  if (body.bonuses !== undefined) update.bonuses = body.bonuses as any;
  if (body.percentBonuses !== undefined) update.percentBonuses = body.percentBonuses as any;
  if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);
  if (body.imageBase64 !== undefined) update.imageBase64 = body.imageBase64 ? String(body.imageBase64) : null;
  if (body.imageMimeType !== undefined) update.imageMimeType = body.imageMimeType ? String(body.imageMimeType) : null;
  const [updated] = await db.update(customItemsTable).set(update).where(eq(customItemsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Item não encontrado" }); return; }

  broadcastUpdateMail(
    `🎒 Item atualizado: ${updated.name}`,
    `O administrador modificou o item "${updated.name}". Recarregue o jogo para ver as novidades!`
  ).catch(() => {});

  res.json({ item: rowToItem(updated) });
});

export default router;
