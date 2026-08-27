# Keyafe

A homegrown e-commerce platform for **Keyafe Bakes** — a boutique bakery in Kolkata that sells celebration cakes, dry cakes and tubs, pizzas, panuozzo, focaccia sandwiches and other snacks.

The stack is a pnpm monorepo with three apps talking to a shared Postgres database.

---

## What's inside

| Package                                    | Purpose                                   | Dev port                        |
| ------------------------------------------ | ----------------------------------------- | ------------------------------- |
| [`client/`](client)                        | Customer-facing storefront (Vite + React) | `5173`                          |
| [`server/`](server)                        | API + admin backend (Express + Prisma)    | `4000`                          |
| [`admin/`](admin)                          | Admin console (Vite + React)              | `5175`                          |
| [`docker-compose.yml`](docker-compose.yml) | Postgres 16 + Adminer for local dev       | Postgres `5432`, Adminer `8081` |

---

## What it does

**Storefront** ([`client/`](client))

- Category-aware browsing — cakes, pizzas, panuozzo, focaccia, tubs, snacks
- **Cakes** — flavour picker, pounds slider (uses the `CakeSize` master list), message-on-cake, custom-pounds override
- **Pizzas / other configurable items** — size picker with per-size pricing, crust picker, multi-select toppings + condiments
- Pincode-based delivery-fee lookup + pickup option
- Date + time-slot picker with per-slot surcharges (midnight slot etc.)
- Guest checkout (email optional) — no login required
- Order confirmation emails via SMTP (Gmail-friendly)

**Admin console** ([`admin/`](admin))

- **Products** — one form drives every category; a `template` (Cake / Pizza / Other) toggle swaps in the right fields
  - Cake: flavours, pound bounds, message-on-cake support
  - Pizza: sizes (inch + absolute price), crust options (`+₹` deltas), toppings & condiments master-list pickers
  - Other: generic variants list with per-variant absolute prices
- **Categories, flavours, cake sizes, toppings & condiments** master-list CRUD
- **Orders** — status board, filtering, detail view, admin/customer note fields
- **Offline orders** — for phone/WhatsApp customers who don't self-serve. Two modes:
  - _"Send link to customer"_ — admin pre-fills the cake spec + price, customer opens a token URL (`/o/:token`) and adds their own contact + address
  - _"Enter full details"_ — admin fills everything (multi-item bill, customer, address, date/slot); order is placed straight away
- Image uploads (product photos, custom-cake reference images) — local disk today, swappable storage provider baked in

**API** ([`server/`](server))

- Express + Prisma over Postgres
- Multi-file Prisma schema under [`server/prisma/schema/`](server/prisma/schema)
- GST split (CGST + SGST intra-state, IGST otherwise) computed at order-place time
- Order-link tokens generated with `nanoid` (URL-safe alphabet, 8 chars)
- SMTP dispatch via `nodemailer` (falls back to logging when SMTP creds absent)

---

## Getting started

### Prerequisites

- **Node.js 20+**
- **pnpm 9** (`corepack enable` or `npm i -g pnpm`)
- **Docker** (for the Postgres container)

### First-time setup

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start Postgres + Adminer
pnpm db:up

# 3. Configure the server env
cp server/.env.example server/.env
#   (defaults work with docker-compose; only edit if you change ports or add SMTP)

# 4. Apply migrations + generate the Prisma client
pnpm --filter server prisma migrate dev

# 5. (Optional) seed reference data — categories, flavours, cake sizes, sample products
pnpm --filter server prisma db seed
```

### Run all three apps

```bash
pnpm dev
```

Or start each individually in its own terminal:

```bash
pnpm dev:server   # http://localhost:4000
pnpm dev:client   # http://localhost:5173
pnpm dev:admin    # http://localhost:5175
```

Once everything is up:

- **Storefront** → <http://localhost:5173>
- **Admin console** → <http://localhost:5175>
- **API health** → <http://localhost:4000/api/health>
- **Adminer (SQL UI)** → <http://localhost:8081> · server `postgres`, user `keyafe`, password `keyafeDevPass`, db `keyafe`

---

## Common tasks

### Database

```bash
pnpm db:up                             # start Postgres + Adminer
pnpm db:down                           # stop containers
pnpm db:reset                          # ⚠️ wipe volume + start fresh
pnpm db:logs                           # tail postgres logs

pnpm --filter server prisma migrate dev --name <name>   # new migration
pnpm --filter server prisma studio                      # visual DB browser
pnpm --filter server prisma db seed                     # re-seed
```

### Type-checking

```bash
pnpm --filter server exec tsc --noEmit
pnpm --filter client exec tsc -b
pnpm --filter admin  exec tsc -b
```

### Builds

```bash
pnpm build          # builds every package
```

### SMTP (order emails)

Add these to `server/.env` to actually send emails. Without them, `sendEmail()` logs the message instead of dispatching.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youraddress@gmail.com
SMTP_PASS=your-app-password        # Gmail: generate from Google Account → Security → App passwords
SUPPORT_EMAIL=support@keyafe.in    # shown in customer-visible replies
ORDER_NOTIFICATION_EMAIL=orders@keyafe.in
```

---

## Project layout

```
keyafe2026/
├── client/          # customer storefront (Vite + React 19 + Tailwind v4)
├── admin/           # admin console (Vite + React 19 + Tailwind v4)
├── server/          # Express API + Prisma
│   ├── prisma/
│   │   ├── schema/  # multi-file schema (product, orders, taxonomy, ...)
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── modules/ # one folder per domain (products, orders, order-links, ...)
│       ├── config/  # env + prisma client
│       └── lib/     # storage adapters (local disk today)
├── docs/            # PRD + command reference
├── docker-compose.yml
└── pnpm-workspace.yaml
```

Every module under `server/src/modules/` follows the same shape:

- `<module>.routes.ts` (or `.admin.routes.ts` / `.public.routes.ts`) — Express handlers
- `<module>.service.ts` — Zod schemas, DB access, business logic

---

## Data model highlights

- **`Product.template`** (`CAKE` / `PIZZA` / `OTHER`) drives which admin form sections and PDP renderers are used.
- **`OptionGroup` + `Option`** — generic variant model. Each `OptionGroup` has a `priceMode`:
  - `ABSOLUTE` (e.g. pizza sizes) — the `Option.price` replaces `basePrice`
  - `DELTA` (e.g. crust choice) — the `Option.price` is added on top
- **`Topping`** — shared master list, `kind` distinguishes toppings from condiments/extras. Linked to a product via `Product.toppings` (M2M).
- **`CakeSize` + `Flavor.additionalAmount`** — cakes stay multiplicative: `price = (basePrice + flavourDelta) × (grams / 500)`.
- **`OrderLink`** — the "offline order via WhatsApp link" flow. Admin snapshots the spec + price, customer redeems the token to place a real `Order`.

---

## Tech snapshot

| Layer            | What we use                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| Language         | TypeScript everywhere (server + both fronts)                            |
| API              | Express 4, Zod for validation, `express-async-errors`, Helmet, CORS     |
| DB / ORM         | Postgres 16, Prisma 5.22 (multi-file schema preview feature)            |
| Storefront/Admin | React 19, Vite 8, Tailwind v4, TanStack Query, Zustand, react-hook-form |
| Email            | Nodemailer (Gmail SMTP works out of the box)                            |
| Uploads          | Local disk today; provider interface ready for R2 / S3 / Cloudinary     |
| Logging          | Pino + pino-http                                                        |
| Package manager  | pnpm workspaces                                                         |

---

## Roadmap (short)

- [ ] Auth for admin routes (currently gated by TODO comments)
- [ ] Payment split UI on offline orders — advance + balance tracking
- [ ] Razorpay integration for online payments
- [ ] Quote-request inbox (custom-cake enquiries from the storefront)
- [ ] Same-day store hours + surge windows
