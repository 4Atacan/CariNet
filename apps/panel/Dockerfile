# CariNet panel — Next.js (standalone).
# Derleme BURADA degil GitHub Actions'ta yapilir: uretim sunucusunda 954 MB RAM var,
# Next derlemesi tek basina bunun katini istiyor.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# TUM workspace manifestleri kopyalanir (mobil .dockerignore'da). Eksik birakilirsa
# `COPY . .` sonrasi pnpm workspace'i tutarsiz gorup KENDILIGINDEN kurulum baslatiyor;
# ilk denemelerde asilan sey buydu.
COPY apps/panel/package.json      apps/panel/
COPY apps/api/package.json        apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
# --- Docker'a ozel kurulum ayarlari -------------------------------------------
# pnpm-workspace.yaml'daki fetchTimeout=600000 x fetchRetries=5 Expo'nun buyuk
# tarball'lari icin konmus. Imaj icinde ters teper: pnpm, BASKA platformlarin
# istege bagli ikililerini (@turbo/darwin-64, @swc/core-linux-arm...) indirmeye
# calisip her birinde 10 dakikaya kadar asiliyor — ilk denemede 33 dk sessiz bekleme.
# Kurulumu bu imajin mimarisine kisitla; o paketler artik hic istenmez.
# YALNIZ supportedArchitectures eklenir — fetchTimeout/fetchRetries dosyada ZATEN var,
# ikinci kez yazilinca YAML "duplicated mapping key" verip kurulumu kiriyor.
# Yerel gelistirme etkilenmez; degisiklik yalnizca imaj icindeki kopyaya yazilir.
RUN printf '\nsupportedArchitectures:\n  os: [linux]\n  cpu: [x64]\n  libc: [glibc]\n' >> pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# COPY . . az once pnpm-workspace.yaml'i ORIJINAL haliyle geri yazdi ve mimari
# kisitini sildi; sonraki pnpm komutu tum workspace'i yeniden kurmaya kalkip
# yine baska platformlarin ikililerinde asiliyordu. Kisiti kopyadan SONRA tekrar uygula.
RUN printf '\nsupportedArchitectures:\n  os: [linux]\n  cpu: [x64]\n  libc: [glibc]\n' >> pnpm-workspace.yaml
# API adresi derleme aninda gomulur (NEXT_PUBLIC_*), calisma aninda degistirilemez.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Sentry DSN de NEXT_PUBLIC_* — derleme aninda gomulur. ARG tanimlanmazsa --build-arg
# SESSIZCE yok sayilir ve Sentry hic devreye girmez; "kurdum" denip bos kalinan hal budur.
# DSN sir DEGIL: tarayiciya giden pakette zaten yer alir, yalniz hata GONDERMEYE yarar.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_TELEMETRY_DISABLED=1
# Adimlar AYRI: birlestirildiginde hangisinin astigi gorunmuyordu (panel derlemesi iki kez
# 28 dk sifir cikti verdi). Ayri katman = ayri log + ayri onbellek.
RUN pnpm --filter @carinet/shared build
# next/font/google fontu DERLEME ANINDA indirir; agda takilirsa build sessizce bekler.
# Ust sinir koyuldu ki asilma, yerini belli eden bir hataya donussun.
RUN timeout 900 pnpm --filter panel build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Standalone cikti kendi minimal node_modules'unu icerir; static ve public ayri kopyalanir.
COPY --from=build /app/apps/panel/.next/standalone ./
COPY --from=build /app/apps/panel/.next/static     ./apps/panel/.next/static
COPY --from=build /app/apps/panel/public           ./apps/panel/public
USER node
EXPOSE 3000
CMD ["node", "apps/panel/server.js"]
