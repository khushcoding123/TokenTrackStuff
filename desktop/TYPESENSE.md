# Typesense (Project Intelligence)

Optional search layer for the Metriq desktop app. Improves file discovery for
prompt rewrites, powers “Similar previous tasks,” usage session discovery, and
Cmd/Ctrl+K global search. The offline scanner in `packages/core` remains the
fallback whenever Typesense is off or unreachable.

## Recommended: local Typesense

```bash
# Docker (Windows Git Bash may need MSYS_NO_PATHCONV=1)
docker run -p 8108:8108 -v metriq-ts-data:/data \
  typesense/typesense:27.1 --data-dir=/data --api-key=metriq-local
```

Defaults (env or Settings → Project Intelligence):

| Variable | Default |
| --- | --- |
| `TYPESENSE_MODE` | `local` (`off` \| `local` \| `cloud`) |
| `TYPESENSE_HOST` | `localhost` |
| `TYPESENSE_PORT` | `8108` |
| `TYPESENSE_PROTOCOL` | `http` |
| `TYPESENSE_API_KEY` | `metriq-local` |
| `TYPESENSE_HYBRID` | unset / off — set `true` for conceptual query expansion |

The API key is resolved in the Electron **main** process only (env or
`safeStorage`-encrypted prefs). It is never exposed through `preload.js`.

## Privacy

- **Local mode:** full source chunks indexed on your machine (recommended).
- **Cloud mode:** metadata-only (paths, symbols, prompt/usage metrics) unless
  you explicitly check the cloud source-code consent box in Settings.
- Cloud indexing of source code is never silent.
- Usage session docs include project names, models, token metrics, and short
  prompt snippets from local logs — never uploaded unless Typesense itself is
  a cloud host you configured.

## Collections

| Collection | Phase | Purpose |
| --- | --- | --- |
| `metriq_code_chunks` | 2–3, 7 | Project source chunks + hybrid expansion |
| `metriq_prompt_runs` | 4 | Completed analyses / similar tasks |
| `metriq_usage_sessions` | 5 | Searchable usage sessions (discovery only) |

## Features

1. **Prompt Studio + capture window** — Typesense → scanner → rewrite.
2. **Similar previous tasks** — Prompt Studio.
3. **Usage search** — natural language (“expensive auth”, “low cache”) ranks sessions via Typesense, with local substring fallback.
4. **Cmd/Ctrl+K** — federated search across Code / Previous prompts / Usage.
5. **Conceptual search (Phase 7)** — Settings toggle expands vague prompts with synonyms. Not vector embeddings; keyword search remains primary.

## Tests

```bash
cd desktop
npm test

# Live integration tests skip automatically without a server; with Docker up
# they exercise import/search/isolation/incremental indexing.
```

## Manual check

1. Start Typesense (above).
2. `cd desktop && npm start`
3. Link a project → Settings shows Connected + chunk counts (or click Reindex).
4. Prompt Studio / capture: vague prompt → relevant files via Project Intelligence.
5. Open Usage → search “expensive” or “low cache”.
6. Press Cmd/Ctrl+K → search across code, prompts, usage.
7. Enable Conceptual search → try “screen that shows how many tokens were consumed”.
8. Stop Typesense → analysis still works via local scan.
