import { Router } from "express";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const router = Router();

const MAPS_DIR = path.join("/home/runner/workspace/artifacts/pokemon-game/public/maps");

// POST /api/save-map
// Grava o JSON do mapa diretamente no arquivo em disco
router.post("/", async (req, res) => {
  const map = req.body as Record<string, unknown>;

  if (!map.id || !map.cells || !map.width || !map.height) {
    res.status(400).json({ ok: false, error: "Campos obrigatórios: id, cells, width, height" });
    return;
  }

  const mapId = String(map.id);
  if (!/^[A-Z0-9_]+$/.test(mapId)) {
    res.status(400).json({ ok: false, error: "ID de mapa inválido (use apenas letras maiúsculas, números e _)" });
    return;
  }

  const filePath = path.join(MAPS_DIR, `${mapId}.json`);

  try {
    await mkdir(MAPS_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(map, null, 2), "utf-8");
    res.json({ ok: true, file: `public/maps/${mapId}.json` });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "Erro ao gravar arquivo" });
  }
});

export default router;
