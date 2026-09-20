import { Router } from "express";
import { db, customMapsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { broadcastUpdateMail } from "../lib/broadcastMail.js";

const router = Router();

async function assertAdmin(userId: number, res: any): Promise<boolean> {
  const [u] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u?.isAdmin) { res.status(403).json({ error: "Apenas admins" }); return false; }
  return true;
}

function rowToMap(r: typeof customMapsTable.$inferSelect) {
  return {
    id: `custom_map_${r.id}`, dbId: r.id,
    name: r.name, description: r.description,
    type: r.type, isActive: r.isActive,
    isPermanent: r.isPermanent,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    bitsReward: r.bitsReward,
    stages: r.stages ?? [],
    tileGrid: r.tileGrid ?? null,
    hasImage: !!r.imageBase64, imageMimeType: r.imageMimeType ?? undefined,
  };
}

// GET /maps
router.get("/", async (_req, res) => {
  const rows = await db.select().from(customMapsTable).orderBy(customMapsTable.id);
  res.json({ maps: rows.map(rowToMap) });
});

// GET /maps/:id/image
router.get("/:id/image", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [row] = await db.select({ imageBase64: customMapsTable.imageBase64, imageMimeType: customMapsTable.imageMimeType })
    .from(customMapsTable).where(eq(customMapsTable.id, id)).limit(1);
  if (!row?.imageBase64) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  const buf = Buffer.from(row.imageBase64, "base64");
  res.set("Content-Type", row.imageMimeType ?? "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(buf);
});

// POST /maps
router.post("/", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const { name, description, type, bitsReward, stages, imageBase64, imageMimeType, isPermanent, expiresAt } = req.body as Record<string, unknown>;
  if (!name) { res.status(400).json({ error: "name é obrigatório" }); return; }
  const { tileGrid } = req.body as Record<string, unknown>;
  const [inserted] = await db.insert(customMapsTable).values({
    name: String(name), description: description ? String(description) : "",
    type: String(type ?? "normal"), bitsReward: bitsReward ? Number(bitsReward) : 0,
    isPermanent: isPermanent === false ? false : true,
    expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
    stages: (stages ?? []) as any,
    tileGrid: tileGrid ? (tileGrid as any) : null,
    imageBase64: imageBase64 ? String(imageBase64) : null,
    imageMimeType: imageMimeType ? String(imageMimeType) : null,
  }).returning();

  broadcastUpdateMail(
    `🗺️ Novo Mapa: ${inserted.name}`,
    `O administrador adicionou o mapa "${inserted.name}" ao jogo! Explore novos desafios em Aventura.`
  ).catch(() => {});

  res.status(201).json({ map: rowToMap(inserted) });
});

// PUT /maps/:id
router.put("/:id", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const body = req.body as Record<string, unknown>;
  const update: Partial<typeof customMapsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = String(body.name);
  if (body.description !== undefined) update.description = String(body.description);
  if (body.type !== undefined) update.type = String(body.type);
  if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);
  if (body.isPermanent !== undefined) update.isPermanent = Boolean(body.isPermanent);
  if (body.expiresAt !== undefined) update.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
  if (body.bitsReward !== undefined) update.bitsReward = Number(body.bitsReward);
  if (body.stages !== undefined) update.stages = body.stages as any;
  if (body.tileGrid !== undefined) update.tileGrid = body.tileGrid ? (body.tileGrid as any) : null;
  if (body.imageBase64 !== undefined) update.imageBase64 = body.imageBase64 ? String(body.imageBase64) : null;
  if (body.imageMimeType !== undefined) update.imageMimeType = body.imageMimeType ? String(body.imageMimeType) : null;
  const [updated] = await db.update(customMapsTable).set(update).where(eq(customMapsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Mapa não encontrado" }); return; }

  broadcastUpdateMail(
    `🗺️ Mapa atualizado: ${updated.name}`,
    `O administrador modificou o mapa "${updated.name}". Recarregue o jogo para ver novos desafios!`
  ).catch(() => {});

  res.json({ map: rowToMap(updated) });
});

export default router;
