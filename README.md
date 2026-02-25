# rxrn — simple Vercel site

This repository contains a small marketing site for a product and a client-side stories feature.

Quick start

1. Install Vercel CLI (optional): `npm i -g vercel`
2. Open a terminal in the project folder:

```powershell
cd C:\Users\Julius\Documents\GitHub\rxrn
```

3. Preview locally (Vercel dev):

```powershell
npx vercel dev
# or
npm run start
```

4. Deploy to Vercel (follow prompts):

```powershell
npx vercel --prod
```

Notes about the stories feature

- User-submitted stories are stored in the browser's `localStorage` under the key `rxrn_stories`.
- This is a client-side prototype: to persist stories across visitors you should connect the form to a backend API or database (e.g., Vercel Serverless + Fauna/Planetscale, Supabase, or Firebase).

Files of interest:

- [index.html](index.html) — main page with product links, benefits, and stories form
- [styles.css](styles.css) — styles
- [scripts.js](scripts.js) — client-side stories implementation (localStorage)
- [vercel.json](vercel.json) — Vercel config
- [package.json](package.json)

If you'd like, I can:
- Start a local dev server now
- Wire the stories form to a simple serverless endpoint and temporary JSON store (note: not persistent on Vercel without external DB)
- Create a Git commit and push to a remote for automatic Vercel deployment

