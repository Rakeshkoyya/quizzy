# Exam Prep (Phase 1)

Phase 1 implements:

- User authentication (Supabase Auth)
- Upload answer-key image to Supabase Storage
- OCR extraction via Google Cloud Vision API
- Parse to JSON mapping: question number -> answer option (`A/B/C/D`)
- Create timed exam
- Attempt UI (one question view, navigation, save selected answers)
- Result summary (correct, wrong, unanswered)
- Wrong/unanswered question row lists

## Tech Stack

- Next.js (App Router, TypeScript)
- Supabase (Auth + Storage + PostgreSQL)
- Prisma (schema + migrations)
- Google Cloud Vision API (OCR)

## 1) Environment Variables

Copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
DIRECT_URL=
GOOGLE_CLOUD_API_KEY=
```

## 2) Supabase Setup

1. Create project in Supabase.
2. Enable **Email** auth provider in Auth settings.
3. Create storage bucket named `answer-keys`.
4. Add authenticated insert/read policies for the bucket.
5. Get API values from **Project Settings -> API**:
	- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
	- `anon` public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Get DB connection strings from **Project Settings -> Database**:
	- Pooler URL -> `DATABASE_URL`
	- Direct URL -> `DIRECT_URL`

## 3) Google Vision API Setup

1. Create/select Google Cloud project.
2. Enable **Cloud Vision API**.
3. Create API key.
4. Restrict the key to Vision API.
5. Put key in `GOOGLE_CLOUD_API_KEY`.

## 4) Prisma Migrations (Supabase DB)

```bash
npx prisma generate
npx prisma migrate dev --name init
```

For deployment environments:

```bash
npx prisma migrate deploy
```

## 5) Run App

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Migration Tool Answer (Liquibase/Alembic equivalent)

Yes. In this project, Prisma is used as the migration tool from Next.js:

- schema in `prisma/schema.prisma`
- migration files in `prisma/migrations`
- commands: `prisma migrate dev` and `prisma migrate deploy`

Alternative: Supabase CLI migrations are also valid if you prefer SQL-first workflow.
