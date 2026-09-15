# SDHS Auto Route

Railway-ready copy of the Same Day Auto Route dashboard.

This folder is separate from the current live ChatGPT/Sites version, so deploying
it to Railway will not change the app your team is using now.

## Prerequisites

- Node.js `>=22.13.0`
- GitHub repo
- Railway project
- ServiceM8 developer app credentials

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Railway

See `docs/MIGRATION.md`.

## Current production gap

ServiceM8 OAuth endpoints have been scaffolded. Before selling this publicly,
finish secure token storage, refresh-token handling, per-business settings,
booking logs, and error reporting.

## Commercial v1 direction

This branch turns Auto Route from a single-business private dashboard into a
multi-business ServiceM8 add-on. Customers should activate it from ServiceM8,
approve OAuth access, complete a short onboarding flow, sync their own data and
manage dispatch rules for their company only.

The first commercial route is `/onboarding`.

## Commands

- `npm run dev`: run local dashboard
- `npm run build`: production build
- `npm run start`: run production server
- `npm test`: production build plus existing routing tests
