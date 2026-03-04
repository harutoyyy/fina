# fina - Project Documentation

## Overview

A Next.js full-stack application using the App Router pattern, TypeScript, and Tailwind CSS v4.

## Architecture

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **Runtime**: Node.js 20

## Project Structure

```
app/           - Next.js App Router pages and layouts
  layout.tsx   - Root layout
  page.tsx     - Home page
  globals.css  - Global styles + Tailwind directives
public/        - Static assets
```

## Replit Configuration

- Dev server: `npm run dev` on port 5000 (0.0.0.0)
- `next.config.ts` sets `allowedDevOrigins: ["*"]` for Replit proxy compatibility
- Deployment: autoscale with `npm run build` + `npm run start`

## Dependencies

- next: 16.1.6
- react: 19.2.3
- react-dom: 19.2.3
- tailwindcss: ^4
- typescript: ^5
