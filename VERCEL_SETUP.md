# Vercel Deployment Setup

This monorepo contains two separate Next.js applications that deploy independently to different Vercel projects.

## Current Setup

### Roadmap App
- **Directory:** `apps/roadmap`
- **URL:** https://ajc-roadmap.vercel.app
- **Vercel Project ID:** prj_MDQM8hsZ95yz3Smea4BMPkQkWTKK
- **Status:** ✅ Already configured and deploying

### Scrum Master App
- **Directory:** `apps/scrum-master`
- **URL:** https://ajc-scrum.vercel.app
- **Status:** ⚠️ Requires new Vercel project

## Setting Up Scrum Master Deployment

You need to create a new Vercel project for the scrum-master app:

### Step 1: Create the Vercel Project

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Select your AJC GitHub repository
4. Configure the project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/scrum-master`
   - **Project Name:** `ajc-scrum`
5. Click "Create"

### Step 2: Environment Variables

Add these environment variables to the new `ajc-scrum` project (same as roadmap):
- `JIRA_HOST` 
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `ANTHROPIC_API_KEY`

The values should match what's in your roadmap project.

### Step 3: Verify Configuration

Once created, Vercel will automatically:
- Detect the monorepo structure from `vercel.json`
- Build using the `buildCommand` specified
- Deploy changes to the scrum-master app only when `apps/scrum-master/` is modified

## Local Testing

To test both apps locally:

```bash
# Install dependencies (turbo will handle monorepo)
npm install

# Run roadmap only
npm run dev:roadmap
# Opens on http://localhost:3000

# Run scrum-master only
npm run dev:scrum
# Opens on http://localhost:3000 (or next available port)
```

## Build Configuration

- **Vercel Config:** `vercel.json` defines the monorepo projects
- **Build Orchestration:** `turbo.json` optimizes builds with caching
- **Build Command:** `turbo run build --filter={app}` (Vercel fills in the app name)

## Notes

- Both apps share the same database/auth credentials
- Environment variables are inherited from the monorepo root
- Deploys are independent — changes to roadmap don't trigger scrum-master redeploys
- Git branch deployments apply to both apps (both will build on new commits unless explicitly filtered)
