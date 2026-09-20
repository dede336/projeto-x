import { Router } from "express";
import { db, gameConfigTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

const DEFAULTS: Record<string, string> = {
  farmXpPerHour: "10",
  farmMaxHours: "8",
};

async function assertAdmin(userId: number, res: any): Promise<boolean> {
  const [u] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u?.isAdmin) { res.status(403).json({ error: "Apenas admins" }); return false; }
  return true;
}

router.get("/", async (_req, res) => {
  const rows = await db.select().from(gameConfigTable);
  const config: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) config[row.key] = row.value;
  res.json({ config });
});

router.put("/:key", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const { key } = req.params;
  const { value } = req.body as { value: string };
  if (!value) { res.status(400).json({ error: "Valor obrigatório" }); return; }
  await db.insert(gameConfigTable).values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: gameConfigTable.key, set: { value, updatedAt: new Date() } });
  res.json({ success: true, key, value });
});

export default router;
