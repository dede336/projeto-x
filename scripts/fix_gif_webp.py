#!/usr/bin/env python3
"""
Reconverte GIFs originais do zip para WebP animado corretamente,
respeitando o disposal method de cada frame.
"""
import zipfile
import subprocess
import os
import tempfile
import shutil
import json

ZIP_PATH = "zipFile.zip"
ZIP_PREFIX = "OMEGA-DX-ATUALIZACAO-97/"
DEST_BASE = "artifacts/omega-dx10/assets"

# Pastas de GIFs animados que precisam de conversão correta
GIF_FOLDERS = [
    "assets/images/characters",
    "assets/images/digimons",
    "assets/images/eggs",
    "assets/images/effects",
    "assets/images",  # root level (status gifs, etc)
]

def get_gif_frame_durations(gif_path):
    """Extrai durações dos frames do GIF via ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_frames", "-select_streams", "v",
         "-show_entries", "frame=pkt_duration_time,pkt_pts_time",
         "-of", "json", gif_path],
        capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout)
        durations = [float(f.get("pkt_duration_time", 0.1)) for f in data.get("frames", [])]
        return durations if durations else [0.1]
    except:
        return [0.1]

def convert_gif_to_webp(gif_path, webp_path):
    """
    Converte GIF → WebP animado em duas etapas:
    1. Extrai frames como PNG individuais (ffmpeg aplica disposal corretamente)
    2. Remonta como WebP animado com as durações originais
    """
    tmpdir = tempfile.mkdtemp()
    try:
        # Etapa 1: extrai frames com disposal aplicado
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", gif_path, "-vsync", "0",
             os.path.join(tmpdir, "frame_%04d.png")],
            capture_output=True
        )

        frames = sorted([f for f in os.listdir(tmpdir) if f.endswith(".png")])
        if not frames:
            return False

        # Etapa 2: pega durações dos frames originais
        durations = get_gif_frame_durations(gif_path)
        # Garante uma duração por frame
        while len(durations) < len(frames):
            durations.append(durations[-1] if durations else 0.1)

        # Etapa 3: calcula fps médio baseado nas durações reais
        avg_duration = sum(durations) / len(durations) if durations else 0.1
        fps = round(1.0 / avg_duration) if avg_duration > 0 else 10
        fps = max(1, min(fps, 50))

        # Etapa 4: remonta como WebP animado com os PNGs completos
        frame_pattern = os.path.join(tmpdir, "frame_%04d.png")
        result2 = subprocess.run(
            ["ffmpeg", "-y", "-framerate", str(fps), "-i", frame_pattern,
             "-c:v", "libwebp", "-lossless", "0", "-q:v", "75",
             "-loop", "0", "-an", webp_path],
            capture_output=True
        )

        return result2.returncode == 0

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

def main():
    z = zipfile.ZipFile(ZIP_PATH)
    all_names = z.namelist()

    # Filtra apenas os GIFs das pastas de assets/images e assets
    gif_entries = [
        n for n in all_names
        if n.lower().endswith(".gif") and ZIP_PREFIX + "artifacts/omega-dx10/" in n
    ]

    print(f"GIFs encontrados no zip: {len(gif_entries)}")
    ok = 0
    fail = 0

    for entry in sorted(gif_entries):
        # Caminho relativo dentro do omega-dx10
        rel = entry.replace(ZIP_PREFIX + "artifacts/omega-dx10/", "")
        dest_webp = os.path.join("artifacts/omega-dx10", rel.replace(".gif", ".webp"))

        # Só reconverte se o webp já existe (foi convertido errado antes)
        if not os.path.exists(dest_webp):
            print(f"  SKIP (webp não existe): {rel}")
            continue

        # Extrai GIF original para temp
        tmpdir = tempfile.mkdtemp()
        try:
            gif_data = z.read(entry)
            tmp_gif = os.path.join(tmpdir, os.path.basename(entry))
            with open(tmp_gif, "wb") as f:
                f.write(gif_data)

            if convert_gif_to_webp(tmp_gif, dest_webp):
                print(f"  ✓ {rel}")
                ok += 1
            else:
                print(f"  ✗ FALHOU: {rel}")
                fail += 1
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    print(f"\nConcluído: {ok} ok, {fail} falhas")
    z.close()

if __name__ == "__main__":
    main()
