import { Router } from "express";
import { db, customTamersTable, tamerOverridesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

async function assertAdmin(userId: number, res: any): Promise<boolean> {
  const [u] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u?.isAdmin) { res.status(403).json({ error: "Apenas admins" }); return false; }
  return true;
}

// GET /tamers - public
router.get("/", async (_req, res) => {
  const tamers = await db.select().from(customTamersTable).orderBy(customTamersTable.id);
  const overrides = await db.select().from(tamerOverridesTable);
  res.json({ tamers, overrides });
});

// POST /tamers - admin create
router.post("/", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const body = req.body as {
    name: string;
    fullName: string;
    description?: string;
    accentColor?: string;
    tamerImageBase64?: string;
    tamerImageMime?: string;
    rankingCardImageBase64?: string;
    rankingCardImageMime?: string;
    homeImageBase64?: string;
    homeImageMime?: string;
    avatarOffsetY?: number;
    avatarOffsetX?: number;
    rankingOffsetY?: number;
    rankingOffsetX?: number;
    homeOffsetY?: number;
    homeOffsetX?: number;
    fragmentsToComplete?: number;
    stageDrops?: { stageId: string; stageIndex: number }[];
  };
  if (!body.name || !body.fullName) {
    res.status(400).json({ error: "name e fullName são obrigatórios" });
    return;
  }
  const [created] = await db.insert(customTamersTable).values({
    name: body.name,
    fullName: body.fullName,
    description: body.description ?? "",
    accentColor: body.accentColor ?? "#3b82f6",
    tamerImageBase64: body.tamerImageBase64,
    tamerImageMime: body.tamerImageMime ?? "image/png",
    rankingCardImageBase64: body.rankingCardImageBase64,
    rankingCardImageMime: body.rankingCardImageMime ?? "image/png",
    homeImageBase64: body.homeImageBase64,
    homeImageMime: body.homeImageMime ?? "image/png",
    avatarOffsetY: body.avatarOffsetY ?? -8,
    avatarOffsetX: body.avatarOffsetX ?? 0,
    rankingOffsetY: body.rankingOffsetY ?? -8,
    rankingOffsetX: body.rankingOffsetX ?? 0,
    homeOffsetY: body.homeOffsetY ?? -8,
    homeOffsetX: body.homeOffsetX ?? 0,
    fragmentsToComplete: body.fragmentsToComplete ?? 10,
    stageDrops: body.stageDrops ?? [],
    updatedAt: new Date(),
  }).returning();
  res.json({ tamer: created });
});

// PUT /tamers/:id - admin update
router.put("/:id", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const body = req.body as Partial<{
    name: string;
    fullName: string;
    description: string;
    accentColor: string;
    tamerImageBase64: string;
    tamerImageMime: string;
    rankingCardImageBase64: string;
    rankingCardImageMime: string;
    homeImageBase64: string;
    homeImageMime: string;
    avatarOffsetY: number;
    avatarOffsetX: number;
    rankingOffsetY: number;
    rankingOffsetX: number;
    homeOffsetY: number;
    homeOffsetX: number;
    fragmentsToComplete: number;
    stageDrops: { stageId: string; stageIndex: number }[];
  }>;
  const [updated] = await db.update(customTamersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(customTamersTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Tamer não encontrado" }); return; }
  res.json({ tamer: updated });
});

// DELETE /tamers/:id - admin
router.delete("/:id", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  await db.delete(customTamersTable).where(eq(customTamersTable.id, id));
  res.json({ success: true });
});

// PUT /tamers/overrides/:tamerId - admin update built-in tamer overrides
router.put("/overrides/:tamerId", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const { tamerId } = req.params;
  const body = req.body as Partial<{
    avatarOffsetY: number;
    avatarOffsetX: number;
    rankingOffsetY: number;
    rankingOffsetX: number;
    rankingCardImageBase64: string;
    rankingCardImageMime: string;
  }>;
  const [result] = await db.insert(tamerOverridesTable)
    .values({ tamerId, ...body, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: tamerOverridesTable.tamerId,
      set: { ...body, updatedAt: new Date() },
    })
    .returning();
  res.json({ override: result });
});

export default router;
