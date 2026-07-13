# Kod bilgi grafigi (Graphify)

**Grafik ciktilarinin gercek yeri: repo kokundeki `graphify-out/`.**

CLAUDE.md §3/§5 bu klasoru (`docs/graph/`) Obsidian vault'u olarak tarif eder; ancak kurulu
`graphifyy` surumunde `--obsidian` / `--obsidian-dir` bayraklari **artik yok** (komut bunlari sessizce
yok sayiyor). Bu yuzden grafik, aracin kanonik cikti klasorune yaziliyor:

| Dosya                          | Nedir                                                   |
| ------------------------------ | ------------------------------------------------------- |
| `graphify-out/graph.json`      | Bilgi grafigi (dugumler + kenarlar) — sorgulanan kaynak |
| `graphify-out/GRAPH_REPORT.md` | Topluluk raporu (markdown)                              |
| `graphify-out/graph.html`      | Etkilesimli gorsellestirme (tarayicida ac)              |
| `graphify-out/cache/`          | Onbellek — commit'lenmez                                |

## Kullanim (§5)

```bash
graphify . --code-only --update      # grafigi tazele (AST modu → 0 token)
graphify explain "AuthService"       # bir dugumu ve komsulari acikla
graphify path "AuthController" "PrismaService"   # iki dugum arasi yol
```

Obsidian ile gormek isterseniz `graphify-out/` klasorunu vault olarak acabilirsiniz
(`GRAPH_REPORT.md` markdown'dir). Otomatik guncelleme `.husky/post-commit` kancasiyla yapilir.

> Not: `--mode deep` (LLM'li semantik kenar) ucretli cagridir → kural #8: yalniz kullanici onayiyla.
