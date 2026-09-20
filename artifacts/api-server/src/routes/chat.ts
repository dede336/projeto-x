import { Router } from "express";
import { db, usersTable, chatMessagesTable, globalChatMessagesTable } from "@workspace/db";
import { eq, or, and, desc, sql, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { isUserOnline, getOnlineUsers } from "../lib/socket.js";
import { containsProfanity } from "../lib/profanity.js";

const router = Router();

// GET /api/chat/online — list of currently online usernames
router.get("/online", requireAuth, (_req, res) => {
  res.json({ online: getOnlineUsers() });
});

// GET /api/chat/conversations — last message per conversation partner
router.get("/conversations", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  try {
    const msgs = await db
      .select()
      .from(chatMessagesTable)
      .where(
        or(
          eq(chatMessagesTable.fromUserId, userId),
          eq(chatMessagesTable.toUserId, userId)
        )
      )
      .orderBy(desc(chatMessagesTable.createdAt));

    // Group by conversation partner
    const convMap = new Map<number, typeof msgs[0]>();
    for (const msg of msgs) {
      const partnerId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      if (!convMap.has(partnerId)) convMap.set(partnerId, msg);
    }

    // Fetch partner usernames and unread counts
    const result = await Promise.all(
      Array.from(convMap.entries()).map(async ([partnerId, lastMsg]) => {
        const [partner] = await db
          .select({ username: usersTable.username })
          .from(usersTable)
          .where(eq(usersTable.id, partnerId))
          .limit(1);

        // Count unread (messages sent to me, not yet read)
        const unreadRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(chatMessagesTable)
          .where(
            and(
              eq(chatMessagesTable.fromUserId, partnerId),
              eq(chatMessagesTable.toUserId, userId),
              sql`${chatMessagesTable.readAt} IS NULL`
            )
          );
        const unread = Number(unreadRows[0]?.count ?? 0);

        return {
          partnerId,
          partnerUsername: partner?.username ?? "unknown",
          lastMessage: {
            id: lastMsg.id,
            content: lastMsg.content,
            from: lastMsg.fromUserId === userId ? req.auth!.username : (partner?.username ?? ""),
            createdAt: lastMsg.createdAt.toISOString(),
          },
          unread,
          online: isUserOnline(partner?.username ?? ""),
        };
      })
    );

    res.json({ conversations: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// GET /api/chat/messages/:username — history with a specific user
router.get("/messages/:username", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { username } = req.params;
  try {
    const [partner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!partner) return res.status(404).json({ error: "User not found" });

    const msgs = await db
      .select()
      .from(chatMessagesTable)
      .where(
        or(
          and(eq(chatMessagesTable.fromUserId, userId), eq(chatMessagesTable.toUserId, partner.id)),
          and(eq(chatMessagesTable.fromUserId, partner.id), eq(chatMessagesTable.toUserId, userId))
        )
      )
      .orderBy(chatMessagesTable.createdAt);

    res.json({
      messages: msgs.map((m) => ({
        id: m.id,
        from: m.fromUserId === userId ? req.auth!.username : username,
        to: m.toUserId === userId ? req.auth!.username : username,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/chat/messages/:username — send a message via REST (offline fallback)
router.post("/messages/:username", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const senderUsername = req.auth!.username;
  const { username } = req.params;
  const { content } = req.body as { content?: string };
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  try {
    const [recipient] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (!recipient) return res.status(404).json({ error: "User not found" });
    const [saved] = await db
      .insert(chatMessagesTable)
      .values({ fromUserId: userId, toUserId: recipient.id, content: content.trim() })
      .returning();
    res.json({
      message: {
        id: saved.id,
        from: senderUsername,
        to: username,
        content: saved.content,
        createdAt: saved.createdAt.toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/chat/messages/:username/read — mark all unread from this user as read
router.post("/messages/:username/read", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { username } = req.params;
  try {
    const [partner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!partner) return res.status(404).json({ error: "User not found" });

    await db
      .update(chatMessagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(chatMessagesTable.fromUserId, partner.id),
          eq(chatMessagesTable.toUserId, userId),
          sql`${chatMessagesTable.readAt} IS NULL`
        )
      );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

// GET /api/chat/global — last 100 global messages
router.get("/global", requireAuth, async (_req, res) => {
  try {
    const msgs = await db
      .select({
        id: globalChatMessagesTable.id,
        content: globalChatMessagesTable.content,
        createdAt: globalChatMessagesTable.createdAt,
        from: usersTable.username,
      })
      .from(globalChatMessagesTable)
      .innerJoin(usersTable, eq(globalChatMessagesTable.fromUserId, usersTable.id))
      .orderBy(desc(globalChatMessagesTable.createdAt))
      .limit(100);

    res.json({ messages: msgs.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) });
  } catch {
    res.status(500).json({ error: "Failed to load global chat" });
  }
});

// POST /api/chat/global — REST fallback for sending global message
router.post("/global", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const username = req.auth!.username;
  const { content } = req.body as { content?: string };
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  if (containsProfanity(content)) return res.status(400).json({ error: "Mensagem contém palavras ofensivas." });
  try {
    const [saved] = await db
      .insert(globalChatMessagesTable)
      .values({ fromUserId: userId, content: content.trim() })
      .returning();
    res.json({
      message: { id: saved.id, from: username, content: saved.content, createdAt: saved.createdAt.toISOString() },
    });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
