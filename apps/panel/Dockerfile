# CariNet panel — Next.js (standalone).
# Derleme BURADA degil GitHub Actions'ta yapilir: uretim sunucusunda 954 MB RAM var,
# Next derlemesi tek basina bunun katini istiyor.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/panel/package.json      apps/panel/
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
# API adresi derleme aninda gomulur (NEXT_PUBLIC_*), calisma aninda degistirilemez.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @carinet/shared build && pnpm --filter panel build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Standalone cikti kendi minimal node_modules'unu icerir; static ve public ayri kopyalanir.
COPY --from=build /app/apps/panel/.next/standalone ./
COPY --from=build /app/apps/panel/.next/static     ./apps/panel/.next/static
COPY --from=build /app/apps/panel/public           ./apps/panel/public
USER node
EXPOSE 3000
CMD ["node", "apps/panel/server.js"]
