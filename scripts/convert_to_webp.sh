#!/bin/bash
# Converte todas as imagens GIF/PNG/JPG em assets/images para WebP
# GIFs viram WebP animado; PNG/JPG viram WebP estático

set -e
BASE="artifacts/omega-dx10/assets/images"
JOBS=8  # conversões em paralelo

echo "=== Convertendo GIFs → WebP animado ==="
convert_gif() {
  f="$1"
  out="${f%.gif}.webp"
  if ffmpeg -y -i "$f" -vcodec libwebp -lossless 0 -q:v 75 -loop 0 -an "$out" 2>/dev/null; then
    rm "$f"
    echo "✓ GIF  $f"
  else
    echo "✗ ERRO $f"
  fi
}
export -f convert_gif
find "$BASE" -name "*.gif" | xargs -P "$JOBS" -I{} bash -c 'convert_gif "$@"' _ {}

echo ""
echo "=== Convertendo PNG → WebP ==="
convert_png() {
  f="$1"
  out="${f%.png}.webp"
  if ffmpeg -y -i "$f" -c:v libwebp -q:v 85 "$out" 2>/dev/null; then
    rm "$f"
    echo "✓ PNG  $f"
  else
    echo "✗ ERRO $f"
  fi
}
export -f convert_png
find "$BASE" -name "*.png" | xargs -P "$JOBS" -I{} bash -c 'convert_png "$@"' _ {}

echo ""
echo "=== Convertendo JPG/JPEG → WebP ==="
convert_jpg() {
  f="$1"
  ext="${f##*.}"
  out="${f%.$ext}.webp"
  if ffmpeg -y -i "$f" -c:v libwebp -q:v 85 "$out" 2>/dev/null; then
    rm "$f"
    echo "✓ JPG  $f"
  else
    echo "✗ ERRO $f"
  fi
}
export -f convert_jpg
find "$BASE" \( -name "*.jpg" -o -name "*.jpeg" \) | xargs -P "$JOBS" -I{} bash -c 'convert_jpg "$@"' _ {}

echo ""
echo "=== Atualizando referências nos arquivos TypeScript ==="
find artifacts/omega-dx10 \( -name "*.ts" -o -name "*.tsx" \) | while read f; do
  sed -i \
    -e "s/\.gif'/\.webp'/g" \
    -e 's/\.gif"/\.webp"/g' \
    -e "s/\.png'/\.webp'/g" \
    -e 's/\.png"/\.webp"/g' \
    -e "s/\.jpg'/\.webp'/g" \
    -e 's/\.jpg"/\.webp"/g' \
    -e "s/\.jpeg'/\.webp'/g" \
    -e 's/\.jpeg"/\.webp"/g' \
    "$f"
done
echo "✓ Referências atualizadas"

echo ""
echo "=== Resultado final ==="
TOTAL=$(find "$BASE" -name "*.webp" | wc -l)
ORIG=$(find "$BASE" -name "*.gif" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | wc -l)
SIZE=$(find "$BASE" -name "*.webp" | du -ch | tail -1 | cut -f1)
echo "WebPs gerados: $TOTAL"
echo "Originais restantes (falha): $ORIG"
echo "Tamanho total novo: $SIZE"
