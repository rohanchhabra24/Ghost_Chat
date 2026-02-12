# Ghost Chat

**Privacy-first, self-destructing chat application**

## About

Ghost Chat is an ephemeral messaging platform that prioritizes privacy and leaves zero digital footprint. No accounts, no history, no identity—just secure, temporary conversations.

### Key Features

- **End-to-End Encryption**: All messages encrypted client-side using AES-GCM
- **Self-Destructing**: Rooms automatically expire after user-defined duration (up to 3 hours)
- **Anonymous**: No accounts, phone numbers, or personal data collection
- **Privacy Mode**: Automatic blur protection when window loses focus
- **Camera-Only Photos**: Live capture only, no gallery access

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Edge Functions + PostgreSQL + Realtime)
- **Encryption**: Web Crypto API
- **Hosting**: Vercel (Frontend) + Supabase (Backend)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (for backend)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd ghost-chat

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials to .env.local

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## Development

```sh
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Supabase)

```sh
# Deploy edge functions
supabase functions deploy room-operations

# Run migrations
supabase db push
```

## Documentation

See [GHOST_CHAT_DOCS.md](./GHOST_CHAT_DOCS.md) for comprehensive technical documentation including:
- System architecture
- Database schema
- API specifications
- Security & compliance details
- Performance requirements

## License

MIT
