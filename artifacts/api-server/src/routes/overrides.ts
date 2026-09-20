import { Router } from "express";
import { db, characterOverridesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

async function assertAdmin(userId: number, res: any): Promise<boolean> {
  const [u] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!u?.isAdmin) { res.status(403).json({ error: "Apenas admins" }); return false; }
  return true;
}

// GET /overrides
router.get("/", async (_req, res) => {
  const rows = await db.select().from(characterOverridesTable).orderBy(characterOverridesTable.characterId);
  const overrides = rows.map((r) => ({
    characterId: r.characterId,
    name: r.name ?? undefined,
    attribute: r.attribute ?? undefined,
    rarity: r.rarity ?? undefined,
    element: r.element ?? undefined,
    hp: r.hp ?? undefined, mp: r.mp ?? undefined, atk: r.atk ?? undefined,
    def: r.def ?? undefined, spt: r.spt ?? undefined, spd: r.spd ?? undefined,
    description: r.description ?? undefined,
    attackName: r.attackName ?? undefined, attackElement: r.attackElement ?? undefined,
    spiritName: r.spiritName ?? undefined, spiritElement: r.spiritElement ?? undefined,
    hasImage: !!r.imageBase64, imageMimeType: r.imageMimeType ?? undefined,
    imageScale: r.imageScale ?? undefined, scannable: r.scannable ?? undefined,
  }));
  res.json({ overrides });
});

// GET /overrides/:characterId
router.get("/:characterId", async (req, res) => {
  const [row] = await db.select().from(characterOverridesTable).where(eq(characterOverridesTable.characterId, req.params.characterId)).limit(1);
  if (!row) { res.json({ override: null }); return; }
  res.json({ override: row });
});

// GET /overrides/:characterId/image
router.get("/:characterId/image", async (req, res) => {
  const [row] = await db.select({ imageBase64: characterOverridesTable.imageBase64, imageMimeType: characterOverridesTable.imageMimeType })
    .from(characterOverridesTable).where(eq(characterOverridesTable.characterId, req.params.characterId)).limit(1);
  if (!row?.imageBase64) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  const buf = Buffer.from(row.imageBase64, "base64");
  res.set("Content-Type", row.imageMimeType ?? "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(buf);
});

// PUT /overrides/:characterId
router.put("/:characterId", requireAuth, async (req, res) => {
  if (!await assertAdmin(req.auth!.userId, res)) return;
  const characterId = req.params.characterId;
  const body = req.body as Record<string, unknown>;

  const values: Partial<typeof characterOverridesTable.$inferInsert> & { characterId: string } = {
    characterId,
    updatedAt: new Date(),
  };
  const fields = ["name","attribute","rarity","element","hp","mp","atk","def","spt","spd",
    "description","attackName","attackElement","spiritName","spiritElement",
    "imageBase64","imageMimeType","imageScale","scannable"] as const;
  for (const f of fields) {
    if (body[f] !== undefined) {
      const numFields = ["hp","mp","atk","def","spt","spd","imageScale"];
      const boolFields = ["scannable"];
      if (numFields.includes(f)) (values as any)[f] = Number(body[f]);
      else if (boolFields.includes(f)) (values as any)[f] = Boolean(body[f]);
      else (values as any)[f] = body[f] === null ? null : String(body[f]);
    }
  }

  await db.insert(characterOverridesTable).values(values as any)
    .onConflictDoUpdate({ target: characterOverridesTable.characterId, set: values as any });

  res.json({ success: true, characterId });
});

export default router;
