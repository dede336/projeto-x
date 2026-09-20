/**
 * Force-sync: atualiza imageBase64 de TODOS os Digimons custom
 * cujo nome bater com um arquivo em digimons/ do Expo ou no lote imported.
 * Diferente de syncImagesFromFolder, substitui mesmo quem já tem imagem.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, customDigimonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORTED_DIR = path.join(__dirname, "..", "seeds", "images", "imported");
const EXPO_DIR     = path.join(__dirname, "..", "..", "..", "omega-dx10", "assets", "images", "digimons");
const VALID_EXTS   = new Set([".gif", ".webp", ".png", ".jpg", ".jpeg"]);

function norm(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function readImg(filepath: string): { base64: string; mime: string } | null {
  try {
    const ext = path.extname(filepath).toLowerCase();
    const mime = ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : "image/gif";
    return { base64: fs.readFileSync(filepath).toString("base64"), mime };
  } catch { return null; }
}

async function main() {
  // Carrega todos os Digimons ativos
  const all = await db.select({
    id: customDigimonsTable.id,
    name: customDigimonsTable.name,
  }).from(customDigimonsTable);

  console.log(`[forceSync] ${all.length} Digimons no DB.`);

  // Monta índice de arquivos disponíveis: normName → fullPath
  const fileIndex = new Map<string, string>();
  for (const dir of [EXPO_DIR, IMPORTED_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!VALID_EXTS.has(path.extname(f).toLowerCase())) continue;
      const key = norm(path.basename(f, path.extname(f)).replace(/_vg$/i, "").replace(/_evil$/i, ""));
      if (!fileIndex.has(key)) fileIndex.set(key, path.join(dir, f));
    }
  }
  console.log(`[forceSync] ${fileIndex.size} arquivos de imagem indexados.`);

  let updated = 0, skipped = 0;
  for (const row of all) {
    const key = norm(row.name);
    const filepath = fileIndex.get(key);
    if (!filepath) { skipped++; continue; }

    const img = readImg(filepath);
    if (!img) { skipped++; continue; }

    await db.update(customDigimonsTable)
      .set({ imageBase64: img.base64, imageMimeType: img.mime, updatedAt: new Date() })
      .where(eq(customDigimonsTable.id, row.id));

    console.log(`  ✓ ${row.name} ← ${path.basename(filepath)}`);
    updated++;
  }

  console.log(`\n[forceSync] Concluído: ${updated} atualizados, ${skipped} sem correspondência.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
