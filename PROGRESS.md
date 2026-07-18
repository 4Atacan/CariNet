# PROGRESS.md — CariNet AI Calisma Gunlugu

> Bu dosya oturumlar arasi hafizadir (CLAUDE.md §16.3). Her calisma blogu sonunda guncellenir.
> **Aktif faz: Faz 5 — Sertlestirme ve Yayin** → KOD TARAFI tamamlandi; OPS tarafi (VPS/Cloudflare/
> Coolify/Sentry/restore provasi) kullaniciyi bekliyor (bkz. docs/DEPLOY.md). Faz 1'in "pilot verisi"
> maddesi de gercek veri bekliyor.

---

## 2026-07-18 (aksam) · PROD YAYINDA — Faz 5 ops adimlari 1-5 ve 7 (yedek)

Kullanici Oracle'i beklemek yerine baska sunucu ariyordu; Turhost teklifi (2 vCPU/4GB icin
$40/ay) ve ortagin sunucusu (root ortakta) degerlendirildi. Sonunda **Oracle'da gozden kacan
x86 secenegi** bulundu ve HER SEY UCRETSIZ kaldi.

### 1) Sunucular — ARM degil x86 (Adim 1)

Haftalardir `VM.Standard.A1.Flex` (ARM) pesindeydik; uc availability domain'de de kapasite yok
(81 deneme). Oracle Haziran 2026'da Always Free ARM kotasini 4 OCPU/24GB → 2 OCPU/12GB indirmis,
havuz daraldi. **`VM.Standard.E2.1.Micro` (x86 AMD, 1 OCPU / 1 GB) hic denenmemisti** — ilk
denemede acildi. Always Free bundan IKI adet veriyor:

|          | carinet-db   | carinet-app         |
| -------- | ------------ | ------------------- |
| Genel IP | 92.5.134.129 | 89.168.125.160      |
| Ozel IP  | 10.0.1.151   | 10.0.1.72           |
| Rol      | Postgres     | API + panel + Caddy |

Ubuntu 24.04.4 x86_64 · 2 cekirdek · 954 MB · 48 GB. **VARSAYIM:** 954 MB dar; panel
DERLEMESI sunucuda yapilamaz (GitHub Actions'ta yapiliyor). Olculen kullanim 529/954 MB.

### 2) Sertlestirme (Adim 2)

Iki makinede: 2G swap (swappiness=10) · fail2ban (`backend=systemd` — bu satir olmadan jail
sessizce hic tetiklenmez) · UFW (db: 22 + 5432 yalniz 10.0.1.0/24 · app: 22/80/443) ·
`netfilter-persistent` masked (tek kaynak UFW) · sshd root ve sifre girisi KAPALI ·
unattended-upgrades. **Iki makine de yeniden baslatilip dogrulandi.**

Uzaktan firewall degistirirken **zamanli geri alma** kullanildi: 300 sn icinde onay gelmezse
kurallar kendiliginden geri aliniyor; yeni bir SSH oturumuyla erisim dogrulandiktan sonra onay
verildi.

### 3) Docker + Postgres (Adim 3) — UC SESSIZ TUZAK

- **Docker UFW'yi atlar.** `-p 5432:5432` yazilsaydi UFW "reddet" derken DB internete acik
  olurdu. Port ozel IP'ye baglandi: `10.0.1.151:5432`.
- **UFW FORWARD'i DROP yapiyor** + Oracle imajindan kalma bir REJECT kurali ufw zincirlerinden
  ONCE duruyordu. Docker trafigi INPUT'tan degil FORWARD'dan gecer → izin `ufw after.rules`
  icine DOCKER-USER blogu olarak KALICI yazildi.
- **Oracle Security List VCN ici 5432'yi engelliyordu.** Sunucuda her sey dogruyken paket
  sayaclari SIFIRDI. Buluta ayri ingress kurali eklendi.

Postgres 954 MB'a gore ayarli (shared_buffers=192MB, max_connections=50). Sifre sunucuda
uretildi, hicbir asamada ekrana basilmadi, `.env` 600.

### 4) Depo + imajlar (Adim 5)

Depoda uzak sunucu YOKTU (30 commit yalniz diskte) ve Dockerfile da yoktu. Kullanici onayiyla
**private** GitHub deposu acildi (gonderim oncesi tum gecmis gitleaks ile tarandi; tek bulgu bir
birim testindeki sahte deger — yanlis alarm). Imajlar GitHub Actions'ta derlenip ghcr'ye
gonderiliyor, sunucu `read:packages` yetkili dar bir token ile cekiyor.

**API imaji iki kez 33'er dakika SESSIZCE asildi.** Yerelde tekrar uretilerek bulundu:
`COPY . .` sonrasi pnpm workspace'i tutarsiz gorup (deps katmani yalniz api/shared/config
manifestlerini kopyaliyordu) KENDILIGINDEN kurulum baslatiyor; o kurulum da
`pnpm-workspace.yaml`'daki `fetchTimeout: 600000 x fetchRetries: 5` yuzunden BASKA
platformlarin istege bagli ikililerinde (`@turbo/darwin-64`, `@swc/core-linux-arm...`)
asiliyordu. Iki duzeltme: (a) tum manifestler deps katmaninda kopyalanir → kurulum hic
tetiklenmez; (b) `supportedArchitectures` linux/x64'e kisitlanir, `COPY`'den SONRA da tekrar
uygulanir (COPY dosyayi orijinal haliyle geri yaziyordu). Kurulum 33+ dk → 1 dk 43 sn.

**Ders:** CI'ya gondermeden once yerelde dogrula. Bu turda kendi uc hatam (cok satirli `RUN`,
YAML'de cift anahtar, `grep`'e verilen tamponlanmis cikti) fazladan tur yaktirdi.

### 5) Yayin (Adim 4-5)

`https://89.168.125.160.sslip.io` — Caddy + Let's Encrypt (16.10.2026'ya kadar). Panel ve API
**ayni kokende**: Caddy `/v1`'i API'ye, kalanini panele yonlendirir → httpOnly cookie (kural #9)
capraz-koken sorunu yok, CORS gerekmiyor. Coolify KULLANILMADI (tek basina ~1 GB yer).

Dogrulandi: `/v1/health` 200 · `/giris` 200 · yetkisiz `/v1/buyers` **401** · HSTS/X-Frame/
nosniff/Referrer-Policy yerinde · tum Prisma migrasyonlari uygulandi.

### 6) Yedek + restore provasi (Adim 7) — MEKANIZMA TAMAM

`pg_dump | age` → sifreli; **duz metin diske hic yazilmaz**. Gece 03:15 UTC cron, 30 gun
retention, ikinci makineye kopya. **Restore provasi GECTI**: ayri bir DB'ye geri yuklendi,
30 tablo + `transactions_ledger_covering_idx` + 6 migrasyon dogrulandi.

**`cron` paketi kurulu DEGILDI** — zamanlanmis gorev dosyasi duruyordu ama calistiracak servis
yoktu, sessizce hic calismayacakti. Kuruldu ve gecici bir test kaydiyla gercekten tetiklendigi
kanitlandi.

**KALAN IKI EKSIK (§11.6 tam kapanmadi):**

1. **age OZEL ANAHTARI hala yalnizca db sunucusunda.** Sunucu kaybolursa yedeklerin hicbiri
   cozulemez. Kullanici parola yoneticisine almali — `MASTER_ENCRYPTION_KEY` ile ayni onemde.
2. **Gercek dis konum yok.** Kopya ayni saglayicinin ikinci makinesinde; Oracle hesabi kapanirsa
   ikisi de gider. R2 icin Cloudflare hesabi bekleniyor.

### Maliyet

**0 TL.** Iki ucretsiz Oracle sunucusu + GitHub Actions ucretsiz katman + Let's Encrypt.
Kullanicinin "satis yapmadan yatirim baglamak istemiyorum" kisiti karsilandi.

### Sonraki adim

Adim 6 (Sentry DSN) · R2 dis konum · **prod veritabani BOS** — giris icin once satici ve
yonetici hesabi olusturulmali (seed verisi test amacli, prod'a konmaz).

---

## 2026-07-18 · Sekme donmasi (gercek hata bulundu) + logo kalitesi + mobil giris ekrani

Kullanici: "sekmeler arasi dolasirken cok donuyor · giris ekraninda logo cok kotu duruyor ·
mobilden girerkende webteki gibi giris ekrani olustur". Oracle retry beklerken yapildi.

### 1) Sekme gecisleri — IKI AYRI SORUN cikti

**(a) Gercek hata: paylasilan `queryKey`, iki farkli sekil.** `['buyers','all']` anahtarini DORT
sayfa kullaniyor; faturalar/hareketler/tahsilat `apiGetPaged` ile `{data,meta}` yaziyor, **raporlar
`apiGet` ile duz dizi** yaziyordu. Onbellek paylasildigi icin hangi sayfa once acildiysa o kazaniyor:
Faturalar → Raporlar gecisinde Raporlar `{data,meta}` bulup `.map` cagiriyor → **sayfa cokuyor**
(`.map is not a function`). Ters yonde sessizce bosaliyor. Tek sayfa acikken GORUNMEZ; yalnizca
sekme gezerken cikar — bu yuzden bugune kadar fark edilmemis. Raporlar `apiGetPaged`'e cevrildi.
Tum panel tarandi: baska sekil catismasi yok (0). Kural CLAUDE.md §12'ye yazildi.

**(b) Donmanin kendisi dev sunucusu — urun hatasi DEGIL.** Olculdu (ayni anda, ayni makinede):

| Rota     | Uretim (`next start`) | Dev (`next dev`) |
| -------- | --------------------- | ---------------- |
| cariler  | **9ms**               | 7.175s           |
| tahsilat | **8ms**               | 1.525s           |
| urunler  | **8ms**               | 1.390s           |
| raporlar | **7ms**               | 0.427s           |

Tarayicida uzun gorev (longtask) olcumu 59/140/69ms — yani ana is parcacigi **donmuyor**, beklenen
sey sunucu. Next dev her rotayi ilk ziyarette derliyor (ikinci ziyaret 0.15-0.34s). Uretim
derlemesinde sorun yok. **VARSAYIM:** kullanicinin sikayeti dev ortaminda; prod'da tekrar sorulmali.

### 2) Logo kalitesi — ters logo bozukmus

Ters varyant esikle boyanmisti: ic pikseller beyaza donmus, **anti-aliasing kenarlari lacivert
kalmis** → harfler dolu beyaz degil, **ici bos cerceve** gibi goruniyordu (lacivert zeminde cok
belirgin). Tum marka PNG'leri kaynaktan yeniden uretildi: her piksel _(beyaz zemin + marka rengi)_
karisimi olarak cozulup **kapsam (alpha) ile renk AYRI** yaziliyor; ters varyantta yalniz renk
degisiyor, kenar yumusakligi korunuyor. Kaynagin beyazi tam 255 degil (~12/255 gurultu) → alpha
tabani kesilmezse zemin hayalet sis kaliyor, icerik siniri tum goruntu cikiyordu; taban kesildi.
`carinet-logo@2x.png` silindi (kaynakta o cozunurluk yok, sahte upscale). Logolara `unoptimized`
eklendi (WebP yeniden kodlamasi kenarlari yumusatiyordu).

### 3) Giris ekranlari

**Panel:** marka alani `hidden lg:flex` idi → **1024px altinda tamamen kayboluyordu**; 972px'lik
siradan bir dizustu ekraninda giris ekrani markasiz, ortada kucuk bir logo ile goruluyordu (kullanicinin
"kotu duruyor" dedigi sey buydu). Esik 900px'e cekildi ve dar ekranda marka **ust banda** donusuyor —
hicbir genislikte kaybolmuyor. Logo `self-start` aldi (sutun-flex'te cocuk capraz eksende gerilir,
`w-auto` engellemez → logo bandin tamamina yayiliyordu; ilk denemede tam olarak bu oldu).

**Mobil:** duz "CariNet" yazisi yerine panelle ayni dil — lacivert marka bandi + ters logo + altin sac
cizgisi + pitch, altinda beyaz form (`KeyboardAvoidingView` + `ScrollView`). Pitch metni **alici
bakisiyla** yazildi; panelinki saticiya sesleniyor ("Alicilariniz..."), kopyalanmadi.

### Dogrulama

- Panel tarayicida gozle dogrulandi: giris (dar + genis), cokme dizisi Faturalar→Raporlar artik
  calisiyor (cari secici 4 secenek dolu).
- `pnpm --filter panel typecheck|lint`, `pnpm --filter mobile typecheck|lint` temiz.
- API'de degisiklik yok → e2e paketi bu blokta calistirilmadi.
- **VARSAYIM (devam):** mobil giris ekrani hala GOZLE DOGRULANMADI. Expo web onizlemesi
  `react-native-web` istiyor; sirf onizleme icin mobil bagimlilik agacina paket eklenmedi
  (17.07'de eklenip geri alinmisti). Ilk cihaz calistirmasinda bakilmali.

### Hata: dev sunucusu ayaktayken uretim derlemesi alindi

Uretim/dev karsilastirmasini yaparken `rm -rf .next && next build` calistirildi — **ama panel dev
sunucusu o sirada ayaktaydi.** `next dev` ve `next build` AYNI `.next` klasorunu kullanir; derlenmis
CSS altindan cekilince site ciplak HTML'e dustu ve kullanici "tasarim komple gitmis" diye bildirdi.
Kodla ilgisi yoktu. Cozum: her iki sunucuyu durdur → `.next` sil → dev'i sifirdan baslat.

**Kural: dev sunucusu ayaktayken ayni uygulamada `build` calistirma.** Uretim olcumu gerekiyorsa once
dev'i durdur, olc, sonra dev'i temiz baslat.

### Sonraki adim

Oracle ARM kapasitesi (uc AD'de de dolu). Docker Desktop kapaliydi → retry konteyneri hic
calismiyormus; `--restart unless-stopped` ile yeniden kuruldu.

---

## 2026-07-17 · Marka kimligi + tasarim sistemi + mobil navigasyon

Kullanici `carinet_logo.PNG` ekledi: "logoyu butun tasarima uyarla, renkleri logodan al, AI yapmis
gibi durmasin, mobile navbar ekle". Sunucu beklerken yapildi (Faz disi, urun isi).

### Yapilan

**Marka varliklari** — logodan uretildi (`scripts` degil, tek seferlik Pillow): beyaz zemin saydama
cevrildi, ALFA sinirindan kirpildi. Panel logo/mark + favicon (`src/app/icon.png`), mobil
icon/adaptive-icon/splash/logo. **Ters (reverse) varyant**: lacivert zeminde lacivert→beyaz, altin ve
gri KORUNUR.

**Palet** — logonun 3 renginden (#152A55 / #D5A215 / #8A949E) OKLCH'te olcek: ton sabit, aciklik ve
doygunluk degisir. Panel `@theme` (globals.css), mobil `src/lib/theme.ts` — mobil degerler panelin
OKLCH'inden HESAPLANARAK uretildi (elle yazilmadi).

**Tipografi** — Plus Jakarta Sans (`next/font`, derlemede indirilip KENDI sunulur → §11.2 CSP'ye
harici font kaynagi acmak gerekmez). Tabular rakamlar: para kolonlari hizali.

**Panel** — kullanicinin sectigi yon: acik kabuk, lacivert yalniz aktif/buton. Kenar cubugu 14 duz
madde → **3 grup** (Gunluk/Katalog/Kurulum), aktif maddede altin serit. Giris ekrani: solda lacivert
marka alani (ters logo + filigran), sagda form. 172 ham palet sinifi → belirtec (0 kaldi).

**Mobil** — `(tabs)` grubu + **4 sekme** (Ana Sayfa · Ekstre · Odeme · Vitrin), `AppHeader` (logo +
rozetli zil + avatar), yeni `/profil` (hesap degistirici + KVKK + cikis). 169 ham renk → belirtec.

### Karar

- **Notrler `slate` DEGIL `ink`**: logonun grisinden turetilen, lacivert tonlu (H=248) bir olcek.
  Varsayilan Tailwind slate her kurumsal panelde ayni gorunuyor — "AI yapmis gibi"nin buyuk kismi
  renk degil, HERKESIN AYNI varsayilanlari kullanmasi.
- **Altin ASLA durum rengi olmaz** — yalniz marka vurgusu (aktif sekme, odak halkasi, logo). Altin hem
  "marka" hem "uyari" demek olsaydi kullanici ayirt edemezdi; uyari tonu tondan ayrildi (H 45 vs 85).
- **Renk esleme BIR KADEME kaydirildi**: slate-500 (kontrast 4.76) → ink-600 (4.64). Dogrudan
  ink-500'e (3.08) eslemek 53 yerde WCAG AA'yi KIRARDI. `credit` de 4.37'den 4.56'ya cekildi — para
  govde metnidir, "yesil ama okunmuyor" kabul edilemez.
- **Bildirim sekmede degil ZILDE** (kullanicinin karari): sekme cubugu gunluk 4 isi tasir, bildirim
  bir "is" degil uyaridir. Vitrin sekme oldugu icin ana sayfadaki mukerrer kisayolu kaldirildi.
- **Alt sekme = geri dugmesi YOK**: ekstre/vitrin'deki "‹ Geri" sekme olunca anlamsizlasti, silindi.
- `lucide-react-native` eklendi — panel zaten lucide kullaniyor, ayni ikon ailesi. `@expo/vector-icons`
  kokte var ama mobilin BILDIRDIGI bagimlilik degil; ortuk bagimliliga guvenilmedi.
- `assets.d.ts` eklendi: `import logo from './logo.png'` icin. `expo/types` png tanimlamiyor (denendi,
  TS2307), `require()` ise ESLint'e takiliyor.

### VARSAYIM:

- **Panel GOZLE dogrulandi** (tarayici: giris, ozet, cari listesi — seed verisiyle). **Mobil gozle
  DOGRULANMADI**: cihaz/emulator yok. Expo web onizlemesi denendi, `@expo/metro-runtime` SDK 54 ile
  uyusmadi → eklenen bagimliliklar geri alindi. Mobil yalniz **bundle (3640 modul, hata yok) +
  typecheck + lint** ile dogrulandi. Ekranlarin GORUNUMU ilk cihaz denemesinde gozden gecirilmeli.
- Panelin `lg` bolunmus giris duzeni de tarayicida ancak stil enjekte edilerek gorulebildi (Chrome yan
  paneli goruntu alanini 955px'e dusuruyor, `lg` 1024px). Gercek genis ekranda tekrar bakilmali.

### Sonraki adim

Ops adimlari (sunucu bekliyor). Mobil ekranlarin cihazda gorsel kontrolu.

---

## 2026-07-17 · Faz 5 — Yuk testi + ekstre sorgusu yeniden kuruldu (§6.4, §13 yuk hedefi)

Sunucu (Adim 1) kapasite bekledigi icin sunucusuz yapilabilen release kapisi maddesi one alindi:
**"100 eszamanli ekstre <500ms"**. Ayri `carinet_loadtest` veritabaninda olculdu (seed'e ve testlere
dokunulmadi): 405.060 hareket / 402 cari / 97 MB.

### Yapilan

**Olcum (pgbench, 100 eszamanli):** maliyet TABLO buyuklugune degil, CARININ KENDI gecmisine bagli
(indeks dogru calisiyor: Bitmap Index Scan; tablo 5k→405k olurken sure sabit kaldi). Ama cari
gecmisiyle DOGRUSAL buyuyor:

| cari gecmisi | eski kurgu | yeni kurgu |
| ------------ | ---------- | ---------- |
| 1.000        | 52 ms      | —          |
| 5.000        | 190 ms     | 82 ms      |
| 10.000       | 419 ms     | 178 ms     |
| 20.000       | **900 ms** | **274 ms** |

→ Eski kurgu ~10k hareket civarinda hedefi kiriyordu. 5 yilda gunde 11 hareket eden aktif bir
toptanci musterisi oraya varir; uzak bir senaryo degil.

**Cozum** (`ledger.repository.ts`, tek dokunma noktasi — §6.4): window'u tum tarihcede calistirmak
yerine `page` (indeksten, LIMIT kadar) + `opening` (sayfa oncesi tek SUM, siralama yok). Window artik
yalnizca LIMIT kadar satir goruyor. **Anlam degismedi**: `opening` tarih filtresi ALMAZ, yani filtre
disi gecmis ve devir bakiyeye dahil kalir (§6.4).

**`transactions_ledger_covering_idx`** (ham SQL migration; Prisma INCLUDE + kismi indeks ifade edemez):
`opening` artik **Index Only Scan / Heap Fetches: 0**.

**Regresyon testi** `ledger-pagination.e2e-spec.ts` (+2 test). Toplam **147 → 149**: +2 yeni, −1 silinen
zayif test (asagi). Commit mesajinda "150" yazar — zayif testi silmenin ardindan e2e'yi yeniden
calistirmadan commit ettim; dogrusu **149**.

### Karar

- **§6.4'un SQL'i "anlam", uygulama degil** — CLAUDE.md'ye bu ayrim yazildi. Kanonik SQL hala dogru
  tanimi veriyor; repository ayni sonucu daha ucuz uretiyor ve testlerle esitligi kanitli.
- **Gorsel/dosya DB'ye KONMAZ** (§14'e yasak olarak eklendi) — ama gerekce performans DEGIL:
  olctum, Postgres TOAST buyuk bytea'yi satir disina tasidigi icin tarama 16.7→20.4ms, yani
  varsayimim yanlisti. Gercek gerekce: gece sifreli yedek (§11.6) her gece tum gorselleri yeniden
  dump'lar → yedek/restore suresi + R2 maliyeti patlar; imzali URL modeli (§11.2) zaten nesne deposu
  ister. Ayrica covering index sayesinde satir genisligi ekstreyi zaten etkilemiyor.
- **Zayif test silindi**: once `transactions.e2e-spec.ts`'e sayfalama testi yazdim, MUTASYONLA
  denedim (demet minimumu → ayri MIN'ler) ve **test hatayi yakalamadi** → degersizdi. Sebep: seed'de
  tarihler benzersiz + cuid'ler ekleme sirasina gore artiyor, hata gorunmuyor. Yerine ayri dosyada
  KASITLI ayni-tarih yigini + ELLE verilmis id'ler ('tp-aaa-_' < 'tp-tied-_') kuruldu; mutasyonda
  `expected '300.00' to be '3100.00'` ile dusuyor. Test once kirmizi oldugu gorulmeden yesil sayilmadi.

### Sema degisikligi

Migration `20260717090000_ledger_covering_index` — yalnizca indeks; veri/kolon degismedi.
schema.prisma'ya uyari notu dusuldu: `prisma migrate dev` bu indeksi "fazlalik" sanip DROP onerebilir.

### VARSAYIM:

- Olcum **yalniz DB katmani** ve bu gelistirme makinesinde (15 konteyner acik) yapildi. Gercek hedef
  HTTP ucu: ustune Prisma, JSON serilestirme, auth ve ag biniyor. Oracle ARM'da rakamlar farkli
  cikar → **prod'da tekrar olculmeli** (docs/DEPLOY.md yuk hedefi maddesi).
- 100 eszamanli ekstre pilot icin gercekci degil (100 alicinin ayni anda ekstre acmasi demek);
  hedef release kapisi oldugu icin olculdu.

### Sonraki adim

Ops adimlari (sunucu bekliyor). Ek dosya/gorsel OZELLIGININ kendisi (tablo + upload ucu + imzali URL)
bu blokta YAPILMADI — kapsam disi (§16.5); §14 yalnizca tasarim kisitini sabitliyor. Ozellik
**CLAUDE.md §13 → Faz 6 Backlog B1**'e yazildi (17.07; o bolum bu notla birlikte KURULDU — §16.5
"Backlog" diyordu ama boyle bir bolum repoda hic yoktu).

---

## 2026-07-17 · Faz 5 — Sentry ×3 kod tarafi (§11.8)

15.07'de "koda gomulmedi, runbook'ta" denen madde **kod tarafinda kapatildi** (asagidaki karar notu).
Ops tarafinda kalan tek is DSN uretmek.

### Yapilan

- **API**: `apps/api/src/instrument.ts` — `main.ts`'in EN BASINDA import edilir (Sentry enstrumantasyonu
  Nest'ten once yuklenmezse otomatik yakalama calismaz). `all-exceptions.filter.ts` yalniz **5xx**'te
  `captureException` cagirir — 4xx kullanici hatasidir, gurultu yapmaz.
- **Panel**: `withSentryConfig` + `sentry.server/edge.config.ts` + `instrumentation-client.ts` +
  `onRequestError`. `@sentry/cli` build script'i **kapali** (`pnpm-workspace.yaml` allowBuilds:false) —
  binary yalniz deploy'da source-map yuklemek icin gerekir, CI'da gereksiz.
- **Mobil**: `_layout.tsx`'te DSN kapili init + `Sentry.wrap(RootLayout)`; `app.json` plugin.
- Ucunde de **DSN yoksa tam no-op** — hicbir ag cagrisi yok (kural #8: onaysiz ucretli/harici servis yok).

### Karar

- **Sentry artik kodda, ama DSN'e kapili** — 15.07'deki "koda gomulmedi" karari revize edildi.
  Gerekce: DSN'siz kod zaten hicbir sey gondermiyor, dolayisiyla kural #8/#10 ihlali yok; buna karsilik
  wiring'i onceden yapmak DSN gelince tek env degiskenine indiriyor. **DSN'in kendisi hala koda girmez**
  (`.env` + Coolify secrets).
- `tracesSampleRate: 0.1` — ucretsiz kotayi (5k olay/ay) korur.

### VARSAYIM:

- Panel/mobil DSN'i **public'tir** (`NEXT_PUBLIC_` / `EXPO_PUBLIC_` istemciye gomulur) — bu Sentry'nin
  tasarimi, sir degil; kotayi kotuye kullanmaya karsi Sentry tarafinda rate limit acilmali.

### Sonraki adim

Ops: Sentry hesabi + 3 proje → DSN'ler → Coolify/EAS env. Sunucu bekliyor (Adim 1 hala kapasitede).

---

## 2026-07-15 · Faz 5 — Sertlestirme ve Yayin (§11, §13)

Bes bloga bolunerek uygulandi. **Kod tarafi tamam + testli; ops tarafi runbook (docs/DEPLOY.md).**

### Yapilan

**Blok A — Kimlik sertlestirme (§11.1):**

- **2FA enrollment** (§11 icin eksikti — yalniz dogrulama vardi): `/auth/2fa/setup` (aday secret +
  otpauth QR URL), `/enable` (dogrula → 10 tek seferlik yedek kod), `/disable` (parola + kod).
  Giriste TOTP **veya** yedek kurtarma kodu (tek kullanimlik, kullanildikca dusulur).
- **Sizmis parola kontrolu** (HIBP k-anonimlik): SHA-1'in yalniz ilk 5 hanesi servise gider →
  parola aga cikmaz. UCRETSIZ, anahtarsiz (kural #8). Sifirlama + davet kabulu yollarina baglandi.
- Sema: `users.totp_pending_secret / totp_enabled_at / backup_codes / anonymized_at`.
- 8 unit (HIBP prefix/suffix + yedek kod hash) + 8 e2e (setup→giris→yedek kod→kapatma).

**Blok B — Hesap silme + KVKK (§11.6):**

- `DELETE /auth/account`: kimlik **anonimlestirilir** (email/telefon null, ad degisir, oturumlar
  iptal), finansal kayitlar satici defterinde KALIR (kural #4, yasal saklama). Uyelik + push token silinir.
- Mobil: hesap-sil ekrani (parola + "HESABIMI SIL" onayi) + gizlilik/KVKK ekrani + ana sayfa linkleri.
- Panel: `/gizlilik` herkese acik KVKK aydinlatma metni + giris linki.
- 4 e2e: yanlis parola reddi, acik onay zorunlulugu, anonimlestirme, **finansal kaydin defterde kalmasi**.

**Blok C — Uygulama sertlestirme (§11.2):**

- **pino + REDACTION** (nestjs-pino baglandi — dep vardi, kullanilmiyordu): parola/token/IBAN/kart/2FA
  loglara "[gizli]" yazilir (kural #10). Test'te sessiz, dev pretty, prod JSON.
- **Helmet siki CSP** (frame-ancestors none, object-src none) + **prod HSTS** (preload).
- **Swagger prod'da sabit-zamanli basic auth** arkasinda; kimlik tanimli degilse `/docs` HIC acilmaz (404).
- **Gercek boot ile dogrulandi**: CSP/HSTS header'lari, prod /docs=404, pino JSON log.

**Blok D — CI / tedarik zinciri (§11.7):**

- GitHub Actions **SHA'ya pinlendi** (git ls-remote ile gercek SHA'lar; tag tasinabilir, SHA degismez).
- **Trivy fs** job (bagimlilik acikligi + sir + yanlis yapilandirma; HIGH/CRITICAL'de kirar).
- **ZAP baseline** workflow (DAST): staging'e karsi elle tetik veya haftalik cron (STAGING_URL degiskeni).
- **Dependabot**: npm (pnpm workspace, minor/patch grupla) + github-actions, haftalik.

**Blok E — Yedek/restore + deploy runbook (§11.4/5/6):**

- `scripts/backup.sh` (pg_dump | age → R2, duz metin diske dusmez, retention) + `scripts/restore.sh`.
- `docs/DEPLOY.md`: VPS/UFW/fail2ban, Cloudflare WAF+TLS, Sentry x3 wiring, Coolify prod, restore
  provasi, **§11 release kontrol listesi** (kod tarafi isaretli, ops tarafi kullaniciya).

### Karar

- **2FA setup parola ister; disable parola + kod ister** — calinmis oturum tek basina 2FA kuramaz/kapatamaz.
  Yedek kodlar telefon kaybinda kilitlenmeyi onler (App Store bunu bekler); sha256 hash'li saklanir,
  duz metin YALNIZ enable aninda bir kez doner.
- **HIBP FAIL-OPEN**: servis erisilemezse kullanici ENGELLENMEZ (ucuncu taraf kesintisi kayit/sifirlamayi
  kirmasin). Guvenlik icin ideal degil ama erisilebilirlik icin dogru taviz (log'a dusulur).
- **Hesap silme = anonimlestirme, hard delete DEGIL** (kural #4): finansal kayitlar user_id ile durur ama
  kimlik cozulmez. e2e bunu ayrica kanitlar (silme sonrasi transaction hala orada).
- **Sentry KODA GOMULMEDI, runbook'ta**: DSN gerektirir + harici servise veri gonderir (kural #8/#10).
  Kod `SENTRY_DSN`'i tanir; wiring onayli/DSN'li ortamda yapilir. Bu Faz 5'in tek "ops-only" kod maddesi.
  → **17.07'de REVIZE EDILDI**: wiring koda alindi (DSN'e kapili, DSN'siz no-op). Bkz. 17.07 kaydi.
- **Action'lar SHA'ya, master'a degil**: trivy-action master yerine 0.35.0 tag'inin SHA'sina pinlendi;
  Dependabot github-actions ekosistemi bunlari gunceller.
- **Yeni e2e testleri afterAll'da temizlenir**: 2FA/silme testleri seller-1'e cari ekliyordu; tenant
  sayim testi (tam 3 bekliyor) dosya sirasina gore kiriliyordu → temizlik ile sira-bagimsiz.

### Sema degisikligi

Migration `20260715120000_faz5_2fa_account_deletion`: `users` tablosuna 4 alan (totp_pending_secret,
totp_enabled_at, backup_codes[], anonymized_at). Finansal veriye dokunulmadi.

### VARSAYIM:

- **Faz 5 "bitti" kriteri kod tarafinda saglandi; ops tarafi (release kapisi §11'in altyapi maddeleri)
  sunucu + harici hesap gerektirdigi icin kullaniciyi bekliyor** — tipki Faz 1'in "pilot verisi" maddesi
  gibi. docs/DEPLOY.md bu adimlari ve §11 kontrol listesini tasir; her adim kanidiyla PROGRESS.md'ye islenecek.
- **HIBP + Sentry** e2e'de kapalidir (ag cagrisi hermetik olmali); HIBP saf mantigi (prefix/suffix) unit
  testli, Sentry DSN'siz no-op.

### Bitti kriteri kontrolu (Faz 5 — kod tarafi)

- [x] 2FA enrollment + revoke-all (revoke-all Faz 0'dan; enrollment Blok A) · giriste TOTP/yedek kod
- [x] Hesap silme akisi (Apple) + KVKK sayfalari (panel + mobil)
- [x] §11.2 uygulama sertlestirme: CSP + HSTS + pino redaction + Swagger prod auth (gercek boot dogrulamasi)
- [x] Trivy + ZAP CI'da · Dependabot · Actions SHA pin
- [x] Sifreli yedek + restore scriptleri + restore provasi rehberi
- [x] **Sentry ×3 kod wiring** (§11.8) — 17.07, DSN'e kapili (DSN'in kendisi ops)
- [ ] **Ops (§11.4/5/8): VPS/Cloudflare/Coolify sertlestirme, Sentry DSN uretimi, restore provasi kaniti,
      prod deploy, yuk hedefi** → docs/DEPLOY.md, KULLANICI ADIMI
- [x] Kapilar: **94 unit** (74 shared + 20 api) · **147 e2e** (11 dosya) · lint/typecheck/build temiz

### Sonraki adim

Ops adimlari (docs/DEPLOY.md) yurutulup §11 kontrol listesi %100'lenince + aylik restore provasi
kanitlaninca Faz 5 "bitti". Ardindan pilot satici go-live (Faz 1 pilot verisi geçis sihirbaziyla).

---

## 2026-07-14 · Faz 4 — Katalog ve Iletisim (§13)

### Yapilan

**shared (11 yeni unit test):**

- `reminders.ts` — vade hatirlatma kuralinin SAF cekirdegi: `reminderFor(dueDate, asOf)` →
  vadeye 3 gun kala DUE_SOON, vade gunu DUE_TODAY, vadesi gectikten 1/7/30 gun sonra OVERDUE.
  Ara gunlerde `null` → **her gun spam yok**.
- `schemas/catalog.ts` — urun/stok/kampanya/bildirim/push token/kur/talep/export semalari (kural #7).

**api (6 yeni unit test):**

- `products` — CRUD + stok. Stok MUTLAK yazilir (sayim sonucu), artirma/azaltma yok.
  Alici yalniz AKTIF urunleri gorur (mobil vitrin) — sunucu kisitlar, istemciye guvenilmez.
- `campaigns` — CRUD + `announce`: kampanyayi TUM alicilara push'lar.
- `notifications` — bildirim merkezi (hesap bazli liste + rozet + okundu) · `PushService`
  (Expo Push API, UCRETSIZ → kural #8) · `push_tokens` CRUD.
- `due-reminder.task` — gunluk 09:00 cronu: FIFO ile ACIK kalemleri bulur, yalniz onlara hatirlatir.
- `exchange-rates` — TCMB `today.xml` parser (6 unit test) + gunluk 16:00 cronu + Kurlar ucu.
- `requests` — Talep-Oneri (alici acar, satici yanitlar → bildirim + push).
- `exports` — Excel disa aktarma (cari/ekstre/urun/risk), CSV injection korumali (§11.3).

**panel:** Urunler (satir ici stok girisi) · Kampanyalar (+ "Duyur" push) · Talepler (yanitla/kapat) ·
Kurlar · cari/rapor/urun sayfalarina **Excel indir** dugmeleri.

**mobil:** Bildirim merkezi + **rozet** · Vitrin · Kampanyalar+Kurlar · Talep-Oneri ·
push izni/token kaydi (`expo-notifications`).

### Karar

- **Push, DB bildiriminden AYRI ve SONRA gonderilir.** `notify()` finansal islemle ayni
  transaction'da yazar (geri alinirsa bildirim de gitmez); `sendPush()` commit'ten SONRA cagrilir.
  Aksi halde geri alinan bir tahsilat icin telefon calardi. Push basarisiz olsa bile bildirim
  merkezi calisir (kayit DB'de durur) → push BEST-EFFORT'tur, hata firlatmaz.
- **Vade hatirlatmasi yalniz ACIK kalemlere gider.** Cron, Faz 2'nin FIFO yaslandirmasini kullanir:
  alici borcunu odemisse o fatura icin telefon calmaz. **Odemis musteriye "borcunuz var" demek
  en kotu hatadir** — e2e bunu ayrica test eder (odenmis cari → bildirim YOK).
- **Hatirlatma tekrari 1/7/30. gunlerle sinirli.** Her gun bildirim atmak uygulamayi sessize aldirir.
- **Push tokeni SATICI bazli DEGIL** (§6.2): kullanici+cihaz bazlidir, `PushToken` tenant modeli
  degildir. Bildirimin hangi hesaba ait oldugu PAYLOAD'da tasinir (`sellerId` + `buyerAccountId`);
  mobil rozeti aktif hesaba gore hesaplar. Hesap degistirince token yeniden kaydedilmez.
- **Kampanya bildirimi HER CARI icin ayri yazilir**: ayni kullanici iki carinin uyesiyse iki bildirim
  alir ve her biri kendi hesabinin rozetine duser (coklu uyelik).
- **TCMB kurlari BILGI amaclidir.** Faturaya yazilan kur KAYIT ANINDA satira sabitlenir (§7) →
  gecmise donuk kur degisimi bakiyeyi OYNATMAZ (kural #2). Kur XML'i string olarak okunur,
  `parseFloat`'a sokulmaz; JPY gibi 100 birim uzerinden kote edilenler birime indirgenir.
- **Excel'de metin hucreleri notrlestirilir** (§11.3): cari unvani `=cmd|...` ise dosyayi acan
  muhasebecinin makinesinde komut calisirdi. `neutralizeFormula` basina tirnak koyar.

### Sema degisikligi

Iki tablo eklendi (migration `20260714…_catalog_push_requests`) — ikisi de §13 Faz 4'un gerektirdigi
ama §7'de karsiligi olmayan tablolar:

- `push_tokens` (user_id, token UNIQUE, platform, device_name) — §6.2 "push token kullanici+cihaz
  bazlidir" diyor ama tablosu yoktu. Tenant modeli DEGILDIR.
- `support_requests` (+ `RequestType`, `RequestStatus` enumlari) — Talep-Oneri; §9'daki devir
  mutabakati itirazi da buradan akar. Tenant modelidir.

### Duzeltilen hatalar

- **`/exports?target=BUYERS` ile ALICI, saticinin TUM cari listesini (unvan, bakiye, limit)
  indirebiliyordu** — IDOR. Rol kapisi eklendi, e2e ile kanitlandi.
- `transactions.e2e` "bakiye = Σ hareket" testi ham tutar toplami varsayiyordu; baska bir test
  o cariye dovizli satir birakirsa kiriliyordu (sira bagimli, ara ara patliyordu). §6.4'e uygun
  sekilde TRY normalizasyonuyla karsilastiracak hale getirildi → iki ardisik tam kosuda kararli.
- `pnpm add expo-notifications` SDK 54 ile uyumsuz surumu (57) cekti; `npx expo install` ile
  SDK'ya uygun surume (0.32) alindi. **Expo paketleri her zaman `expo install` ile eklenmeli.**

### VARSAYIM:

- Push GONDERIMI Expo sunucusuna cikar; e2e testleri BIZIM tarafimizdaki her seyi kanitlar
  (dogru kullanicilar, dogru hesap baglami, dogru payload, rozet). Gercek cihaza teslimi
  fiziksel cihazla dogrulanir (Expo Go'da push izni gerekir; simulatorde token uretilmez).
- `expo-notifications` uygulama icinde bildirim gosterimi icin `app.json` plugin kaydi eklendi;
  standalone build'de ayrica FCM/APNs kimlik bilgileri gerekir (Faz 5 magaza isi).

### Bitti kriteri kontrolu (Faz 4)

- [x] (1) **Vadesi yaklasan fatura cron bildirimi uretiyor** — `catalog.e2e-spec.ts`: vadesi TAM
      3 gun sonra olan fatura icin DUE_REMINDER bildirimi, dogru satici + dogru cari baglamiyla,
      metinde belge no ve "3 gun". Ayrica **odenmis cariye bildirim GITMIYOR** (FIFO).
- [x] (2) **Kampanya push'u hesap baglamiyla ulasiyor** — duyuru sonrasi her cari icin AYRI
      bildirim, `sellerId` dogru, ayni kullanicinin iki carisi icin iki ayri kayit.
- [x] Urunler+stoklar (panel CRUD + mobil vitrin) · Kampanyalar+push · Bildirim merkezi (hesap bazli
      rozet) · Talep-Oneri · TCMB kur cronu + Kurlar ekrani · Excel disa aktarma (CSV injection korumali)
- [x] Kapilar: **86 unit** (74 shared + 12 api) · **135 e2e** (9 dosya) · lint/typecheck/build temiz

### Sonraki adim

Faz 5 — Sertlestirme ve Yayin: §11'in TUM maddeleri (release kapisi) · 2FA zorunlu + revoke-all ·
VPS+Cloudflare sertlestirme · sifreli yedek→R2 + restore provasi · Trivy+ZAP CI'da · Sentry ×3 ·
hesap silme akisi (Apple) · KVKK sayfalari · Coolify prod deploy · yuk hedefi: 100 eszamanli ekstre <500ms.

---

## 2026-07-14 · Faz 3 — Tahsilat: Iki Kanal (§8)

### Yapilan

**shared (15 yeni unit test):**

- `collections.ts` — eslestirmenin SAF cekirdegi: `matchStatementRows(rows, intents, accountCodes)`.
  Iki gecis: (1) referans kodu aciklamada geciyorsa EXACT, (2) kalanlarda cari kodu geciyorsa SUGGESTED.
  Banka aciklamasi kodu bozar (bosluk atar, kucuk harfe cevirir) → karsilastirma alfanumerik cekirdek
  uzerinden (`normalizeReference`). Bir intent iki satira BAGLANAMAZ (eslesince havuzdan cikar).
- `isValidIban` — mod-97 (ISO 13616). Yanlis IBAN = parayi baska hesaba yonlendirmek demek.
- `schemas/collections.ts` — intent/misafir/onay/toplu onay/IBAN/POS semalari (kural #7).

**api:**

- `modules/collections/` — §6.5 `CollectionProvider` soyutlamasi; `BankTransferProvider` (Kanal 1) ve
  `CardPosProvider` (Kanal 2) ayni arayuzu uygular ve onayda AYNI hatta birlesir: `ReconciliationService`
  → CONFIRMED → CREDIT → bildirim → audit.
- `StatementService` — banka ekstresi (CSV/Excel) → staging (`bank_statement_rows`) → otomatik eslestirme
  onerisi → insan onayi → toplu onay. Cikis hareketleri (yalniz "borc" kolonu / negatif tutar) atlanir.
- `SandboxPosAdapter` + `PosRegistry` — hosted 3D paketi (HMAC-SHA256 imzali) + callback dogrulamasi.
- `IntentExpiryTask` — 30 dk'da bir, suresi dolan PENDING talepler EXPIRED (sistem modu, cross-tenant).
- `modules/sellers/` — tahsilat IBAN'lari + POS config CRUD (AES-256-GCM, 2FA'li, maskeli gorunum).
- `modules/notifications/` — yalniz DB bildirimi (ortak hattin bir adimi).

**panel:** Tahsilat sayfasi (bekleyen talepler + manuel onay + ekstre yukle → eslestirme → toplu onay),
Ayarlar sayfasi (IBAN + POS, 2FA kodu alani), misafir odeme sayfasi `pay/{sellerSlug}`.

**mobil:** "Odeme Yap" ekrani — havale (referans kodu + IBAN, kopyala/paylas) veya kart
(saglayicinin hosted sayfasina yonlendirme; taksit tablosu).

### Karar

- **Idempotency UC KATMANLI** (bitti kriteri 3). Yalniz uygulama kontrolune guvenilmedi:
  1. **intent**: `PENDING → CONFIRMED` compare-and-set (`updateMany where status='PENDING'`).
     Yaris kosulunda ikinci istek 0 satir gunceller → cift CREDIT imkansiz.
  2. **ekstre satiri**: `bank_statement_rows.matched_intent_id` UNIQUE → DB seviyesinde kilit.
  3. **CREDIT**: intent'e bagli iptal edilmemis hareket varsa yenisi YAZILMAZ (erken donus).
     Hepsi TEK transaction icinde.
- **Karta cekilen tutar ≠ cariden dusulen tutar.** Taksit vade farki BANKANIN gelirdir, saticiya gelmez.
  6 taksitte 10.000 TL borc icin karta 10.400 cekilir ama cari YALNIZ 10.000 duser. Callback'teki
  `chargedAmount` sadece kanit/audit icindir; CREDIT'e intent tutari yazilir. (Aksi halde alicinin borcu
  odedigi paradan FAZLA azalirdi.)
- **Kismi odeme**: gerceklesen tutar islenir, fark icin otomatik YENI bekleyen talep acilir (§8).
  Fazla odemede tamami islenir (bakiye negatife dusebilir — alacakli duruma gecer, dogru davranis).
- **Tahsilat TRY'dir.** Bakiye TRY uzerinden turetilir (§6.4) ve tahsilat aninda dovize kur uygulamak
  gunluk TCMB kuru ister (Faz 4). Dovizli faturasi olan alici TRY karsiligini oder.
- **Misafir yolunda var/yok sizdirilmaz**: olmayan cari kodu ile hatali tutar AYNI mesaji alir
  ("Cari kodu veya tutar hatali"). Ustune siki rate limit (5/dk) + Turnstile.
- **POS callback'inde JWT yok** → referans kodu (yalniz bir ARAMA anahtari) ile satici bulunur,
  `TenantContext.setSeller` ile baglam kurulur, imza O saticinin anahtariyla dogrulanir.
  Imza tutmadan hicbir sey yazilmaz; dogrulanamayan bildirim `POS_CALLBACK_REJECTED` audit'i uretir (§11.8).
- **Toplu onayda satir tutari CLIENT'TAN DEGIL DB'den okunur** — onaylayan yalniz eslesmeyi secer,
  tutari degistiremez.
- **Aciklamasiz dekont da tek hattan gecer**: insan cariyi secer, sistem talebi kendi acar ve hemen
  onaylar → her CREDIT'in arkasinda bir intent vardir (izlenebilirlik).
- **Sandbox POS**, pilotun saglayicisi belli olana kadar TEK adaptordur (§8: "ilki pilot saticinin
  saglayicisina gore yazilir"). Hosted sayfa adresi env'den gelir ve BIZIM alan adimiz degildir (kural #5).

### Sema degisikligi

`sellers.seller_no` (SERIAL UNIQUE) eklendi — migration `20260714150000_seller_no`.
Gerekce: §7 referans kodu formati `S{sellerNo}-{accountCode}-{6 CSPRNG}` bir satici numarasi varsayiyor
ama `sellers` tablosunda karsiligi yoktu. Dis ID'ler cuid olarak KALIR (§6.1); bu numara yalniz havale
aciklamasina ELLE yazilan referans kodunda kullanilir — kod kisa ve telefonda okunabilir olmak zorunda.

### Duzeltilen hata (seed)

Seed'deki Is Bankasi IBAN'i (`TR12...`) mod-97 kontrolunden gecmiyordu → `TR18...` ile duzeltildi.
Yeni `isValidIban` bunu yakaladi.

### VARSAYIM:

- **Push GONDERIMI Faz 4'te.** Faz 3'un ortak hatti (CONFIRMED → CREDIT → bildirim → audit) bildirimi
  `notifications` tablosuna yazar; cihaza push (expo-notifications + token kaydi) Faz 4'un isi. Payload'in
  hesap baglami (sellerId + buyerAccountId) satirda zaten var, Faz 4 bunun uzerine kurulur.
- **Bitti kriteri (2)** "sandbox kartla hosted sayfadan odeme": gercek bir saglayici sandbox hesabimiz yok.
  Test SINIRIN BIZDEKI TARAFINI kanitlar: intent → imzali hosted 3D paketi → imzali callback → CREDIT →
  bakiye duser + tekrar eden callback islenmez. Hosted sayfanin KENDISI saglayicinindir; pilotun saglayicisi
  belli olunca adaptor onun sandbox'ina baglanip ayni testler gercek uctan gecirilir.

### Bitti kriteri kontrolu (Faz 3)

- [x] (1) Sahte ekstreyle havale akisi UCTAN UCA — `collections.e2e-spec.ts`: talep → CSV ekstre →
      otomatik eslestirme (EXACT + NONE) → toplu onay → bakiye 20.000 → 14.250 (elle hesaplanan)
- [x] (2) Sandbox POS: hosted 3D paketi → imzali callback → bakiye duser (10.000 → 6.000; karta 4.080
      cekilmesine ragmen cariden 4.000 dusuldu)
- [x] (3) Ayni intent / ayni satir / ayni callback IKINCI KEZ islenemiyor — uc test, her birinde
      bakiye degismiyor ve intent'e bagli CREDIT sayisi 1
- [x] Kural #5: kart formu yok, PAN/CVV islenmez, para platform hesabina girmez (misafir sayfa ve mobil
      kullaniciyi saglayicinin adresine yonlendirir)
- [x] Kenar durumlar: kismi odeme (fark → yeni talep), aciklamasiz dekont (insan onayi), reddedilen odeme
      (talep PENDING kalir), suresi dolmus talep onaylanamaz
- [x] Kapilar: **69 unit** (63 shared + 6 api) · **114 e2e** (8 dosya) · lint/typecheck/build temiz

### Sonraki adim

Faz 4 — Katalog ve Iletisim: urunler/stoklar, kampanyalar, **push altyapisi** (yeni fatura, vade hatirlatma
cronu, tahsilat onayi — hesap baglamli payload), bildirim merkezi, talep-oneri, TCMB kur cronu, Excel disa aktarma.

---

## 2026-07-14 · Faz 2 — Finansal Raporlar

### Yapilan

**packages/shared — hesap katmani (kural #1, 12 unit test)**

- `computeAging`: alacaklar en ESKI borctan baslayarak kapatilir (**FIFO**), kalan acik kalemler
  vadeye gore kovalara dagitilir (NOT_DUE / 0-30 / 31-60 / 61-90 / 90+).
  FIFO tercihi bilinclidir: aksi halde "vadesi gecen" tutari sistematik olarak sisirilir.
- `computeAverageDue`: **tutar agirlikli** ortalama vade — Σ(tutar × vade_gunu) / Σ(tutar);
  sonuc tarihe geri cevrilir, `averageOverdueDays` ile kac gun gecikme oldugu verilir.
- `limitUsagePercent`: limit 0 ise null (yuzde anlamsiz).

**API**

- `reports` modulu: `/reports/risk` (liste), `/reports/risk/:id` (acik kalemler dahil),
  `/reports/periodic-balance` (aylik borc/alacak + kumulatif bakiye; tarih filtresinde **acilis
  bakiyesi ayrica raporlanir** ki devir kaybolmasin), `/reports/average-due/:id`,
  `/reports/statement-pdf/:id` (pdfmake; `me` kisayolu mobil icin).
- `addresses` modulu: CRUD. Address tenant modeli DEGILDIR (seller_id yok) → tenant kontrolu
  BuyerAccount uzerinden ELLE yapilir.
- PDF: pdfmake 0.3, Roboto paketle gelir (dis font indirmesi yok). **SSRF kapali**: belge icinden
  dis kaynak cekilemez (`setUrlAccessPolicy(() => false)`), yerel erisim yalniz font klasoru (§11.2).

**Panel** — Raporlar sayfasi: risk foyu tablosu (yaslandirma kovalari + limit % rozeti + ortalama vade),
Recharts ile donemsel bakiye grafigi (borc/alacak bar + kumulatif bakiye cizgisi). Cari detayinda
yaslandirma karti, adres yonetimi ve **Ekstre PDF indir**.

**Mobil** — Dashboard'da vadesi gecen tutar + kova dagilimi karti; Ekstre ekraninda **PDF paylas**
(expo-file-system + expo-sharing → sistem paylasim sayfasi).

**Testler:** 12 yeni shared unit + 13 yeni e2e → toplam **60 unit + 91 e2e yesil**.

### Kararlar

1. **Yaslandirma FIFO ile yapilir.** Tahsilat hangi faturaya ait belirtilmediginden (Faz 3'te
   `collect_intent` ile eslesecek), alacaklar en eski borctan dusulur — muhasebe pratigi budur.
2. **Ortalama vade yalniz ACIK kalemler uzerinden** hesaplanir; kapanmis faturalar ortalamayi kirletmez.
3. PDF zarf DISINDA ham ikili doner (§10 zarf kuralinin bilincli istisnasi); `Content-Type: application/pdf`.
4. Risk foyu SQL yalniz veriyi getirir; **tum parasal hesap TS'te decimal.js ile** yapilir (kural #1).
   Boylece ayni fonksiyon hem API'de hem testte dogrulanabilir.

### Bitti kriteri kontrolu (Faz 2)

- [x] Risk Foyu (acik bakiye, vadesi gecen, yaslandirma 0-30/31-60/61-90/90+, limit %)
- [x] Donemsel Bakiye (raw SQL + panel grafigi) · Ortalama Vade (agirlikli + test) · Adresler
- [x] Ekstre PDF (pdfmake) + mobilde paylas · panel ozet raporu
- [x] **Rapor rakamlari elle hesaplananlara esit** — `reports.e2e-spec.ts` kontrollu bir cari kurar
      (F1/F2/F3 + tahsilat) ve beklenen degerleri ELLE yazar; uygulamanin kendi fonksiyonuyla
      karsilastirmaz (dairesel dogrulama yok).

### Sonraki adim

Faz 3 — Tahsilat: iki kanal (§8). `CollectionProvider` + `BankTransferProvider`, intent yasam dongusu

- expiry cron, mobil "Odeme Yap" (referans + IBAN), panelde bekleyen intent + manuel onay +
  **ekstre importu → eslestirme → toplu onay**, `seller_pos_configs` CRUD (AES, 2FA'li degisiklik),
  ilk POS adaptoru (hosted 3D + callback imza + idempotency), misafir `pay/{sellerSlug}`.

---

## 2026-07-14 · Faz 1 — Cekirdek MVP

Faz 1 dort bloga bolunerek uygulandi: (A) finansal cekirdek, (B) import hatti + Gecis Sihirbazi,
(C) panel UI, (D) mobil.

### Yapilan

**Blok A — finansal cekirdek (API)**

- `packages/shared`: cari/hareket/fatura Zod semalari; `invoice.ts` — fatura kalem/toplam hesabi
  (satir bazli yuvarlama → "kalemler toplami ≠ fatura toplami" kurus farki olusmaz), 9 unit test.
- `ledger` modulu: bakiyenin TEK kaynagi (kural #2). Yuruyen bakiye §6.4'un window function'i ile
  sorgu aninda; toplu bakiye tek sorguda (cari listesinde N+1 yok).
- `buyers`: tam CRUD + cari kodu tarihcesi + pasife alma (silme YOK) + canli bakiye + `/buyers/me`
  (mobil dashboard) + `/buyers/me/statement` (mobil ekstre).
- `representatives`: CRUD. `transactions`: giris + iptal. `invoices`: fatura+kalem+otomatik DEBIT
  hareketi TEK transactionda; iptal bagli hareketi de iptal eder.
- `audit`: finansal degisimde zorunlu kayit; ayni DB transaction'inda yazilir (kural #4).

**Blok B — import hatti (§6.6) + Gecis Sihirbazi (§9)**

- Sema: `import_batches.target` + `import_templates` (onaylanan esleme sablonu) + migration.
- `shared`: kolon takma adi eslemesi (`autoMap` — "Cari Kodu", "Borç", "Vade"… tanir), TR/EN sayi
  bicimleri ("1.234,56" ↔ "1,234.56"), parantezli negatif, Excel seri tarihi, **formul enjeksiyonu
  etkisizlestirme** (§11.3), satir semalari (borc/alacak → yon + tutar).
- Hat: yukle → ayristir → satir satir Zod → staging (`import_rows`) → onizleme + hata raporu
  (satir no + sebep) → onay → **tek DB transaction** commit → toplu iptal (`is_cancelled`).
- **Gecis Sihirbazi**: kesim tarihi + devir; **Dogrulama Raporu** — satici programinin toplamiyla
  fark varsa commit REDDEDILIR ("fark kapanmadan go-live yok").
- **UBL-TR**: XML/ZIP ayristirma (fast-xml-parser), **VKN ile cari eslesmesi**, fatura+kalem+DEBIT.
  Eslesmeyen VKN commit'i durdurur (veri sessizce yanlis cariye yazilmaz).
- MinIO/R2 arsivleme + sha256 mukerrer dosya uyarisi.

**Blok C — panel (Next.js 15 + shadcn/ui deseni + TanStack Table v8)**

Ozet · Cari listesi (canli bakiye, arama, sunucu sayfalamasi) · Cari detayi (bakiye kartlari, ekstre,
davet linki, pasife alma) · Hareketler (+ giris formu, iptal) · Faturalar (+ kalemli form, canli
toplam onizlemesi) · Ice aktarim (yukle → onizleme/hata → onay) · Gecis sihirbazi (dogrulama raporu)
· Temsilciler.

**Blok D — mobil (Expo 53)**

Dashboard (bakiye, limit + kullanim, temsilci, borc/alacak donut grafigi, son 10 hareket) ·
Ekstre (tarih filtresi + yuruyen bakiye + **sonsuz kaydirma**) · Fatura detayi (kalemler + satir
bazli kur) · **Beni hatirla** (kapaliysa token kalici yazilmaz, oturum bellekte kalir).

**Testler:** 36 unit (shared: para + fatura + import) + 6 unit (AES) + **78 e2e** — hepsi yesil.
Yeni e2e dosyalari: `buyers`, `transactions`, `invoices`, `imports` (her birinde cross-tenant matrisi).

### Kararlar

1. **Bakiye TRY'ye normalize edilir** (asagidaki UYUSMAZLIK maddesi): `ROUND(amount × exchange_rate, 2)`.
   Tum satirlar TRY iken (kur = 1) §6.4'un SQL'i ile birebir ayni sonucu verir.
2. Fatura toplami istemciden ALINMAZ; sunucuda `computeInvoiceTotals` ile hesaplanir (panel ayni
   fonksiyonu yalniz onizleme icin cagirir).
3. Faturaya/tahsilata bagli hareket **tek basina** iptal edilemez; fatura iptali bagli hareketi de iptal eder.
4. Import staging asamasi **hicbir finansal kayit yazmaz**; yazma yalniz commit'te ve tek transactionda olur.
5. Mevcut cari, cari-listesi importunda EZILMEZ (atlanir); guncelleme panelden yapilir.
6. Ayni cariye ikinci kez devir girilemez (once mevcut devir iptal edilmeli).
7. Cari hesap silinmez → `isActive = false`; pasif cariye hareket girilemez.
8. Ham SQL (`$queryRaw`) tenant eklentisinin DISINDADIR → `ledger.repository.ts` her sorguda
   `seller_id`'yi baglamdan okuyup ELLE koyar; baglam yoksa sorgu atilmaz.

### CLAUDE.md ile UYUSMAZLIK → **COZULDU (kullanici onayi, 14.07.2026)**

- **§6.4'un SQL'i ham `amount` topluyordu.** Seed'deki USD faturasi `amount = 6000 USD, rate = 38.4210`
  olarak duruyor; ham toplama USD ile TRY'yi karistirir ("tek bir kurus yanlis hesaplanmamali" ilkesine
  aykiri). Bakiye/ekstre `ROUND(amount × exchange_rate, 2)` ile TRY'ye normalize edildi (satir bazli
  yuvarlama). TRY satirlarda kur 1 oldugu icin eski ifadeye indirgenir.
  → **CLAUDE.md §6.4 guncellendi (surum 3.1)**; kod zaten bu haldeydi, degisiklik gerekmedi.

### VARSAYIM (CLAUDE.md §7'ye eklenmesi onerilir)

- `import_batches.target` (ImportTarget enum) — ayni dosya bicimi farkli tablolara yazilabilir; §9'un
  dort kanali (cari listesi / hareket / devir / UBL) icin hedef alani sart.
- `import_templates` tablosu — §9 "onaylanan esleme sablon olarak saklanir" maddesinin karsiligi.
- `import_batches.file_name` + `mapping` (jsonb) — kullanilan kolon eslemesi ve kesim tarihi burada tutulur.
- **Kredi limiti Faz 1'de BLOKLAMAZ** (yalniz gosterilir): §7'de limit var ama "limit asilinca hareket
  girilemez" kurali yok; `CREDIT_LIMIT_EXCEEDED` hata kodu tahsilat/siparis akislari icin ayrildi.
  Risk foyunde limit kullanimi Faz 2'de raporlanacak.

### Bitti kriteri kontrolu (Faz 1)

- [x] 200 satirlik Excel hatasiz (e2e testi: ayristirma + commit + bakiye dogrulamasi)
- [x] Bakiye = Σ hareket (e2e: API bakiyesi ham hareketlerden elle hesaplanana esit)
- [x] Coklu-uyelik gecisi calisiyor (Faz 0'dan devam; mobil hesap degistirici canli)
- [x] Panel: cari CRUD + hareket + fatura + Excel import + Gecis Sihirbazi + davet linki
- [x] Mobil: Dashboard + Ekstre (yuruyen bakiye) + Fatura detayi
- [ ] **Pilotun gercek verisi sihirbazla sifir farkla tasindi** → gercek veri gerektirir, KULLANICI ADIMI
- [ ] Pilot saticiya gosterilebilir → yukaridaki adimdan sonra

### Sonraki adim

Faz 2 — Finansal Raporlar: Risk Foyu (yaslandirma 0-30/31-60/61-90/90+, limit %), Donemsel Bakiye
(raw SQL + grafik), Ortalama Vade (tutar agirlikli), Adresler, Ekstre PDF (pdfmake), panel ozet raporu.

---

## 2026-07-13 · Faz 0 — Iskelet ve Temel

### Yapilan

**Depo iskeleti**

- pnpm 11 + Turborepo monorepo (`apps/api`, `apps/panel`, `apps/mobile`, `packages/shared`, `packages/config`).
- `docker-compose.yml`: postgres:16-alpine + Mailpit (UI :8025) + MinIO (private `carinet` bucket, otomatik olusturulur).
- `.env.example` + lokal `.env` (gercek rastgele sirlarla uretildi), `.graphifyignore`, `.gitleaks.toml`.
- ESLint 9 flat config + Prettier + husky/lint-staged + gitleaks pre-commit kancasi.

**packages/shared**

- Enumlar (§7), `errors.ts` (kod → Turkce mesaj → HTTP durum eslemesi), Zod semalari (auth, sayfalama).
- `money.ts`: decimal.js sarmalayici — `toMoney/add/sub/mul/div/sum/computeBalance/computeRunningBalances`.
  `number` bilerek tip disinda birakildi (kural #1). **14 unit test yesil.**

**apps/api (NestJS 11 + Prisma 6)**

- §7'nin TAM tablo seti + ilk migration (`20260713131804_init`).
- **2 saticili seed**: 7 kullanici, 4 cari, **68 hareket** (3 DEVIR + farkli vadeler), 2 fatura (**biri USD, kur satira sabit**),
  1 bekleyen `collect_intent` + uretilen ornek banka ekstresi CSV'si, satici-2'de sandbox POS config (AES-256-GCM sifreli),
  2+2 urun/stok, 2 kampanya, TCMB kur ornegi. **Coklu uyelik kurgusu var**: `mehmet@zincirmarket.com` hem satici-1 hem satici-2 carisi.
- Auth: login (argon2id, tek tip yanit), refresh **rotasyonu + reuse tespiti → aile toptan iptal**, logout, revoke-all,
  sessions, me, memberships, **switch-account**, forgot/reset password (Mailpit), davet uret/kabul et.
- Tenant izolasyonu **uc kemerli** (§6.1): JWT baglami → `TenantGuard` → **Prisma client extension** (`tenant-guard.extension.ts`)
  her tenant modeline `seller_id` enjekte eder; baglam yoksa sorgu CALISMAZ.
- Yanit zarfi interceptor + `AllExceptionsFilter` (Prisma/Zod/AppError → §10 zarfi, ic detay sizmaz) + Swagger `/docs` (nestjs-zod ile semalar otomatik).
- `buyers` modulu (yalniz okuma) — tenant izolasyonunun kanit zemini; tam CRUD Faz 1'de.
- **Testler: 6 unit (AES) + 14 unit (para, shared) + 25 e2e (auth + cross-tenant matrisi) = hepsi yesil.**

**apps/panel (Next.js 15)** — `/giris` (react-hook-form + Zod, cookie tabanli oturum) → `/panel` (me + uyelikler + cari listesi).
**apps/mobile (Expo 52 + Router)** — `/giris` → `/ana-sayfa` (aktif hesap karti + **hesap degistirici** + cikis), token'lar `expo-secure-store`'da.

**CI** — `.github/workflows/ci.yml`: gitleaks · lint · typecheck · unit test · migrate · **e2e (postgres service)** · build · `pnpm audit`.

**Graphify (§5)** — `uv` + `graphifyy` kuruldu, skill + `.husky/post-commit` kancasi yerinde.
Ilk grafik: **1007 dugum, 1420 kenar, 93 topluluk** (AST modu → 0 token, kural #8).

### Kararlar

1. **Tenant filtresi Prisma eklentisiyle zorlanir** (repo'da elle `where: { sellerId }` yazilmaz). Yeni tenant tablosu
   eklendiginde `TENANT_MODELS` listesine de eklenmelidir — aksi halde sessizce korumasiz kalir.
2. Tenant modellerinde **`findUnique` yerine `findFirst`** kullanilir (eklenti filtreyi where'e enjekte edebilsin diye).
3. Auth, tenant baglami olusmadan calistigi icin `TenantContext.runAsSystem()` kullanir. Bu kacis kapisi **yalniz**
   `auth.repository.ts` + seed + cron icindir.
4. Refresh token = imzali JWT, DB'de `sha256(token)` saklanir. Rotasyonda eski kayit `revoked` isaretlenir;
   revoked bir token tekrar gelirse **ailenin tamami** iptal edilir.
5. Panel httpOnly cookie, mobil SecureStore (kural #9). Login yaniti her ikisini de besler.
6. `consistent-type-imports` kurali API paketinde KAPALI — Nest DI `design:paramtypes` metadata'sina baglidir,
   `import type` DI'yi coker.
7. pnpm `nodeLinker: hoisted` — Expo/Metro izole node_modules'te gecisli bagimliliklari cozemiyor.
8. Rate limit `NODE_ENV=test` iken kapali (`ThrottlerModule.skipIf`); dev/prod'da her zaman acik.

### CLAUDE.md ile UYUSMAZLIK (§16.4 — bildiriliyor, onaysiz kural degistirilmedi)

- **§3 / §5: `docs/graph/` vault'u.** Kurulu `graphifyy` surumunde `--obsidian` / `--obsidian-dir`
  bayraklari YOK (komut sessizce yok sayiyor). Grafik aracin kanonik klasorune yaziliyor: **`graphify-out/`**
  (`graph.json`, `GRAPH_REPORT.md`, `graph.html`). `docs/graph/README.md` bunu isaret ediyor.
  → CLAUDE.md §3/§5 guncellenmeli mi, kullanici karari.
- **§2: Expo SDK.** Panel (Next 15 → React 19) ile mobil (Expo 52 → React 18) ayni hoisted
  node_modules'te iki React uretti → panel prerender'i "useContext of null" ile coktu.
  **Cozum: Expo SDK 53 + RN 0.79 + tum workspace tek React 19** (`pnpm-workspace.yaml` overrides).
  CLAUDE.md "kurulumda en guncel kararliyi kullan" dedigi icin bu kural ihlali degil, kayit amacli.

### VARSAYIM (CLAUDE.md §7'ye eklenmesi onerilir)

- `users.full_name` — §7'de yok ama kimlik gosterimi icin zorunlu.
- `users.is_platform_admin` — PLATFORM_ADMIN rolunun tasiyicisi; §7'de rol kolonu yok, uyelik de yok.
- `password_reset_tokens` tablosu — Faz 0 "sifre sifirlama" maddesi icin gerekli, §7'de listelenmemis.
- `collect_intents.statement_row_id` yerine FK `bank_statement_rows.matched_intent_id` uzerinde (1-1 geri iliski);
  Prisma'da tek tarafli FK zorunlu.
- 2FA: login'de **dogrulama** var (secret varsa kod zorunlu) + prod'da SELLER_ADMIN/PLATFORM_ADMIN icin secret yoksa
  giris engellenir. **Kurulum (enrollment) uclari Faz 5'te.**

### Bitti kriteri kontrolu (Faz 0)

- [x] Iki saticinin kullanicilariyla giris calisiyor
- [x] A → B verisine erisemiyor — **11 e2e testiyle kanitli** (liste, ID ile IDOR, ters yon, ayni satici icinde yatay yetki,
      coklu uyelikte switch sonrasi baglam degisimi, baglamsiz Prisma sorgusunun reddi)
- [x] Prisma semasi + migration + 2 saticili seed
- [x] Yanit zarfi + exception filter + Swagger
- [x] CI: lint + typecheck + test + build + gitleaks
- [x] **Graphify kurulumu** — skill + post-commit kancasi + ilk grafik (`graphify-out/`)
- [x] Mobil ve panelde login calisir

### Sonraki adim

Faz 1 — Cekirdek MVP: cari CRUD + hareket girisi + fatura/kalem + Excel import + **Gecis Sihirbazi** (§9),
mobilde Dashboard/Ekstre/Fatura detayi. (Panelde shadcn/ui kurulumu Faz 1'in ilk isi.)

---

## Sablon (her blok icin)

```
## YYYY-AA-GG · Faz N — Baslik
### Yapilan
### Karar
### VARSAYIM:
### Sonraki adim
```
