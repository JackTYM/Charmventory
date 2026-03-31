# Charmventory

A community-driven platform for Pandora jewelry collectors to track their collections, discover new pieces, and connect with other enthusiasts.

## Features

- **Collection Tracking**: Catalog your Pandora charms, bracelets, and jewelry with detailed metadata
- **Wishlist**: Keep track of pieces you're looking for
- **Open Database**: Browse 5,000+ Pandora products from our community-curated database
- **Community Feed**: Share your collection and connect with other collectors
- **Seller Directory**: Find trusted sellers and share reviews

## Tech Stack

- **Frontend**: Nuxt 3, Vue 3, Tailwind CSS
- **Database**: Neon PostgreSQL with Data API
- **Auth**: Neon Auth (Stack Auth)
- **Storage**: Cloudflare R2
- **Hosting**: Cloudflare Pages

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
DATABASE_URL=postgresql://...
NEON_AUTH_URL=https://...
NEON_DATA_API_URL=https://...
R2_ENDPOINT=https://...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://...
```

## License

MIT
