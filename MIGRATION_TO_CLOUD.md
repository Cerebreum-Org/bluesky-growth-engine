# Migrate to Supabase Cloud for Public Deployment

Your frontend is ready for deployment, but you're currently using a local Supabase instance that won't be accessible publicly. Here's how to migrate to Supabase Cloud:

## Step 1: Create Supabase Cloud Project

1. Go to [supabase.com](https://supabase.com/dashboard)
2. Create a new project
3. Choose a name and password for your database
4. Wait for provisioning (2-3 minutes)

## Step 2: Export Your Local Schema

```bash
# If you have supabase CLI installed
supabase db dump --schema-only > schema.sql

# Or manually copy your table definitions from supabase/schema.sql
```

## Step 3: Import Schema to Cloud

1. Go to your cloud project → SQL Editor
2. Run your schema creation scripts
3. Or copy/paste from your local `supabase/` directory

## Step 4: Export and Import Data (Optional)

If you have data you want to keep:

```bash
# Export data from local
supabase db dump --data-only > data.sql

# Import to cloud via SQL Editor
```

## Step 5: Update Environment Variables

### Local Development (frontend/.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-cloud-project
```

### Backend (.env)
```bash
BLUESKY_HANDLE=neoreactionary.bsky.social
BLUESKY_PASSWORD=DopeFuture2021!
BLUESKY_SERVICE=https://bsky.social

# Update these with cloud credentials
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-service-role-key-from-cloud-project
```

## Step 6: Test Migration

```bash
# Test backend with cloud DB
npm run dev

# Test frontend with cloud DB
cd frontend && npm run dev
```

## Step 7: Deploy Frontend

### Option A: Vercel (Easiest)

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Deploy
cd frontend && vercel

# Add environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Option B: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd frontend
npm run build
netlify deploy --prod --dir=.next

# Add env vars in Netlify dashboard
```

### Option C: Railway

1. Connect GitHub repo to Railway
2. Set build command: `cd frontend && npm run build && npm run start`
3. Add environment variables in Railway dashboard

## Quick Alternative: Tunnel Local Database

If you want to deploy quickly without migrating:

```bash
# Install ngrok
# Ubuntu: sudo snap install ngrok

# Expose local supabase
ngrok http 8000

# Use the ngrok URL as your NEXT_PUBLIC_SUPABASE_URL
# ⚠️  Not recommended for production!
```

## Verification Checklist

- [ ] Cloud Supabase project created
- [ ] Schema imported successfully  
- [ ] Environment variables updated
- [ ] Backend connects to cloud DB
- [ ] Frontend connects to cloud DB
- [ ] Frontend deployed to hosting platform
- [ ] Public URL accessible and working

## Need Help?

Run the deployment script: `./deploy-frontend.sh`

This will guide you through the process interactively.