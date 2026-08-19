# Moving Auto Route to Railway

This copy is separate from the current live ChatGPT/Sites version. Deploying this folder to Railway will not change the working Auto Route your team is using now.

## 1. Create GitHub repo

Create a private repo, for example:

```text
sdhs-auto-route
```

Push this folder to that repo.

## 2. Create Railway project

In Railway:

1. New Project
2. Deploy from GitHub repo
3. Select `sdhs-auto-route`
4. Add a Postgres database
5. Open the web service variables

## 3. Add Railway variables

Add these variables:

```text
NEXT_PUBLIC_APP_URL=https://your-railway-domain.up.railway.app
SERVICEM8_CLIENT_ID=from ServiceM8 developer app
SERVICEM8_CLIENT_SECRET=from ServiceM8 developer app
SERVICEM8_REDIRECT_URI=https://your-railway-domain.up.railway.app/api/servicem8/callback
SERVICEM8_SCOPES=read_customers read_jobs read_staff read_schedule write_schedule
APP_SECRET=long random value
DATABASE_URL=Railway Postgres URL
```

## 4. ServiceM8 developer app URLs

Use the Railway domain first. Custom domain can come later.

```text
Activation URL:
https://your-railway-domain.up.railway.app/api/servicem8/connect

OAuth Redirect URL:
https://your-railway-domain.up.railway.app/api/servicem8/callback
```

## 5. Test order

1. Open `/api/health`
2. Open the dashboard URL
3. Add ServiceM8 OAuth credentials
4. Test `/api/servicem8/connect`
5. Connect Same Day Home Services first
6. Only switch staff from the current live app after this version is confirmed

## Not done yet

The OAuth connection starts and exchanges the token, but token storage is intentionally marked as the next step. Do not sell this publicly until tokens, refresh handling, per-business settings, booking logs, and error reporting are finished.
