# TapLoyalty App

A working QR-based loyalty & feedback app, connected to a real Supabase database.

## Deploy to Vercel (recommended path)

1. Create a free account at https://github.com and https://vercel.com
2. Create a new GitHub repository and upload this whole folder to it
   (Add file → Upload files on github.com works fine, no command line needed)
3. Go to vercel.com → "Add New Project" → import the GitHub repo you just made
4. Before deploying, open "Environment Variables" and add:
   - `VITE_SUPABASE_URL` = your Supabase project URL (e.g. https://xxxx.supabase.co)
   - `VITE_SUPABASE_ANON_KEY` = your Supabase Publishable key (starts with sb_publishable_)
5. Click Deploy. Vercel gives you a live URL like `taployalty.vercel.app`

## Local development (optional, only if you have Node.js installed)

```
npm install
cp .env.example .env   # then fill in your real keys
npm run dev
```
