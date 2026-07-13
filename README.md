# sidereal web

Frontend and TypeScript SDK for [Sidereal](https://www.sidereal.tech), yield
tokenization on Stellar. The app drives the full protocol lifecycle (deposit,
split, trade, provide liquidity, claim, redeem) against the live mainnet
deployment, and ships the in-app documentation at `/docs`.

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

Vercel, with Root Directory set to `app`. The build runs
`pnpm --filter @sidereal/sdk build && next build` via `app/vercel.json`.
Use Node 20+.

## History note

Extracted from the original monorepo
([`PoulavBhowmick03/sidereal`](https://github.com/PoulavBhowmick03/sidereal))
at commit `3490b40` with history preserved via `git filter-repo` (commit
hashes rewritten).

## License

Apache-2.0. See [`LICENSE`](./LICENSE).
