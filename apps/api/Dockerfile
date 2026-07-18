# CariNet API — NestJS + Prisma.
# Alpine DEGIL Debian slim: argon2 (kural #11 parola hashi) ve Prisma motoru musl'da
# ek ugras cikariyor; glibc tabanli imaj bu sinifi tamamen ortadan kaldiriyor.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- bagimliliklar -----------------------------------------------------------
# Once yalniz manifestler kopyalanir: kaynak degistiginde bu katman yeniden
# calismaz, kurulum onbellekten gelir.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
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

# --- derleme -----------------------------------------------------------------
FROM deps AS build
COPY . .
# Adimlar AYRI: tek RUN'da birlestirildiginde hangisinin astigi gorunmuyordu
# (ilk denemede 33 dk sifir cikti). Ayri katman = ayri log + ayri onbellek.
RUN pnpm --filter @carinet/shared build
# Prisma motorlarini indirirken sessizce bekleyebiliyor → gorunur log + ust sinir.
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN timeout 600 pnpm --filter api exec prisma generate
RUN timeout 900 pnpm --filter api build

# --- calisma -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# node_modules budanmadan tasiniyor. pnpm workspace + hoisted linker'da uretim
# budamasi Prisma'nin uretilmis istemcisini (node_modules/.prisma) koparabiliyor;
# 48 GB diskte birkac yuz MB'lik fazlalik, sessizce bozulan bir imajdan iyidir.
COPY --from=build /app/node_modules          ./node_modules
COPY --from=build /app/packages/shared/dist  ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/dist         ./apps/api/dist
COPY --from=build /app/apps/api/prisma       ./apps/api/prisma
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/

# §11.4 — konteyner root olarak calismaz.
USER node
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
