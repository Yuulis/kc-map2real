This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Set your MapTiler key via environment variables.

1. Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and set your key:

```bash
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_key_here
```

On Vercel, add `NEXT_PUBLIC_MAPTILER_KEY` in Project Settings → Environment Variables and redeploy. If the key is not set, the map falls back to MapLibre demo tiles.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Names Management (Sea Groups / Seas / Nodes)

- Purpose: Manage display names for sea groups, individual seas, and nodes.
- Data file: [public/data/names.json](public/data/names.json)
- Types: [app/types/names.ts](app/types/names.ts)
- API: GET [app/api/names/route.ts](app/api/names/route.ts)

### Schema

- version: schema version for future changes.
- groups[]: list of sea groups.
  - id: group id (e.g. "1").
  - name: group display name.
  - seas[]: list of seas in the group.
    - code: sea code (e.g. "1-1"). Must match keys in [public/data/nodes.json](public/data/nodes.json).
    - name: sea display name.
    - nodes: map of nodeId (e.g. "A", "Start") to display name.

### How to add/update

- Add a new group: append to `groups` with a unique `id` and `name`.
- Add a new sea: append to `seas` with `code` that matches a key in `nodes.json` and set `name`.
- Add node names: fill `nodes` map where the keys are node ids found in the corresponding sea in `nodes.json`.
- Fetch in frontend: call `/api/names` to get the `NamesData` JSON and join with `nodes.json` by `code` and `node id`.

This keeps topology (coordinates and edges) in `nodes.json` and labels in `names.json`, making future additions straightforward.
