import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envFile = fs.readFileSync('/home/runner/workspace/.env', 'utf8');
const DATABASE_URL = envFile.split('\n').find(l => l.startsWith('DATABASE_URL='))?.split('=').slice(1).join('=').trim();

const pool = new Pool({ connectionString: DATABASE_URL });

const IMAGES_DIR = path.join(__dirname, 'dist/seeds/images');

function readImage(file) {
  try {
    const buf = fs.readFileSync(path.join(IMAGES_DIR, file));
    const ext = path.extname(file).toLowerCase();
    const mimeMap = { '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
    return { base64: buf.toString('base64'), mime: mimeMap[ext] || 'image/png' };
  } catch { return null; }
}

const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(png|gif|jpg|jpeg|webp)$/i.test(f));
console.log(`Total de arquivos em seeds/images: ${files.length}`);

const rows = await pool.query(`SELECT id, name FROM custom_digimons ORDER BY id`);
const digimons = rows.rows;
console.log(`Total de Digimons no BD: ${digimons.length}`);

let linked = 0;
const notFound = [];

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const baseName = path.basename(file, ext).replace(/[_\-\s]/g, '').toLowerCase();
  const img = readImage(file);
  if (!img) continue;

  const matches = digimons.filter(d => d.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === baseName);

  if (matches.length === 0) {
    notFound.push({ file, baseName });
    continue;
  }

  for (const match of matches) {
    await pool.query(
      `UPDATE custom_digimons SET image_base64 = $1, image_mime_type = $2, is_active = true, updated_at = NOW() WHERE id = $3`,
      [img.base64, img.mime, match.id]
    );
    console.log(`✓ ${file} → "${match.name}" (id=${match.id})`);
    linked++;
  }
}

console.log(`\n=== RESUMO ===`);
console.log(`Imagens vinculadas/atualizadas: ${linked}`);
console.log(`Sem Digimon correspondente (${notFound.length}):`);
notFound.forEach(({ file, baseName }) => console.log(`  ${file}  [chave: ${baseName}]`));

await pool.end();
