async function main() {
  const { db } = await import("@workspace/db");
  const { customDigimonsTable } = await import("@workspace/db/schema");
  const { isNull, asc } = await import("drizzle-orm");

  const missing = await db.select({
    id: customDigimonsTable.id,
    name: customDigimonsTable.name,
  }).from(customDigimonsTable)
    .where(isNull(customDigimonsTable.imageBase64))
    .orderBy(asc(customDigimonsTable.id))
    .limit(100);

  console.log(`\nPrimeiros 100 sem imagem (total: ids variam):`);
  missing.forEach((r: any) => console.log(`  id=${r.id} name="${r.name}"`));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
