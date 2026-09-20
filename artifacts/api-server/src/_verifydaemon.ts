import { db, customDigimonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
const rows = await db.select({
  name: customDigimonsTable.name,
  hasImage: customDigimonsTable.imageBase64,
  rarity: customDigimonsTable.rarity,
}).from(customDigimonsTable).where(eq(customDigimonsTable.name, "DaemonMega"));
console.log(JSON.stringify(rows.map(r=>({...r, hasImage: !!r.hasImage})), null, 2));
const orig = await db.select({ name: customDigimonsTable.name }).from(customDigimonsTable).where(eq(customDigimonsTable.name, "Daemon"));
console.log("Original Daemon still exists:", orig.length);
process.exit(0);
