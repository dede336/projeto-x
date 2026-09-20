import { Router } from "express";
import { db, usersTable, gameSavesTable, friendshipsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const rows = await db
    .select({
      id: friendshipsTable.id,
      requesterId: friendshipsTable.requesterId,
      addresseeId: friendshipsTable.addresseeId,
      status: friendshipsTable.status,
    })
    .from(friendshipsTable)
    .where(
      and(
        or(
          eq(friendshipsTable.requesterId, userId),
          eq(friendshipsTable.addresseeId, userId)
        ),
        eq(friendshipsTable.status, "accepted")
      )
    );

  const friendIds = rows.map((r) =>
    r.requesterId === userId ? r.addresseeId : r.requesterId
  );

  if (friendIds.length === 0) {
    res.json({ friends: [] });
    return;
  }

  const friendUsers = await Promise.all(
    friendIds.map(async (fId) => {
      const [user] = await db
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, fId))
        .limit(1);
      if (!user) return null;

      const [save] = await db
        .select({ saveData: gameSavesTable.saveData })
        .from(gameSavesTable)
        .where(eq(gameSavesTable.userId, fId))
        .limit(1);

      type SD = { playerName?: string; tamerLevel?: number; team?: string[]; collection?: { ownedId: string; characterId: string; level: number }[]; tamerId?: string };
      const data = (save?.saveData ?? {}) as SD;
      const team = Array.isArray(data.team) ? data.team.slice(0, 3) : [];
      const collection = Array.isArray(data.collection) ? data.collection : [];
      const teamDetails = team.map((ownedId) => {
        const entry = collection.find((c) => c.ownedId === ownedId);
        return entry ? { ownedId, characterId: entry.characterId, level: entry.level } : null;
      }).filter(Boolean);

      return {
        username: user.username,
        playerName: data.playerName ?? user.username,
        tamerLevel: data.tamerLevel ?? 1,
        tamerId: data.tamerId ?? null,
        teamDetails,
        friendshipId: rows.find((r) => r.requesterId === fId || r.addresseeId === fId)!.id,
      };
    })
  );

  res.json({ friends: friendUsers.filter(Boolean) });
});

router.get("/requests", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const rows = await db
    .select({
      id: friendshipsTable.id,
      requesterId: friendshipsTable.requesterId,
      status: friendshipsTable.status,
      createdAt: friendshipsTable.createdAt,
    })
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.addresseeId, userId),
        eq(friendshipsTable.status, "pending")
      )
    );

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const [user] = await db
        .select({ username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.id, r.requesterId))
        .limit(1);
      return { id: r.id, username: user?.username ?? "?", createdAt: r.createdAt };
    })
  );

  res.json({ requests: enriched });
});

router.post("/request", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { username } = req.body as { username?: string };
  if (!username) { res.status(400).json({ error: "username é obrigatório" }); return; }

  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, String(username)))
    .limit(1);
  if (!target) { res.status(404).json({ error: "Jogador não encontrado" }); return; }
  if (target.id === userId) { res.status(400).json({ error: "Você não pode adicionar a si mesmo" }); return; }

  const existing = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, target.id)),
        and(eq(friendshipsTable.requesterId, target.id), eq(friendshipsTable.addresseeId, userId))
      )
    )
    .limit(1);

  if (existing.length > 0) { res.status(409).json({ error: "Solicitação já existe" }); return; }

  const [row] = await db.insert(friendshipsTable).values({
    requesterId: userId,
    addresseeId: target.id,
    status: "pending",
  }).returning();

  res.status(201).json({ id: row.id });
});

router.put("/:id/accept", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [row] = await db
    .select()
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.addresseeId, userId)))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

  await db.update(friendshipsTable).set({ status: "accepted" }).where(eq(friendshipsTable.id, id));
  res.json({ success: true });
});

router.delete("/:username", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { username } = req.params as { username: string };

  const [target] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (!target) { res.status(404).json({ error: "Jogador não encontrado" }); return; }

  await db.delete(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, target.id)),
      and(eq(friendshipsTable.requesterId, target.id), eq(friendshipsTable.addresseeId, userId))
    )
  );

  res.json({ success: true });
});

export default router;
