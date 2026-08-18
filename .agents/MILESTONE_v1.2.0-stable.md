# Milestone: Stable Release & Supabase Complete Recovery Guide (v1.2.0)

This document serves two purposes:
1. A guide to restore the application codebase to the stable `v1.2.0-stable` state.
2. A comprehensive disaster recovery guide for **Supabase**, establishing a clear step-by-step process to rebuild the entire backend from scratch if the current Supabase project is completely lost or accidentally deleted.

---

## 📌 Part 1: Codebase Tag Information

- **Tag Name**: `v1.2.0-stable`
- **Description**: This tag marks a highly stable point that includes all previous UI improvements, full i18n support, brand/category filtering bug fixes, robust session auto-reconnect logic strategies on Mac Safari/Chrome (to prevent `401 Unauthorized` errors when tabs are inactive), and optimizations to Cloudflare Pages deployment.

### 🔄 How to Restore this Codebase Milestone

#### Option 1: Explore without modifying the current branch (Detached HEAD)
If you want to run the app to see how this version looked without affecting your current work:
```bash
git checkout v1.2.0-stable
```
*To return to your latest work:* `git checkout main`

#### Option 2: Create a new branch from this milestone
To start new work based exactly on this point in time:
```bash
git checkout -b feature-from-stable v1.2.0-stable
```

#### Option 3: Hard reset the current branch to this milestone (⚠️ WARNING)
Completely overwrite current branch state (erases newer commits):
```bash
git reset --hard v1.2.0-stable
```

---

## 🛠️ Part 2: Supabase Complete Disaster Recovery Guide

If the Supabase project is completely lost, deleted, or you need to deploy an exact clone of the backend to a brand new Supabase Organization/Project, follow these exact steps.

### Step 1: Create a New Supabase Project
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard/).
2. Click **New Project**, select your Organization, and set a database password.
3. Wait for the database provisioning to complete.
4. Go to **Project Settings > API** to get your new `URL` and `anon key` (and `service_role key`).
5. Update your local `.env` file (and Cloudflare Pages environment variables) with these new keys:
   ```env
   VITE_SUPABASE_URL=your-new-project-url
   VITE_SUPABASE_ANON_KEY=your-new-anon-key
   ```

### Step 2: Link the Local Repository to the New Project
Open your local terminal in the project root folder.
```bash
# Login to Supabase CLI (if you haven't already, requires Access Token)
npx supabase login

# Link this local codebase to your new Supabase remote project
npx supabase link --project-ref <your-new-project-ref>
# Enter your database password when prompted.
```
*(The `<project-ref>` is the ID found in your Supabase project URL: `https://supabase.com/dashboard/project/<project-ref>`)*

### Step 3: Restore Database Schema & Functions
Your `supabase/migrations` folder acts as the single source of truth for the database schema.
```bash
# Push all local migrations to the remote database
npx supabase db push
```
This single command will rebuild all tables, views, RLS (Row Level Security) policies, and database triggers.

### Step 4: Deploy Edge Functions (Giao Hàng Tiết Kiệm, v.v.)
This project uses several Supabase Edge Functions. You must deploy them to the new cloud environment:
```bash
# Deploy all functions inside supabase/functions/
npx supabase functions deploy
```
*Important: You also need to set the environment variables for these functions to work (like `GHTK_API_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY`):*
```bash
npx supabase secrets set --env-file ./supabase/.env.local
```
*(Ensure you have a `.env.local` containing the correct production secrets for the edge functions. Don't commit this file).*

### Step 5: Setup Storage Buckets Manually
Unless storage buckets were explicitly created via SQL in your migrations, you need to recreate them in the Supabase Dashboard.
1. Go to **Storage > Create Bucket**.
2. Recreation Checklist:
   - `avatars` (Public: Yes)
   - `blog-images` (Public: Yes)
   - `service-images` (Public: Yes)
   - `product-images` (Public: Yes)
   - `brand-logos` (Public: Yes)
   - `patient-documents` (Public: No - Requires Auth RLS)
3. Ensure the security policies (RLS) on these buckets allow users to read/upload as intended (migrations often handle policies if the buckets exist, or you can copy them from the old settings).

### Step 6: Authentication Setup
1. Go to **Authentication > Configuration > Providers** and enable your desired providers (e.g., Email).
2. Under **URL Configuration**, set the `Site URL` to your live domain (e.g., `https://thegioitrimun.vn`).
3. Add any necessary redirection URIs.

### Step 7: Bootstrapping Admin Account & Seed Data (Optional but Recommended)
If you have an initial backup or SQL dump of your data (`seed.sql` or `backup.sql`), you can restore it via the CLI:
```bash
# To push a local seed file or backup dump
psql -h aws-0-[region].pooler.supabase.com -p 6543 -d postgres -U postgres.[project-ref] -f ./backup.sql
```
Otherwise, you will need to sign up as a new user via the frontend, then manually promote that user to an `admin` role in the `users` (or `user_roles`) table via the SQL Editor in the Supabase Dashboard to regain full access.

---
**✅ Recovery Complete.** Your frontend should now point to the new Supabase instance and operate normally.
