#!/usr/bin/env python3
"""
Processa o zip de imagens de Digimon:
1. Converte GIFs → WebP (2 passos, frame disposal correto) para characters/ e digimons/
2. Converte PNGs → WebP para characters/ e digimons/
3. Copia todas as imagens para seeds/images/ (formato original, para o seed.ts)
4. Gera script TS para force-update do DB
"""
import zipfile, subprocess, os, tempfile, shutil, re

ZIP_PATH = "attached_assets/digimon_images_1784720293980.zip"
CHARS_DIR = "artifacts/omega-dx10/assets/images/characters"
DIGIS_DIR = "artifacts/omega-dx10/assets/images/digimons"
SEEDS_DIR = "artifacts/api-server/src/seeds/images"

# ── Funções de conversão ────────────────────────────────────────────────────

def convert_gif_to_webp_2step(gif_path, webp_out, quality=75):
    """Converte GIF → WebP em 2 passos (evita frame overlap)."""
    tmpdir = tempfile.mkdtemp()
    try:
        # Passo 1: extrai frames como PNG (disposal aplicado pelo ffmpeg)
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", gif_path, "-vsync", "0",
             os.path.join(tmpdir, "f%04d.png")],
            capture_output=True)
        frames = sorted([f for f in os.listdir(tmpdir) if f.endswith(".png")])
        if not frames:
            return False
        # Passo 2: obtém fps do GIF original
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", gif_path],
            capture_output=True, text=True)
        fps_str = probe.stdout.strip().split("\n")[0] if probe.stdout.strip() else "10"
        try:
            parts = fps_str.split("/")
            fps = float(parts[0]) / float(parts[1]) if len(parts) == 2 else float(fps_str)
            fps = max(1, min(round(fps), 50))
        except:
            fps = 10
        # Passo 3: remonta como WebP animado com frames completos
        r2 = subprocess.run(
            ["ffmpeg", "-y", "-framerate", str(fps),
             "-i", os.path.join(tmpdir, "f%04d.png"),
             "-c:v", "libwebp", "-lossless", "0", "-q:v", str(quality),
             "-loop", "0", "-an", webp_out],
            capture_output=True)
        return r2.returncode == 0
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

def convert_png_to_webp(png_path, webp_out, quality=82):
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", png_path,
         "-c:v", "libwebp", "-lossless", "0", "-q:v", str(quality),
         webp_out],
        capture_output=True)
    return r.returncode == 0

def convert_to_webp(src_path, webp_out, file_size_kb=0):
    ext = os.path.splitext(src_path)[1].lower()
    quality = 70 if file_size_kb > 2000 else 75 if file_size_kb > 500 else 82
    if ext == ".gif":
        return convert_gif_to_webp_2step(src_path, webp_out, quality=quality)
    elif ext in (".png", ".jpg", ".jpeg"):
        return convert_png_to_webp(src_path, webp_out, quality=quality)
    elif ext == ".webp":
        shutil.copy2(src_path, webp_out)
        return True
    return False

# ── Main ────────────────────────────────────────────────────────────────────

def main():
    z = zipfile.ZipFile(ZIP_PATH)
    files = [n for n in z.namelist() if not n.endswith("/")]

    # Índice dos destinos (base_name_normalizado → caminho_existente)
    def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())

    chars_map = {norm(os.path.splitext(f)[0]): os.path.join(CHARS_DIR, f)
                 for f in os.listdir(CHARS_DIR) if f.endswith(".webp")}
    digis_map = {norm(os.path.splitext(f)[0]): os.path.join(DIGIS_DIR, f)
                 for f in os.listdir(DIGIS_DIR) if f.endswith(".webp")}
    seeds_map = {norm(os.path.splitext(f)[0]): f
                 for f in os.listdir(SEEDS_DIR)}

    stats = {"chars": 0, "digis": 0, "seeds_new": 0, "seeds_replaced": 0, "skip": 0, "fail": 0}
    seeds_to_update = []  # lista de (filename_no_seeds, nome_base) para force-update DB

    for entry in sorted(files):
        basename = os.path.basename(entry)
        base_noext = os.path.splitext(basename)[0]
        ext = os.path.splitext(basename)[1].lower()
        base_norm = norm(base_noext)
        info = z.getinfo(entry)
        size_kb = info.file_size / 1024

        # Extrai para temp
        tmpdir = tempfile.mkdtemp()
        try:
            data = z.read(entry)
            tmp_src = os.path.join(tmpdir, basename)
            with open(tmp_src, "wb") as f:
                f.write(data)

            placed_char = False
            placed_digi = False

            # ── 1. characters/ ──────────────────────────────────────────────
            if base_norm in chars_map:
                dest = chars_map[base_norm]  # caminho do .webp existente
                tmp_webp = os.path.join(tmpdir, "out.webp")
                if convert_to_webp(tmp_src, tmp_webp, size_kb):
                    shutil.copy2(tmp_webp, dest)
                    print(f"  [chars] ✓ {basename} → {os.path.basename(dest)}")
                    stats["chars"] += 1
                    placed_char = True
                else:
                    print(f"  [chars] ✗ FALHOU: {basename}")
                    stats["fail"] += 1

            # ── 2. digimons/ ────────────────────────────────────────────────
            if base_norm in digis_map:
                dest = digis_map[base_norm]
                tmp_webp = os.path.join(tmpdir, "out_digi.webp")
                if convert_to_webp(tmp_src, tmp_webp, size_kb):
                    shutil.copy2(tmp_webp, dest)
                    print(f"  [digis] ✓ {basename} → {os.path.basename(dest)}")
                    stats["digis"] += 1
                    placed_digi = True
                else:
                    print(f"  [digis] ✗ FALHOU: {basename}")
                    stats["fail"] += 1

            # ── 3. seeds/images/ ─────────────────────────────────────────────
            # Verifica se já existe (qualquer extensão)
            existing_seed = seeds_map.get(base_norm)
            if existing_seed:
                dest_path = os.path.join(SEEDS_DIR, existing_seed)
                # Substitui o arquivo existente pelo novo (mesmo nome, nova extensão se diferente)
                new_seed_name = existing_seed  # mantém nome original do seeds
                # Se extensão mudou, remove o antigo e salva com extensão nova
                if os.path.splitext(existing_seed)[1].lower() != ext:
                    os.remove(dest_path)
                    new_seed_name = os.path.splitext(existing_seed)[0] + ext
                    dest_path = os.path.join(SEEDS_DIR, new_seed_name)
                shutil.copy2(tmp_src, dest_path)
                print(f"  [seeds] ↺ {basename} → {new_seed_name}")
                stats["seeds_replaced"] += 1
                seeds_to_update.append(new_seed_name)
            else:
                # Arquivo novo — adiciona direto
                # Limpa nome: remove timestamp (_NNNN... no final) e caracteres problemáticos
                clean_name = re.sub(r"_\d{10,}$", "", base_noext)  # remove _timestamp
                new_seed_name = clean_name + ext
                dest_path = os.path.join(SEEDS_DIR, new_seed_name)
                shutil.copy2(tmp_src, dest_path)
                print(f"  [seeds] + {basename} → {new_seed_name} (NOVO)")
                stats["seeds_new"] += 1
                seeds_to_update.append(new_seed_name)

        except Exception as e:
            print(f"  ERRO {basename}: {e}")
            stats["fail"] += 1
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    z.close()

    print(f"""
╔═══════════════════════════════════════╗
║           RESULTADO FINAL             ║
╠═══════════════════════════════════════╣
║  characters/   atualizados: {stats['chars']:>4}      ║
║  digimons/     atualizados: {stats['digis']:>4}      ║
║  seeds/ substituídos:       {stats['seeds_replaced']:>4}      ║
║  seeds/ novos:              {stats['seeds_new']:>4}      ║
║  falhas:                    {stats['fail']:>4}      ║
╚═══════════════════════════════════════╝
""")

if __name__ == "__main__":
    main()
