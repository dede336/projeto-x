import { Router } from "express";
import { db, usersTable, gameSavesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

type SaveData = {
  tamerLevel?: number;
  playerName?: string;
  collection?: { ownedId: string; characterId: string; level: number; exp?: number }[];
  tamerId?: string;
};

router.get("/", async (req, res) => {
  const limitRaw = Number(req.query["limit"] ?? 50);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 50 : limitRaw), 100);
  const type = String(req.query["type"] ?? "level");

  const rows = await db
    .select({
      username: usersTable.username,
      isAdmin: usersTable.isAdmin,
      saveData: gameSavesTable.saveData,
      updatedAt: gameSavesTable.updatedAt,
    })
    .from(gameSavesTable)
    .innerJoin(usersTable, eq(gameSavesTable.userId, usersTable.id))
    .orderBy(desc(gameSavesTable.updatedAt))
    .limit(limit * 5);

  const filtered = rows.filter((r) => !r.isAdmin);

  if (type === "count") {
    const entries = filtered
      .map((row) => {
        const data = row.saveData as SaveData;
        return {
          username: row.username,
          tamerLevel: data.tamerLevel ?? 1,
          tamerName: data.playerName ?? row.username,
          collectionSize: Array.isArray(data.collection) ? data.collection.length : 0,
          tamerId: data.tamerId ?? null,
          updatedAt: row.updatedAt,
        };
      })
      .sort((a, b) => b.collectionSize - a.collectionSize || b.tamerLevel - a.tamerLevel)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));
    res.json(entries);
    return;
  }

  if (type === "stats") {
    const entries = filtered
      .map((row) => {
        const data = row.saveData as SaveData;
        const collection = Array.isArray(data.collection) ? data.collection : [];
        const bestLevel = collection.reduce((max, c) => Math.max(max, c.level ?? 1), 1);
        const best = collection.find((c) => c.level === bestLevel) ?? null;
        return {
          username: row.username,
          tamerLevel: data.tamerLevel ?? 1,
          tamerName: data.playerName ?? row.username,
          collectionSize: collection.length,
          tamerId: data.tamerId ?? null,
          bestDigimonCharId: best?.characterId ?? null,
          bestDigimonLevel: bestLevel,
          updatedAt: row.updatedAt,
        };
      })
      .sort((a, b) => b.bestDigimonLevel - a.bestDigimonLevel || b.collectionSize - a.collectionSize)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));
    res.json(entries);
    return;
  }

  const entries = filtered
    .map((row) => {
      const data = row.saveData as SaveData;
      return {
        username: row.username,
        tamerLevel: data.tamerLevel ?? 1,
        tamerName: data.playerName ?? row.username,
        collectionSize: Array.isArray(data.collection) ? data.collection.length : 0,
        tamerId: data.tamerId ?? null,
        updatedAt: row.updatedAt,
      };
    })
    .sort((a, b) => b.tamerLevel - a.tamerLevel || b.collectionSize - a.collectionSize)
    .slice(0, limit)
    .map((e, i) => ({ rank: i + 1, ...e }));

  res.json(entries);
});

export default router;
