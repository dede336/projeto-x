async function main() {
  const { db } = await import("@workspace/db");
  const { customDigimonsTable } = await import("@workspace/db/schema");
  const { isNotNull, isNull, sql } = await import("drizzle-orm");

  const withImg = await db.select({ count: sql`count(*)` }).from(customDigimonsTable).where(isNotNull(customDigimonsTable.imageBase64));
  const withoutImg = await db.select({ count: sql`count(*)` }).from(customDigimonsTable).where(isNull(customDigimonsTable.imageBase64));
  console.log("Com imagem:", withImg[0].count);
  console.log("Sem imagem:", withoutImg[0].count);

  const sample = await db.select({
    id: customDigimonsTable.id,
    name: customDigimonsTable.name,
    hasImageFlag: sql`(image_base64 IS NOT NULL)`,
  }).from(customDigimonsTable).limit(5);

  console.log("\nAmostra hasImageFlag:");
  sample.forEach((r: any) => console.log(`  ${r.name}: hasImageFlag=${r.hasImageFlag} (type=${typeof r.hasImageFlag})`));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
