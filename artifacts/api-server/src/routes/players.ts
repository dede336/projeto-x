import { Router } from "express";
import { db, usersTable, gameSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /players/:username
router.get("/:username", async (req, res) => {
  const { username } = req.params as { username: string };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Jogador não encontrado" });
    return;
  }

  const [save] = await db.select().from(gameSavesTable).where(eq(gameSavesTable.userId, user.id)).limit(1);

  type CollEntry = { ownedId: string; characterId: string; level: number };
  type SaveData = { tamerLevel?: number; playerName?: string; collection?: CollEntry[]; team?: string[]; tamerId?: string };
  const data = (save?.saveData ?? {}) as SaveData;

  const collection = Array.isArray(data.collection) ? data.collection : [];
  const team = Array.isArray(data.team) ? data.team.slice(0, 3) : [];
  const teamDetails = team.map((ownedId) => {
    const entry = collection.find((c) => c.ownedId === ownedId);
    return entry ? { ownedId, characterId: entry.characterId, level: entry.level } : null;
  }).filter(Boolean);

  res.json({
    username: user.username,
    tamerLevel: data.tamerLevel ?? 1,
    tamerName: data.playerName ?? user.username,
    tamerId: data.tamerId ?? null,
    collectionSize: collection.length,
    topTeam: team,
    teamDetails,
    updatedAt: save?.updatedAt ?? user.createdAt,
  });
});

export default router;
