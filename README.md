# GitHat Web2 starter

A small Next.js app that already does the three things most products need:

| | Where | |
|---|---|---|
| **Sign in with Google** | `lib/google.ts`, `lib/auth.ts`, `app/api/auth/*` | No SDK, no database: a signed session cookie |
| **Card payments** | `components/sebastn-pay.tsx` | Through SebasTN, to your own Stripe account. You write no payment code |
| **Pay per call (x402)** | `lib/x402.ts`, `lib/payments.ts`, `app/api/x402/hello` | An agent or any x402 client pays USDC per request; checked and settled for real |

MIT licensed: you own every line. Made by [GitHat](https://githat.io).

## Set it up in four steps

```bash
npm install
cp .env.example .env.local
```

1. **Sessions.** Set `SESSION_SECRET` to a long random string: `openssl rand -hex 32`.
2. **Google sign-in.** In Google Cloud, create an OAuth client (Web application), add
   `http://localhost:3000/api/auth/google/callback` (and your site's address + the same path) to its redirect URIs,
   and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. **Card payments.** At [sebastn.com](https://sebastn.com), connect Stripe and copy your merchant id into
   `NEXT_PUBLIC_SEBASTN_MERCHANT`. Every fee is published there.
4. **Pay per call.** Set `X402_PAY_TO` to your wallet's public address (never a private key).

```bash
npm run dev                                   # http://localhost:3000
curl -i http://localhost:3000/api/x402/hello  # 402 + what to pay
npm run check                                 # types + tests
```

## Add your own

- A paid API route: copy `app/api/x402/hello/route.ts` and change the price.
- A paid button: `<SebastnPay amount="29.00" label="Buy" />`, or `mode="subscription"` for monthly plans.
- A page only for signed-in people: `const user = await currentUser()` (see `app/page.tsx`).

## Deploy

Any Node host runs it (`npm run build && npm start`). To deploy to your own Cloudflare account from GitHub, set the
repository variable `DEPLOY_TARGET=cloudflare` and the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then
push to `main` (`.github/workflows/deploy.yml`).

## Good to know

- x402 runs on **Base Sepolia, a test network**. Going to mainnet is a deliberate edit in `lib/x402.ts`.
- Never commit `.env.local` or any key. `X402_PAY_TO` is a public address.
