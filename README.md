# IK Software Claude Code Plugin'leri

Bu depo bir Claude Code marketplace'idir ve şu plugin'i içerir:

- **[model-router](model-router/README.md):** kodlama isteklerini boyut ve etki alanına göre Haiku, Sonnet, Opus veya Fable alt ajanına otomatik yönlendirir.

## Kurulum

Claude Code içinde:

```
/plugin marketplace add <github-kullanıcı-adı>/<repo-adı>
/plugin install model-router@ik-software-plugins
```

Ya da kabuktan:

```
claude plugin marketplace add <github-kullanıcı-adı>/<repo-adı>
claude plugin install model-router@ik-software-plugins
```

Gereksinim: PATH üzerinde Node.js (ayrıntı: [model-router/README.md](model-router/README.md)).

## Yerelde deneme (yayınlamadan)

```
claude --plugin-dir ./model-router
```
