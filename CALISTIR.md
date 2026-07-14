# CALISTIR.md — Lokalde ayaga kaldirma ve test rehberi

> Her seyi sifirdan calistirmak icin gereken komutlar. Terminali **repo kokunde** ac.
>
> **`pnpm` taninmiyorsa** → §11'e bak (kullanici PATH'i sismis, kalici cozumu orada).
> Hemen calisan yol: komutun basina `npx` koy → `npx pnpm dev`

---

## 1. Servisler (Postgres + Mailpit + MinIO)

**Docker Desktop'i once ac**, sonra:

```powershell
docker compose up -d
```

| Servis   | Adres                                           |
| -------- | ----------------------------------------------- |
| Postgres | `localhost:5432` (carinet / carinet)            |
| Mailpit  | http://localhost:8025 (giden e-postalar burada) |
| MinIO    | http://localhost:9001 (carinet / carinet123)    |

## 2. Veritabani (yalniz ilk kez veya sifirlamak isteyince)

```powershell
pnpm --filter @carinet/api db:deploy   # migration'lari uygula
pnpm --filter @carinet/api db:seed     # 2 saticili tohum veri
```

Seed her calistiginda tablolari **sifirlar** ve sonunda bekleyen tahsilatin referans kodunu yazar.

## 3. Uygulamalari baslat

**Terminal 1 — API + panel (+ shared izleyici):**

```powershell
pnpm dev
```

| Uygulama | Adres                      |
| -------- | -------------------------- |
| Panel    | http://localhost:3000      |
| API      | http://localhost:3001/v1   |
| Swagger  | http://localhost:3001/docs |

**Terminal 2 — mobil (QR kodu icin AYRI terminal sart):**

```powershell
pnpm --filter @carinet/mobile dev
```

> `pnpm dev` mobili de baslatir ama uc uygulamanin ciktisini birlestirdigi icin
> **QR kodu okunaklı cikmaz**. Telefonla baglanacaksan mobili kendi terminalinde calistir.

---

## 4. Test hesaplari

Sifre (hepsi): **`CariNet2026!`**

| Kim                           | E-posta                    | Nerede                    |
| ----------------------------- | -------------------------- | ------------------------- |
| Satici-1 admin (Anadolu Gida) | `admin@anadolugida.com`    | Panel                     |
| Satici-1 personel             | `personel@anadolugida.com` | Panel (kisitli rol)       |
| Satici-2 admin (Ege Tekstil)  | `admin@egetekstil.com`     | Panel — **POS burada**    |
| Alici                         | `ahmet@bakkalim.com`       | Mobil                     |
| Alici (coklu uyelik)          | `mehmet@zincirmarket.com`  | Mobil — hesap degistirici |
| Platform admin                | `admin@carinet.local`      | —                         |

---

## 5. Mobil (Expo)

1. Telefona **Expo Go** kur (iOS'ta yalniz en guncel SDK'yi destekler; proje SDK 54).
2. Telefon ve bilgisayar **ayni Wi-Fi**'da olmali.
3. Ayri terminalde `pnpm --filter @carinet/mobile dev` → QR kodu okut
   (iOS: Kamera uygulamasi, Android: Expo Go icindeki tarayici).
   QR okunmazsa Expo Go'da adresi elle gir: `exp://192.168.0.106:8081`

**Onemli:** Telefon API'ye `localhost` ile ulasamaz, bilgisayarin LAN IP'siyle ulasir.
Bu adres `apps/mobile/.env` icinde:

```
EXPO_PUBLIC_API_URL=http://192.168.0.106:3001/v1
```

Wi-Fi degisince veya IP yenilenince bu satiri guncelle (ve Expo'yu yeniden baslat):

```powershell
# guncel IP'yi ogren
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq 'Wi-Fi' }).IPAddress
```

Baglanti kurulmuyorsa Windows Guvenlik Duvari 3001 portunu kapatiyor olabilir; ilk
baglantida cikan izin penceresinde **"Ozel aglara izin ver"** de.

---

## 6. Neye bakmali (Faz 1-3)

**Panel** (http://localhost:3000 → giris)

| Sayfa                  | Ne gorursun                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| Cari hesaplar          | Canli bakiye (kolon yok, her istekte hareketlerden turetilir)           |
| Cari detay             | Ekstre + yuruyen bakiye · yaslandirma karti · adresler · **Ekstre PDF** |
| Hareketler/Faturalar   | Tekil giris; fatura kalem bazli, toplamlar sunucuda hesaplanir          |
| Raporlar               | Risk foyu (FIFO yaslandirma) + donemsel bakiye grafigi                  |
| **Tahsilat**           | Bekleyen talepler · manuel onay · **banka ekstresi yukle → eslestir**   |
| **Ayarlar**            | Tahsilat IBAN'lari · POS tanimi (anahtarlar maskeli)                    |
| Ice aktarim / Sihirbaz | Excel/UBL importu · devir sihirbazi (dogrulama raporu)                  |

**Misafir odeme sayfasi:** http://localhost:3000/pay/anadolu-gida
Cari kodu `120.01.001` + tutar → referans kodu + IBAN.

**Mobil:** giris → Dashboard → **"Odeme yap"** → havale (referans kodu, kopyala/paylas)
veya kart (POS'u olan saticide taksit tablosu).

---

## 7. Tahsilat akislarini elle test etme

### Havale/EFT (Kanal 1) — uctan uca

1. Panel > **Tahsilat** > bir cari icin talep ac (veya mobilde "Odeme yap").
   → Referans kodu cikar, orn. `S1-120.01.001-A1B2C3`.
2. Bir CSV dosyasi olustur (banka ekstresi taklidi), **noktali virgul** ayirici:

   ```
   Tarih;Aciklama;Tutar
   2026-07-14;EFT GELEN S1-120.01.001-A1B2C3 ODEME;5.000,00
   2026-07-14;FAST GELEN ACIKLAMASIZ;750,00
   2026-07-14;GIDEN HAVALE TEDARIKCI;-2.000,00
   ```

   Hazir ornek: `apps/api/prisma/fixtures/banka-ekstresi-ornek.csv`

3. Panel > Tahsilat > **Ekstre yukle**.
   → Referansli satir **Kesin** eslesir; aciklamasiz satir **Eslesmedi** → cariyi elle secersin;
   cikis hareketi (negatif) tahsilat degildir, atlanir.
4. **Secilenleri onayla** → bakiye duser, bildirim + audit yazilir.
5. **Ayni ekstreyi tekrar yukleyip onayla** → satir "Islenmis" gorunur, bakiye DEGISMEZ.

### Kart / POS (Kanal 2)

POS yalniz **satici-2'de** (Ege Tekstil) tanimli — `admin@egetekstil.com` ile gir.

1. Panel > Tahsilat > kart kanaliyla talep ac (veya o saticinin alicisiyla mobilden).
   → **Referans kodunu** ve ekranda yazan **"Karta cekilecek"** tutari not al.
   Ornek: 4.000 TL borc, 3 taksit → referans `S2-CARI-001-0C98FB`, karta cekilecek **4.080,00**
   (aradaki 80 TL vade farkidir, **bankanin geliridir**).
2. Gercek akista kullanici saglayicinin **hosted 3D** sayfasina gider (bizde kart formu YOK).
   Lokalde saglayici olmadigi icin, saglayicinin attigi imzali callback'i biz taklit ederiz.
   Script'e **karta cekilen** tutari verirsin (saglayici onu bildirir):

   ```powershell
   node scripts/sandbox-pos-callback.mjs S2-CARI-001-0C98FB 4080.00 --taksit 3
   ```

   → `processed: true`. Bakiye **4.000** duser (4.080 degil!) — vade farki borca yazilmaz.

3. **Ayni komutu tekrar calistir** → `alreadyConfirmed: true`, bakiye DEGISMEZ (idempotency).
4. Tek cekim: `node scripts/sandbox-pos-callback.mjs <REF> 1000.00`
5. Reddedilen odeme: `node scripts/sandbox-pos-callback.mjs <REF> 1000.00 --declined`
   → talep PENDING kalir (musteri tekrar deneyebilir), bakiye degismez.

---

## 8. Kalite kapilari (kod degistirdiysen)

```powershell
pnpm lint
pnpm typecheck
pnpm test                                   # unit
pnpm --filter @carinet/api test:e2e         # e2e (Docker + seed gerekir)
pnpm build
```

## 9. Kapatma

```powershell
# pnpm dev'i Ctrl+C ile durdur, sonra:
docker compose down          # verileri korur
docker compose down -v       # veritabanini da siler (seed'i tekrar calistirman gerekir)
```

---

## 10. Sik karsilasilan sorunlar

| Belirti                                              | Cozum                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm : The term 'pnpm' is not recognized`           | §11 (PATH sismis). Ara cozum: `npx pnpm ...`                             |
| `Can't reach database server at localhost:5432`      | Docker Desktop kapali → ac, `docker compose up -d`.                      |
| Panel build hatasi: `EINVAL ... .next\server\chunks` | `rm -rf apps/panel/.next` sonra tekrar dene (OneDrive/Windows kaynakli). |
| Expo: "Project is incompatible with Expo Go"         | Expo Go'yu magazadan guncelle (proje SDK 54).                            |
| Telefon API'ye baglanamiyor                          | `apps/mobile/.env` icindeki IP guncel mi? Ayni Wi-Fi'da misin?           |
| Port 3000/3001 dolu                                  | `npx kill-port 3000 3001` veya calisan node islemlerini kapat.           |

---

## 11. "pnpm taninmiyor" — kullanici PATH'i sismis

**Belirti:** Yeni terminal acsan da `pnpm` bulunamiyor, ama dosya diskte duruyor
(`C:\Users\Ayurd\AppData\Roaming\npm\pnpm.cmd`).

**Sebep:** Kullanici PATH'ine makine PATH'i defalarca kopyalanmis (4200 karakter, 102 giris,
30 tekrar). Sisen deger uygulanmiyor ve listenin SONUNDAKI `AppData\Roaming\npm` dusuyor.
Terminali kapat-ac ise yaramaz — sorun terminalde degil, kayitli PATH'in kendisinde.

**Hemen calisan cozum (PATH'e dokunmadan):** komutun basina `npx` koy.

```powershell
npx pnpm dev
npx pnpm --filter @carinet/mobile dev
```

`npx`, Node ile birlikte makine PATH'inde oldugu icin her zaman bulunur.

**Kalici cozum:** kullanici PATH'ini tekrarlardan temizle (102 giris → 12).
Silinen her sey ya makine PATH'inde zaten var ya da birebir tekrar; kayip olmaz.

```powershell
# 1) Once YEDEK al
[Environment]::GetEnvironmentVariable('PATH','User') | Out-File "$env:USERPROFILE\path-yedek.txt" -Encoding utf8

# 2) Makine PATH'inde zaten olanlari ve tekrarlari at
$u = [Environment]::GetEnvironmentVariable('PATH','User')
$m = [Environment]::GetEnvironmentVariable('PATH','Machine')
$mSet = [System.Collections.Generic.HashSet[string]]::new(
  [string[]]($m -split ';' | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }),
  [StringComparer]::OrdinalIgnoreCase)
$seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$clean = foreach ($p in ($u -split ';')) {
  if (-not $p) { continue }
  $n = $p.TrimEnd('\')
  if ($mSet.Contains($n)) { continue }
  if (-not $seen.Add($n)) { continue }
  $p
}
[Environment]::SetEnvironmentVariable('PATH', ($clean -join ';'), 'User')

# 3) Terminali KAPAT-AC, sonra dogrula
pnpm --version
```

Geri almak istersen: `[Environment]::SetEnvironmentVariable('PATH', (Get-Content "$env:USERPROFILE\path-yedek.txt" -Raw).Trim(), 'User')`
