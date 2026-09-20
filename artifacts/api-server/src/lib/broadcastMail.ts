import { db, gameSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function broadcastUpdateMail(title: string, body: string): Promise<void> {
  const mailId = `update_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newMail = {
    id: mailId,
    title,
    body,
    rewardClaimed: false,
    isRead: false,
    createdAt: Date.now(),
  };

  const allSaves = await db.select().from(gameSavesTable);

  for (const save of allSaves) {
    const saveData = (save.saveData ?? {}) as Record<string, unknown>;
    const messages = (saveData.messages ?? []) as { id: string }[];
    if (messages.some((m) => m.id === mailId)) continue;
    const updated = { ...saveData, messages: [newMail, ...messages] };
    await db.update(gameSavesTable)
      .set({ saveData: updated, updatedAt: new Date() })
      .where(eq(gameSavesTable.userId, save.userId));
  }
}
