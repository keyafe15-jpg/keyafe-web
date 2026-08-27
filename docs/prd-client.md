# Keyafe — Client-Facing Application PRD

|                  |                                                                  |
| ---------------- | ---------------------------------------------------------------- |
| **Product**      | Keyafe (customer-facing ecommerce)                               |
| **Version**      | 0.1 (draft)                                                      |
| **Date**         | 2026-08-24                                                       |
| **Status**       | Draft — pending stakeholder review                               |
| **Scope**        | Customer-facing web application only                             |
| **Out of scope** | Admin panel (separate PRD), kitchen management, delivery routing |

---

## 1. Overview

Keyafe is a handcrafted bakery based in India, currently receiving 30–40 orders per month, predominantly via WhatsApp and phone. This document describes v1 of the customer-facing web application: a mobile-first storefront that lets customers browse the catalogue, customize celebration cakes, place orders with online payment, and receive automated confirmations — with GST-compliant invoicing.

The admin/back-office application (order management, inventory, offline order entry, product CRUD, dashboards) is a separate deliverable covered in a companion PRD.

## 2. Goals

1. Give Keyafe a first-class online storefront that matches the quality of the product.
2. Reduce time spent by the owner manually taking orders over WhatsApp for standard SKUs.
3. Enable **celebration cake customization** (flavor, size, tiers, fondant, on-cake message, delivery slot) at self-serve.
4. Enable **seamless guest checkout** — logging in must never be a prerequisite for buying.
5. Enable **online payment** via Razorpay with GST-compliant invoicing.
6. Automate **order confirmations** via email and WhatsApp.
7. Support **coupons/discount codes** as a marketing lever.
8. Stay **cloud-agnostic** — no lock-in to AWS/Azure/GCP-managed services beyond what the payment/notification/CDN vendors require.

### Non-goals (v1)

- Native mobile app (progressive web / responsive web is sufficient).
- Multi-vendor / marketplace behavior.
- Recurring subscriptions.
- Live chat, help desk integration, or customer support tooling.
- Loyalty points, gift cards, referrals.
- International orders / multi-currency.
- Personalized product recommendations / ML features.

## 3. Personas

| Persona                  | Profile                                                                       | Primary need                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Ria — Occasion Buyer** | 28, urban, orders 2–3 celebration cakes/year for birthdays and anniversaries. | Wants to customize flavor/size/message on mobile in under 3 minutes, pay online, and be told when the cake arrives. |
| **Anil — Regular**       | 45, orders dry cakes and snacks weekly for the family.                        | Wants a fast reorder path, doesn't want to re-enter address every time.                                             |
| **Priya — Office Buyer** | Admin at a corporate office, orders large snack platters for events.          | Needs a GST invoice with the company's GSTIN for input tax credit; wants clear delivery slot.                       |

## 4. Functional requirements

Requirements are grouped by feature area. Each item has an acceptance-criteria style checklist.

### 4.1 Discovery / Home

- [ ] Prominent hero with brand messaging + primary CTA ("Order a cake").
- [ ] Category tiles for all top-level categories: Celebration Cakes, Dry Cakes, Cake & Cookie Tubs, Pizzas, House Snacks.
- [ ] "Same-day delivery available" strip visible above the fold.
- [ ] Featured / bestseller products section.
- [ ] Footer with contact info, address, social links.
- [ ] Simple full-page search may be added later — deferred out of v1.

### 4.2 Category listing

- [ ] Products in the selected category displayed as a grid.
- [ ] Filters (applies for Celebration Cakes primarily): flavor, size (weight in lb / kg), tier count, fondant y/n, price range.
- [ ] Sort: featured (default), price asc, price desc, newest.
- [ ] Empty and out-of-stock states rendered gracefully.
- [ ] URL reflects filter/sort state (shareable + bookmarkable).

### 4.3 Product detail

- [ ] Multi-image gallery with pinch-zoom on mobile.
- [ ] Product name, description, base price (GST-inclusive).
- [ ] **Variant selector** — flavor, size/weight, tier count, fondant option. Selection updates the price displayed.
- [ ] **"Message on cake"** free-text input with character limit (e.g., 40 chars) for products that support it.
- [ ] **Delivery date picker** — restricted by product `leadTimeHours`.
- [ ] **Delivery time slot picker** — morning / afternoon / evening (capacity-limited in a later phase).
- [ ] Quantity selector.
- [ ] "Add to cart" primary CTA.
- [ ] Same-day delivery indicator when eligible.
- [ ] Structured data (JSON-LD `Product` schema) for SEO.

### 4.4 Cart

- [ ] Line items list showing product name, thumbnail, variant summary, message-on-cake, delivery slot, quantity, unit price, line total.
- [ ] Edit quantity, remove line, or change delivery slot inline.
- [ ] **Coupon code input** with apply/remove.
- [ ] Price summary: subtotal, discount, estimated GST, total.
- [ ] "Continue to checkout" CTA.
- [ ] Cart persists across sessions on the same browser (localStorage).
- [ ] Cart merges gracefully if a user logs in mid-session.

### 4.5 Checkout

- [ ] Single-page checkout — no multi-step wizard for v1.
- [ ] **Guest checkout is the default** — no login prompt.
- [ ] Optional "Log in / Sign up" toggle.
- [ ] Delivery address form: name, phone (validated), email, address line 1/2, city, state (dropdown), pincode (validated).
- [ ] **B2B**: optional "Add company GSTIN" toggle — collects `customerGstin` for invoice.
- [ ] Server-computed order summary — subtotal, discount, CGST/SGST or IGST breakdown, roundoff, grand total. Client never computes tax.
- [ ] Coupon re-validation before payment (in case it expired between cart and checkout).
- [ ] "Place Order" triggers Razorpay checkout.

### 4.6 Payment

- [ ] Razorpay checkout opened with server-created `order_id`.
- [ ] Server verifies Razorpay signature before marking the order paid.
- [ ] On success: order recorded, invoice number assigned, redirect to `/order/:id/success`.
- [ ] On failure/cancellation: return to cart with items intact and an informative message.
- [ ] Payment amount is always the server-recomputed total; client-side amount is ignored.
- [ ] Idempotent — retrying payment for the same cart never creates duplicate orders.

### 4.7 Order confirmation & notifications

- [ ] `/order/:id/success` page shows order number, invoice number, delivery slot, itemized summary, "Download invoice" button.
- [ ] **Email** confirmation to the customer (branded HTML).
- [ ] **WhatsApp** confirmation via approved template on Meta WhatsApp Cloud API.
- [ ] Notifications are fire-and-forget from the request path; failures are queued for retry (a `notifications` table, retried by a worker).
- [ ] Owner receives an internal notification for every new paid order (email at minimum, WhatsApp if configured).

### 4.8 Guest order lookup

- [ ] Public route `/order/track` — enter order number + phone (last 4 digits) to view status and download invoice.
- [ ] No login required.

### 4.9 Optional account features (v1 nice-to-have)

- [ ] Register with email + password (bcrypt-hashed).
- [ ] Login, logout, refresh.
- [ ] `/account` page: profile, saved addresses, order history.
- [ ] Address book is auto-populated when a guest checks out repeatedly with the same email/phone (linked on next login).

### 4.10 Content / static pages

- [ ] About Us, Contact, Delivery & Returns, Privacy Policy, Terms of Service.
- [ ] These are the minimum required for Razorpay account activation and GST compliance.

## 5. Non-functional requirements

| Area                | Requirement                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Performance**     | LCP ≤ 2.5s on a 4G connection; total JS ≤ 200 KB gzipped for the storefront critical path.                                                                                                           |
| **Mobile-first**    | Fully usable at 360×640 viewport. Design at 375px baseline.                                                                                                                                          |
| **Accessibility**   | WCAG 2.1 AA on public pages: color contrast, keyboard nav, labeled inputs, semantic HTML.                                                                                                            |
| **Browser support** | Latest 2 versions of Chrome, Safari, Edge, Firefox; Safari iOS 15+; Chrome Android 100+.                                                                                                             |
| **Security**        | HTTPS everywhere, HTTP-only cookies for sessions, CSRF-safe design (SameSite=Lax), Helmet defaults, OWASP Top 10 baseline. PCI handled by Razorpay — we never see card data.                         |
| **Data protection** | Passwords: bcrypt (cost 12+). Personal data (name, phone, address) stored plaintext in DB but on an encrypted volume; access restricted to server and admin only. Payment refs stored as opaque IDs. |
| **SEO**             | Server-safe URLs (client-side routing is fine; ensure canonical tags). Meta titles/descriptions per page. `Product` JSON-LD. Sitemap.                                                                |
| **Availability**    | v1: single VPS, ~99% target. No formal SLA. Backups: daily `pg_dump` retained 30 days.                                                                                                               |
| **Observability**   | Structured JSON logs (Pino) on the server. Basic request logs. Error logs monitored via VPS console for v1. Sentry can be added later.                                                               |

## 6. Technical decisions & rationale

### 6.1 Frontend: **Vite + React 19 + TypeScript + Tailwind CSS v4**

- **React** — team familiarity, best ecosystem for the customization UI (variant selectors, cart, checkout are stateful and benefit from React's model).
- **Vite** over Next.js — v1 doesn't need SSR/ISR. A bakery ecom with 30–40 orders/mo has no SEO scale to justify SSR complexity. Vite + client-side routing keeps deployment trivially simple (static files). We can migrate to Next.js later if SEO/social-share previews demand it.
- **TypeScript** — payment code touches money. Type safety is non-negotiable.
- **Tailwind v4** over Bootstrap — the product needs a warm, editorial, food-photography-driven look. Bootstrap steers designs toward corporate uniformity; Tailwind gives design freedom without CSS-organization overhead. Tailwind v4's `@theme` block makes brand tokens a single source of truth.
- **shadcn/ui** (deferred) — will be adopted when we need form controls, modals, and toasts. Component code lives in our repo, no runtime dependency.

### 6.2 State management: **Zustand (client) + TanStack Query (server state)**

- Redux is overkill for this app. Zustand handles the cart and any global UI state with ~20 lines.
- TanStack Query handles caching, background refresh, and mutation states for all API-driven data (products, categories, order status).

### 6.3 Forms & validation: **react-hook-form + zod**

- Checkout is the most complex form and must validate cleanly on mobile.
- `zod` schemas are **shared between client and server** (same source of truth for phone/pincode/GSTIN rules).

### 6.4 Backend: **Node.js + Express + TypeScript + ESM**

- **Express** — the team knows it, the ecosystem is mature. Fastify or Hono would be marginally faster and have better types, but Express has more community answers for Indian-specific integrations (Razorpay, GST HSN lookups).
- **TypeScript + ESM** end-to-end. Matches client. `.js` extensions in imports for NodeNext resolution.
- **Feature-based module structure** (`modules/products/…`) instead of layer-based (`routes/`, `controllers/`, `models/`). Everything for one resource lives together; better navigation as the codebase grows.

### 6.5 Database: **PostgreSQL 16 + Prisma**

- **Postgres over MongoDB.** Ecommerce with GST, inventory, coupons, and invoices is fundamentally relational and financial. Postgres wins for:
  - Multi-row transactions (order + stock decrement + coupon usage + invoice counter — all atomic).
  - Exact decimal money (`NUMERIC(12,2)`).
  - Sequences for gap-free invoice numbering — a GST compliance requirement.
  - SQL reporting for monthly GSTR-1 filing (aggregate revenue by GST rate).
  - Referential integrity for coupon-order and address-customer relationships.
- Mongo was the initial choice but was reconsidered. Migration was done at zero cost while no models existed.
- **Prisma** over Drizzle/TypeORM — best-in-class generated TypeScript types, readable schema DSL, first-class migrations, and Prisma Studio as a free DB GUI.
- Local dev uses **Docker Compose** (Postgres 16 + Adminer) so no `brew install` is required and dev/prod parity is maintained.

### 6.6 Payments: **Razorpay**

- The dominant PG in India with the best UPI/netbanking coverage and the cleanest KYC flow for small businesses.
- Uses the standard **Orders API + signature verification** pattern:
  1. Client asks server to create an order → server creates Razorpay order with the _recomputed_ amount.
  2. Client opens Razorpay checkout with the returned `order_id`.
  3. On success callback, client sends `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` to server.
  4. Server verifies the HMAC signature and only then persists the `Order` as paid.
- Client-supplied amounts are never trusted.

### 6.7 Images / assets: **Cloudinary**

- Free tier is generous (25 credits ≈ 25 GB storage + bandwidth).
- Automatic responsive `srcset`, format negotiation (AVIF/WebP), on-the-fly transformations.
- Uploads are done by admin via signed upload widget — the API server never processes bytes.

### 6.8 Notifications

- **Email**: Nodemailer over SMTP (Zoho Mail free tier initially; Resend when volume grows).
- **WhatsApp**: Meta WhatsApp Cloud API directly. Free for first 1,000 conversations/month. Requires business verification and pre-approved templates.
- Notifications are async: an internal `notifications` table records intent + status; a worker retries failed sends. This keeps the checkout response fast and lets us report on delivery rates.

### 6.9 Auth (customer-side)

- Custom **JWT-based** auth: access token (short-lived, ~15 min) + refresh token (7 days, rotated on use). Both stored in HTTP-only, `SameSite=Lax` cookies.
- Passwords hashed with **bcrypt** at cost factor 12.
- Guest checkout remains fully supported — auth is opt-in.
- No third-party identity providers in v1.

### 6.10 Hosting (planned for launch)

- **Single VPS in Bangalore** (Hostinger KVM 2 ₹799/mo, or DigitalOcean $12 droplet).
- Runs API, Postgres (Docker), Nginx (reverse proxy + TLS via Certbot), and serves the built client as static files.
- Daily `pg_dump` to Cloudinary or DO Spaces for offsite backup.
- This is right-sized for the current 30–40 orders/mo volume with 20–100× headroom for growth.
- **Not on Atlas / RDS / managed Mongo** — matches the "no cloud lock-in" constraint and keeps monthly cost under ₹1,000.
- Migration path: when traffic warrants, move Postgres to a managed offering (DO Managed Postgres from ~$15/mo) and keep the API on the VPS.

### 6.11 Repo / tooling

- **pnpm workspace monorepo** — `client/`, `server/`. Shared root scripts. Faster and more disk-efficient than npm.
- `oxlint` on the client (installed by Vite scaffold) — very fast; we'll add ESLint on the server if needed.
- Prettier is not configured yet — VS Code default formatter is in use.

## 7. Data model overview (client-facing scope)

High-level entities the storefront depends on. Full schemas defined in `server/prisma/schema.prisma` during Phase 3.

- **Category** — slug, name, description, image, sort order.
- **Product** — slug, name, description, category, base price (GST inclusive), images[], `stockMode` (`made_to_order` | `batch` | `unlimited`), stock, GST rate, HSN code, `supportsMessageOnCake`, `supportsSameDayDelivery`, `leadTimeHours`.
- **ProductVariant** — belongs to Product; label, flavor, size, tier, fondant, price delta.
- **Coupon** — code, discount type (percent / flat), value, min cart, product/category applicability, per-customer usage limit, active window.
- **Customer** — email, phone, password hash (nullable for guest-turned-account).
- **Address** — belongs to Customer; name, phone, line1, line2, city, state, stateCode, pincode.
- **Order** — customer or guest snapshot, source (`web` | `admin`), lines, delivery slot, coupon usage, tax breakdown, invoice number, payment method, payment status, notifications sent.
- **BusinessSettings** — singleton; GSTIN, legal name, registered address, GST scheme, invoice prefix, financial-year start.

## 8. API surface (client-facing)

Grouped by domain. All routes prefixed with `/api`.

### Catalog (public, read-only)

- `GET /categories`
- `GET /products?category=&flavor=&size=&sort=`
- `GET /products/:slug`

### Cart / quote (public)

- `POST /orders/quote` — server recomputes totals from cart + coupon
- `POST /coupons/validate`

### Checkout & payments

- `POST /orders` — create pending order + Razorpay order
- `POST /payments/razorpay/verify` — verify signature, finalize order, assign invoice number, trigger notifications

### Order tracking (public)

- `GET /orders/lookup?number=&phoneLast4=`
- `GET /orders/:id/invoice` (PDF)

### Customer auth (optional)

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Customer account (authenticated)

- `GET /me/orders`
- `GET /me/addresses`
- `POST /me/addresses`
- `DELETE /me/addresses/:id`

## 9. Key user flows

### 9.1 Order a celebration cake (happy path)

1. Ria lands on the home page from an Instagram link.
2. Taps "Order a cake" → celebration cakes listing.
3. Filters by flavor: chocolate.
4. Opens a product → picks 1 lb, adds message "Happy Birthday Aarav", picks delivery date (tomorrow evening slot).
5. Adds to cart → cart drawer shows summary.
6. Continues to checkout → fills guest form.
7. Enters coupon `BDAY10` — 10% off applied. Sees GST breakdown.
8. Places order → Razorpay checkout opens → pays via UPI.
9. Redirects to success page. Order number: `KEY/25-26/0042`.
10. Receives WhatsApp + email confirmation within 30 seconds.

### 9.2 Guest checkout with coupon

Covered above; the flow works without any account creation.

### 9.3 Payment failure recovery

1. Payment fails (e.g., insufficient funds).
2. Razorpay returns to callback → server marks order as `payment_failed`.
3. Client returns to `/checkout` with cart intact and an inline message.
4. Ria retries with a different payment method; a new Razorpay order is created but the same internal cart is preserved.

## 10. Out of scope (v1)

- Admin panel — separate PRD.
- Kitchen ticket printing / production planning.
- Delivery routing / rider assignment.
- SMS notifications (WhatsApp covers this).
- Analytics dashboards for customers (order history is enough).
- Product reviews and ratings.
- Wishlist / favorites.
- Real-time order tracking map.

## 11. Open questions

These need input from the business before or during Phase 3:

1. **Brand** — logo files, color palette, typography preference. Current tokens (cream / blush / cocoa) are placeholders.
2. **GST** — do you have a GSTIN? Composite vs regular scheme? Default rate (5% assumed for bakery items — confirm)?
3. **HSN codes** — the CA's recommendation per product category.
4. **Prices in UI** — inclusive vs exclusive of GST (assumed inclusive).
5. **Delivery zones** — which pincodes do we serve? Do we charge delivery? Free above some threshold?
6. **Delivery slots** — how many concurrent orders per slot can the kitchen handle?
7. **Same-day cutoff** — what time is the last cut-off for same-day delivery?
8. **Which products are `batch`** (baked daily, tracked) vs `made_to_order` vs `unlimited`?
9. **B2B invoicing** — needed at launch or later?
10. **Content pages** — who writes copy for About, Delivery & Returns, Privacy, Terms?

## 12. Phased delivery plan

| Phase   | Deliverable                                                                                                        | Status     |
| ------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| **0**   | pnpm monorepo, Vite/React/TS/Tailwind scaffold, Express/TS/Prisma scaffold, Docker Compose Postgres, `/api/health` | ✅ Done    |
| **1**   | Static client shell — routing, layout, brand tokens, placeholder pages                                             | ✅ Done    |
| **2**   | Cart flow (with mock data) — persist, coupon field, checkout form UI                                               | ⏳ Pending |
| **3**   | Domain models (Category, Product, Coupon, BusinessSettings) + public read endpoints + seed data                    | ⏳ Pending |
| **3.5** | Customer auth (JWT + bcrypt)                                                                                       | ⏳ Pending |
| **4**   | Wire client public pages to real API                                                                               | ⏳ Pending |
| **5**   | Order model (with tax breakdown, stock movements, invoice counter) + Razorpay create/verify + notifications        | ⏳ Pending |
| **6**   | Guest order tracking + invoice PDF                                                                                 | ⏳ Pending |
| **7**   | SEO polish, perf pass, accessibility pass, content pages                                                           | ⏳ Pending |
| **8**   | Containerize server, deploy to VPS, TLS, backups                                                                   | ⏳ Pending |

Admin panel work begins after Phase 5 in parallel with Phase 6.

## 13. Risks & mitigations

| Risk                                                 | Likelihood | Impact                                     | Mitigation                                                                                            |
| ---------------------------------------------------- | ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| WhatsApp template approval delay from Meta           | Medium     | Order confirmations can't go over WhatsApp | Start business verification in Phase 5, launch with email-only if delayed                             |
| Razorpay KYC delay                                   | Medium     | Can't accept payments                      | Start KYC before Phase 5; test mode covers development                                                |
| GST rules / rates change or CA advises different HSN | High       | Rework of tax logic                        | Business settings + per-product tax fields are configurable at runtime; no code deploy needed         |
| Single VPS goes down                                 | Low-Med    | Full outage                                | Daily off-box backups; documented restore procedure; keep Atlas M0 as an emergency read-only fallback |
| Fraud / disputed payments                            | Low        | Chargebacks                                | Razorpay handles fraud checks; retain audit logs of every payment webhook                             |
| Oversell of batch-tracked items                      | Med        | Refunds, customer disappointment           | Stock decrement inside DB transaction with order creation; unique constraints prevent race conditions |

## 14. Success metrics (30/60/90 days post-launch)

| Metric                                           | Target (Day 30) | Target (Day 60) | Target (Day 90) |
| ------------------------------------------------ | --------------- | --------------- | --------------- |
| % of monthly orders placed via web (vs WhatsApp) | 20%             | 35%             | 50%             |
| Cart-to-payment conversion                       | 25%             | 35%             | 40%             |
| Order confirmation email delivery rate           | 95%             | 97%             | 98%             |
| WhatsApp notification delivery rate              | 90%             | 95%             | 97%             |
| Time from cart open to placed order (median)     | ≤ 4 min         | ≤ 3 min         | ≤ 3 min         |
| Payment reconciliation mismatches                | 0               | 0               | 0               |
| P95 API latency (Bangalore)                      | < 400 ms        | < 300 ms        | < 250 ms        |

## 15. Approvals

| Role           | Name | Sign-off | Date |
| -------------- | ---- | -------- | ---- |
| Business owner | —    | ☐        |      |
| Engineering    | —    | ☐        |      |
| Reviewer       | —    | ☐        |      |

---

_This PRD is a living document. Substantive changes bump the minor version and require re-approval._
