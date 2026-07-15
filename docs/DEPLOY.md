# DEPLOY.md — CariNet Üretim Yayın Runbook'u (Faz 5)

> **Bu doküman kullanıcı/operatör tarafından yürütülür.** Kod tarafı (2FA, hesap silme, CSP,
> pino redaction, CI Trivy/ZAP/Dependabot) tamamlandı ve testlerle kanıtlandı; aşağıdaki adımlar
> sunucu, DNS ve harici servis hesapları gerektirir (koddan yapılamaz). Referans: CLAUDE.md §11.
>
> Her adım tamamlandığında **§11 kontrol listesindeki** ilgili kutuyu işaretleyin ve kanıtı
> (komut çıktısı / ekran görüntüsü) `PROGRESS.md`'ye yazın. Release kapısı: liste %100.

---

## 0. Önkoşullar (harici hesaplar — hepsi ücretsiz/ucuz kalem, kural #8)

- Hetzner VPS (~€5/ay — tek ücretli kalem) · Cloudflare (ücretsiz plan) · Cloudflare R2 (yedek)
- Resend (e-posta, 3k/ay ücretsiz) · Sentry (ücretsiz kota) · UptimeRobot (ücretsiz)
- Alan adı (Cloudflare DNS'e taşınmış) · EAS hesabı (mobil build) / lokal build

---

## 1. VPS Sertleştirme (§11.4)

SSH ile bağlanıp (ilk kurulumda root, sonra kapatılır):

```bash
# 1.1 Sistem güncel + otomatik güvenlik yamaları
apt update && apt -y full-upgrade
apt -y install unattended-upgrades fail2ban ufw
dpkg-reconfigure -plow unattended-upgrades   # otomatik güvenlik güncellemesi AÇIK

# 1.2 Yönetici kullanıcı (root ile çalışılmaz) + SSH anahtarı
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # public key'i taşı

# 1.3 SSH sertleştirme: /etc/ssh/sshd_config
#   PermitRootLogin no
#   PasswordAuthentication no        # yalnız key
#   PubkeyAuthentication yes
systemctl restart ssh

# 1.4 Firewall — yalnız 80/443 + SSH (kural #12: DB portu İNTERNETE KAPALI)
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
ufw status verbose      # 5432 GÖRÜNMEMELİ

# 1.5 fail2ban (SSH brute-force)
systemctl enable --now fail2ban
```

- **Docker non-root:** Coolify Docker'ı kurar; container'lar non-root çalışmalı. Postgres **yalnız iç
  ağda** (Docker network) yayınlanır — host portuna map ETMEYİN. DB'ye erişim yalnız SSH tüneli:
  `ssh -L 5432:localhost:5432 deploy@vps` (kural #12).
- **Coolify paneli:** kendi 2FA'sı açık + IP allowlist / yalnız SSH tüneliyle erişim.

---

## 2. Cloudflare Kenar (§11.5)

1. **DNS proxy AÇIK** (turuncu bulut) → origin IP gizli. Origin sunucu **yalnız Cloudflare IP
   aralıklarından** 80/443 kabul etsin (UFW'de CF IP allowlist veya `cloudflared` tünel).
2. **TLS:** SSL/TLS modu **Full (strict)** (origin'de geçerli sertifika — Coolify Let's Encrypt).
   **HSTS AÇIK** (preload; kod zaten `Strict-Transport-Security ... preload` gönderiyor — §11.2).
3. **WAF:** Managed Ruleset AÇIK + ek **rate limiting kuralları**:
   - `/v1/auth/login`, `/v1/auth/reset-password`, `/pay/*` → dakikada düşük eşik.
4. **Turnstile:** misafir ödeme (`pay/{sellerSlug}`) ve login/reset formlarında; `TURNSTILE_SECRET`
   env'e girilir (kod entegrasyonu misafir uçlarında hazır — §8).
5. **Bot Fight Mode** açık; **Pages** panel dağıtımı için (bkz. §4).

---

## 3. Sentry ×3 (§11.8) — İzleme wiring'i

> Kod, `SENTRY_DSN` env değişkenini zaten tanır (config/env.ts). Aşağıdaki wiring operasyon adımıdır;
> her uygulama için ayrı DSN alın.

- **API (`apps/api`):** `pnpm --filter @carinet/api add @sentry/node`. `main.ts`'in EN başında
  (diğer importlardan önce) `Sentry.init({ dsn, tracesSampleRate: 0.1, environment })`. 5xx yakalama
  için `AllExceptionsFilter.catch` içinde `Sentry.captureException(exception)` (yalnız `status >= 500`).
- **Panel (`apps/panel`):** `@sentry/nextjs` → `npx @sentry/wizard@latest -i nextjs`.
- **Mobil (`apps/mobile`):** `npx @sentry/wizard@latest -i reactNative` (Expo config plugin).
- `SENTRY_DSN` boşken kod no-op — dev/test etkilenmez.

> **Not:** Sentry SDK'ları harici servise veri gönderdiğinden ve DSN gerektirdiğinden kod tabanına
> önceden gömülmedi (kural #8: onaysız harici çağrı yok; kural #10: DSN sır). Yukarıdaki adımlar
> onaylı ve DSN'li ortamda uygulanır.

---

## 4. Coolify Üretim Dağıtımı

1. Coolify'da yeni proje → Git repo bağla → **environment secrets** gir (`.env.example`'daki tüm
   anahtarlar; **gerçek değerler yalnız Coolify secrets'ta**, koda yazılmaz — kural #10):
   - `DATABASE_URL`, `JWT_*`, `MASTER_ENCRYPTION_KEY` (64 hex), `S3_*` (R2), `RESEND_API_KEY`,
     `TURNSTILE_SECRET`, `SENTRY_DSN`, `SWAGGER_USER`/`SWAGGER_PASSWORD`, `PANEL_ORIGIN`,
     `API_PUBLIC_URL`, `POS_*`, `NODE_ENV=production`.
2. **DB migrate:** deploy adımında `pnpm --filter @carinet/api exec prisma migrate deploy` (seed
   PROD'da çalıştırılmaz — gerçek veri geçiş sihirbazıyla girer, §9).
3. **Panel → Cloudflare Pages** (statik/SSR) veya Coolify; `NEXT_PUBLIC_API_URL` prod API'ye.
4. **Mobil:** EAS build (ücretsiz kota) veya lokal; store paketleri + demo hesap + **gizlilik URL'i**
   (`https://<alan>/gizlilik`) ve **hesap silme** (uygulama içi — Apple gereksinimi, kod hazır).
5. `/docs` prod'da `SWAGGER_USER/PASSWORD` set edilmezse KAPALI (404); set edilirse basic auth arkasında.

---

## 5. Şifreli Yedek + Restore Provası (§11.6)

**Kurulum (VPS'te):**

```bash
apt -y install age postgresql-client
# mc (MinIO client) kur, R2 alias tanımla:
mc alias set carinet-r2 https://<accountid>.r2.cloudflarestorage.com "$R2_KEY" "$R2_SECRET"
# age anahtar çifti (public → yedek şifreler, private → OFFLINE saklanır, VPS'te DEĞİL):
age-keygen -o backup-identity.txt        # private; güvenli yere taşı, sunucudan sil
# public key'i BACKUP_AGE_RECIPIENT olarak kullan.
```

**Gece yedeği (cron):**

```cron
15 3 * * *  DATABASE_URL=... BACKUP_AGE_RECIPIENT=age1... S3_BUCKET=carinet \
            /opt/carinet/scripts/backup.sh >> /var/log/carinet-backup.log 2>&1
```

`scripts/backup.sh`: `pg_dump | age` (düz metin diske düşmez) → R2'ye yükler + 30 günden eskiyi budar.

**AYLIK RESTORE PROVASI (release kapısı — kanıt PROGRESS.md'ye):**

```bash
# Ayrı/geçici bir DB'ye (prod'a DEĞİL) döndür:
AGE_IDENTITY_FILE=backup-identity.txt S3_BUCKET=carinet \
  scripts/restore.sh carinet-20260715T031500Z.sql.age "postgres://.../carinet_restore_test"
# Doğrula: cari sayısı, son hareket tarihi, bakiye örneği beklenenle aynı mı?
```

Sonucu (tarih + doğrulanan sayılar) `PROGRESS.md`'ye yazın → "restore bir kez kanıtlı" kriteri.

---

## 6. §11 Release Kapısı — Kontrol Listesi

> Faz 5 "bitti" = aşağıdaki liste %100 + restore bir kez kanıtlı + mağaza incelemesinde + prod izleniyor.

**Kod tarafı (bu oturumda tamamlandı, testli):**

- [x] argon2id · refresh rotasyonu + reuse→aile iptali (Faz 0)
- [x] **2FA enrollment** (setup/enable/disable) + yedek kodlar · girişte TOTP/recovery (Blok A)
- [x] **Sızmış parola kontrolü** (HIBP k-anonimlik, fail-open) (Blok A)
- [x] cihaz listesi (`/auth/sessions`) + **revoke-all** (`/auth/revoke-all`)
- [x] login/reset/misafir uçlarında throttle + tek tip yanıt (Faz 0/3)
- [x] Zod her sınırda · DTO whitelist (Zod strip) · Prisma parametrik · TenantGuard + test matrisi
- [x] **Helmet + sıkı CSP** + **prod HSTS** (Blok C)
- [x] **pino redaction** (parola/token/IBAN/kart) (Blok C)
- [x] **Swagger prod auth** (basic auth / creds yoksa kapalı) (Blok C)
- [x] POS anahtarları AES-256-GCM · callback imza doğrulama (Faz 3)
- [x] **Hesap silme / anonimleştirme** + KVKK sayfaları (panel + mobil) (Blok B)
- [x] **CI: Trivy fs + ZAP baseline + Dependabot + Actions SHA pin** (Blok D)
- [x] gitleaks (pre-commit + CI) · lockfile zorunlu · `pnpm audit` kapısı

**Operasyon tarafı (bu runbook — sunucu/hesap gerektirir):**

- [ ] VPS: UFW (80/443+SSH), SSH key-only + root kapalı, fail2ban, unattended-upgrades, DB iç ağ (§1)
- [ ] Cloudflare: proxy + WAF + rate kuralları + TLS Full(strict) + HSTS preload + Turnstile (§2)
- [ ] Sentry ×3 wiring + DSN (§3)
- [ ] 2FA **zorunlu** SELLER_ADMIN/PLATFORM_ADMIN (kod prod'da uygular; adminlerin kurulumu tamamlaması gerekir)
- [ ] Şifreli gece yedeği → R2 + **aylık restore provası** kanıtlı (§5)
- [ ] Coolify prod deploy · panel → Pages · migrate deploy (§4)
- [ ] UptimeRobot + Sentry alarmları · yük hedefi: 100 eşzamanlı ekstre < 500ms
- [ ] Mağaza paketleri + demo hesap + gizlilik URL'i · KVKK sayfaları yayında

---

## 7. Olay Planı (§11.8 — yazılı, hazır)

1. **Şüpheli erişim:** etkilenen kullanıcı için `/auth/revoke-all` → tüm oturumlar iptal.
2. **Anahtar sızıntısı:** `MASTER_ENCRYPTION_KEY` / JWT secret rotasyonu (Coolify secrets) → tüm
   refresh aileleri geçersiz (kullanıcılar yeniden giriş yapar). POS anahtarları yeniden şifrelenir.
3. **Veri kaybı:** son R2 yedeğinden restore (§5) → doğrulama → devreye alma.
4. **Kullanıcı bilgilendirme:** KVKK ihlal bildirimi şablonu + etkilenen kullanıcı listesi (audit_logs).
5. Audit izleme: başarısız girişler (5 dk'da X), IBAN/POS değişikliği, toplu import, yetki değişimi.
