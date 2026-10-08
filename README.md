# Bamma Gari Vantilu — Free Review + Bill + UPI MVP

A mobile-first restaurant web app for table QR codes.

## Customer flow

QR → Menu → Bill → optional honest Google review → scratch reward → final bill → UPI.

**Compliance change:** the reward is available independently of whether the customer reviews the restaurant. Do not make a discount/reward conditional on leaving a Google review.

## Run locally

1. Install Node.js 20+.
2. In this folder: `npm install`
3. Start: `npm run dev`
4. Open the Vite URL shown in the terminal.
5. Customer: `/table/1`
6. Staff: `/admin`

## Supabase mode (recommended for real restaurant use)

1. Create a free Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Restart the dev server.
5. Replace the sample menu with the restaurant's real menu in Supabase.

### Important security note

The included SQL uses broad public RLS policies to keep this MVP simple. Before a public production launch, add Supabase Auth and staff/admin roles. Do not put a Supabase service-role key in the browser.

## UPI

Before real payments, set the restaurant's UPI ID. In `src/main.jsx`, replace:

`YOUR_UPI_ID@bank`

with the real merchant VPA, or move this setting into a secure configuration table.

The app uses a standard `upi://pay` deep link and also shows a QR containing the same payment payload. Payment success is not automatically verified in this MVP; staff should verify the receipt in the merchant UPI app. A real payment provider/PSP integration can be added later for automatic verification.

## Google review

The app is configured with the Google Maps link supplied in the chat:
`https://maps.app.goo.gl/GTCU6VeZavhzYzjWA`

The user can open the listing and submit an honest review. The reward is never unlocked because of the review; it is a separate thank-you game.

## Table QR codes

The admin page generates one QR per table pointing to `/table/N` on your deployed domain. Print those QR codes on table cards.

## Free deployment

A common free setup is:
- Vercel or Cloudflare Pages for the frontend.
- Supabase free tier for database/auth.
- Existing restaurant UPI account for payment initiation.

A custom domain is optional and may cost money, but the app can be used on the free deployment URL.
