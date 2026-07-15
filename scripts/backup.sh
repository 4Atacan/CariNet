#!/usr/bin/env bash
# §11.6 — Gece yedegi: pg_dump | age (sifreli) → R2/S3.
# Duz metin yedek diske ASLA yazilmaz (pipe ile dogrudan sifrelenir). Sadece alici anahtari cozer.
#
# Onkosul: pg_dump, age, mc (MinIO client — R2 ile uyumlu, alias "carinet-r2" onceden tanimli).
# Env: DATABASE_URL, BACKUP_AGE_RECIPIENT (age public key), S3_BUCKET.
# Cron ornegi (her gece 03:15): 15 3 * * *  /opt/carinet/scripts/backup.sh >> /var/log/carinet-backup.log 2>&1
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL gerekli}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT (age public key) gerekli}"
: "${S3_BUCKET:?S3_BUCKET gerekli}"
MC_ALIAS="${MC_ALIAS:-carinet-r2}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="carinet-${STAMP}.sql.age"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# pg_dump → age: duz metin yalniz bellek/pipe'ta, diske sifreli dosya olarak dusr.
pg_dump "$DATABASE_URL" --no-owner --no-privileges \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$TMP/$FILE"

# Bozuk/bos yedek yuklenmesin.
if [ ! -s "$TMP/$FILE" ]; then
  echo "HATA: yedek dosyasi bos — yukleme iptal." >&2
  exit 1
fi

mc cp "$TMP/$FILE" "${MC_ALIAS}/${S3_BUCKET}/backups/${FILE}"
echo "Yedek yuklendi: backups/${FILE} ($(du -h "$TMP/$FILE" | cut -f1))"

# Eski yedekleri buda (retention). mc, --older-than ile siler.
mc rm --recursive --force --older-than "${RETENTION_DAYS}d" \
  "${MC_ALIAS}/${S3_BUCKET}/backups/" 2>/dev/null || true
echo "Retention: ${RETENTION_DAYS} gunden eski yedekler budandi."
