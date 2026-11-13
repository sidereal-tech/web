# sidereal web

Frontend and TypeScript SDK for [Sidereal](https://www.sidereal.tech), yield
tokenization on Stellar. The app drives the full protocol lifecycle (deposit,
split, trade, provide liquidity, claim, redeem) against the deployment it is
configured for (testnet by default; the V1 mainnet pilot is retired), and ships the in-app documentation at `/docs`.

- Contracts repo:
  [`sidereal-tech/contracts`](https://github.com/sidereal-tech/contracts)
- Docs repo: [`sidereal-tech/docs`](https://github.com/sidereal-tech/docs)

## Layout

| Path | Contents |
|---|---|
| `app/` | Next.js app (marketing site, trading app, `/docs` site) |
| `sdk/` | `@sidereal/sdk`, the TypeScript client for the contracts |

## Develop

```bash
nvm use 20            # Node 20.x required
npm install -g pnpm

pnpm install
pnpm --filter @sidereal/sdk build
pnpm --filter @sidereal/app dev
```

Contract addresses come from `NEXT_PUBLIC_*` environment variables; see
`app/.env.example`. Without them the app builds and runs but shows a
"no market configured" banner.

## Test

```bash
pnpm --filter @sidereal/sdk run typecheck && pnpm --filter @sidereal/sdk test
pnpm --filter @sidereal/app run typecheck && pnpm --filter @sidereal/app test
```

## Deploy

The web app is deployed on Vercel with Root Directory set to `app`. The build
runs `pnpm --filter @sidereal/sdk build && next build` via `app/vercel.json`.

Access requests are handled by a small private Cloudflare Worker and stored in
Cloudflare D1. From `app/`, migrate and deploy that Worker separately:

```bash
pnpm wrangler d1 migrations apply sidereal-access-requests \
  --config ../workers/access-requests/wrangler.jsonc --remote
pnpm wrangler secret put ACCESS_REQUEST_API_TOKEN \
  --config ../workers/access-requests/wrangler.jsonc
pnpm wrangler secret put TURNSTILE_SECRET_KEY \
  --config ../workers/access-requests/wrangler.jsonc
pnpm access-worker:deploy
```

Set `TURNSTILE_SITE_KEY`, `ACCESS_REQUEST_API_URL`, and the matching
`ACCESS_REQUEST_API_TOKEN` in Vercel. The Worker-to-D1 binding and request rate
limiter are declared in `workers/access-requests/wrangler.jsonc`. For local
Worker development, copy its `.dev.vars.example` to `.dev.vars` and apply the
migration with `--local`. Use Node 20+.

The Vercel project owner must set those values in the actual Vercel account;
the Cloudflare Worker deliberately rejects missing or short shared tokens.
The database migration enforces a hard maximum of 10,000 unique access-request
records at the storage layer.

## History note

Extracted from the original monorepo
([`PoulavBhowmick03/sidereal`](https://github.com/PoulavBhowmick03/sidereal))
at commit `3490b40` with history preserved via `git filter-repo` (commit
hashes rewritten).

## License

Apache-2.0. See [`LICENSE`](./LICENSE).
