import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OMEGA_ROOT = path.resolve(__dirname, "../../../../artifacts/omega-dx10");
const CHAR_IMAGES_FILE = path.join(OMEGA_ROOT, "constants/characterImages.ts");

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parsePaths(): Map<string, string> {
  const text = fs.readFileSync(CHAR_IMAGES_FILE, "utf8");
  const map = new Map<string, string>();
  const regex = /^\s*(\w+)\s*:\s*require\(['"]([^'"]+)['"]\)/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const key = normalize(m[1]);
    const relPath = m[2].replace("../", "");
    const absPath = path.join(OMEGA_ROOT, relPath);
    map.set(key, absPath);
  }
  return map;
}

function mimeType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

async function main() {
  const { db } = await import("@workspace/db");
  const { customDigimonsTable } = await import("@workspace/db/schema");
  const { isNull, eq } = await import("drizzle-orm");

  const imageMap = parsePaths();
  console.log(`Mapeamento carregado: ${imageMap.size} entradas`);

  const missing = await db.select({
    id: customDigimonsTable.id,
    name: customDigimonsTable.name,
  }).from(customDigimonsTable).where(isNull(customDigimonsTable.imageBase64));

  console.log(`Digimons sem imagem no banco: ${missing.length}`);

  let updated = 0;
  let notFound: string[] = [];

  for (const digi of missing) {
    const key = normalize(digi.name);
    const imgPath = imageMap.get(key);

    if (!imgPath || !fs.existsSync(imgPath)) {
      notFound.push(digi.name);
      continue;
    }

    const buf = fs.readFileSync(imgPath);
    const base64 = buf.toString("base64");
    const mime = mimeType(imgPath);

    await db.update(customDigimonsTable)
      .set({ imageBase64: base64, imageMimeType: mime, updatedAt: new Date() })
      .where(eq(customDigimonsTable.id, digi.id));

    console.log(`  ✅ ${digi.name} (id=${digi.id}) → ${path.basename(imgPath)}`);
    updated++;
  }

  console.log(`\nConcluído: ${updated} atualizados`);
  if (notFound.length > 0) {
    console.log(`Sem correspondência (${notFound.length}): ${notFound.slice(0, 30).join(", ")}${notFound.length > 30 ? "..." : ""}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
