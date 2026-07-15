#!/usr/bin/env bash
# §11.6 — Yedekten donus (aylik RESTORE PROVASI). Sifreli yedegi indir → coz → hedef DB'ye yukle.
#
# UYARI: hedef veritabanini DEGISTIRIR. Prova icin AYRI/gecici bir DB kullanin, prod'a degil.
# Onkosul: mc, age, psql. Env: AGE_IDENTITY_FILE (age ozel anahtar), S3_BUCKET.
# Kullanim: restore.sh <yedek-dosya-adi.sql.age> <hedef-DATABASE_URL>
set -euo pipefail

FILE="${1:?Kullanim: restore.sh <yedek.sql.age> <hedef-DATABASE_URL>}"
TARGET="${2:?Hedef DATABASE_URL gerekli (prova icin AYRI bir DB)}"
: "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE (age ozel anahtar dosyasi) gerekli}"
: "${S3_BUCKET:?S3_BUCKET gerekli}"
MC_ALIAS="${MC_ALIAS:-carinet-r2}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mc cp "${MC_ALIAS}/${S3_BUCKET}/backups/${FILE}" "$TMP/$FILE"

# Coz → psql. Duz metin diske dusmeden dogrudan hedefe akar.
age -d -i "$AGE_IDENTITY_FILE" "$TMP/$FILE" | psql "$TARGET" -v ON_ERROR_STOP=1

echo "Restore tamam → $TARGET"
echo "PROVA: cari sayisi / son hareket tarihini beklenenle karsilastirin, sonucu PROGRESS.md'ye yazin."
