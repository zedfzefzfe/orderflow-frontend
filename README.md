# OrderFlow

OrderFlow is a multi-tenant SaaS that helps small Moroccan e-commerce shops (candle shops, perfume shops, etc.) automatically capture and organize orders received via WhatsApp. When a customer messages a shop on WhatsApp and confirms an order, the message is parsed by Claude AI and saved to the shop's clean, organized dashboard.

## Project Structure

```
├── frontend/          # React + Vite + Tailwind CSS + shadcn/ui
│   ├── src/
│   │   ├── pages/         # Login, Dashboard
│   │   ├── contexts/      # AuthContext (Supabase)
│   │   ├── lib/           # API client, Supabase client
│   │   ├── components/ui/ # shadcn components
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
│
├── backend/           # Express + Prisma + PostgreSQL
│   ├── src/
│   │   ├── routes/        # Orders, Stats, Webhook
│   │   ├── services/      # LLM Parser, WhatsApp notifications
│   │   ├── middleware/    # Auth middleware
│   │   ├── lib/           # Prisma client, Supabase admin
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── package.json
│
├── .env.example       # All required environment variables
└── README.md          # This file
```

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ running locally or in the cloud
- **Supabase** account (free tier works)
- **Anthropic** API key (for Claude AI order parsing)
- **Meta Developer** account (for WhatsApp Cloud API)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repo-url>
cd orderflow
```

### 2. Configure Environment Variables

Copy `.env.example` to both the root and backend directories:

```bash
cp .env.example .env          # Frontend env
cp .env.example backend/.env  # Backend env (add DATABASE_URL and API keys)
```

Fill in all values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) |
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp access token |
| `WHATSAPP_VERIFY_TOKEN` | Any random string you choose for webhook verification |
| `WHATSAPP_API_VERSION` | WhatsApp API version (e.g., `v18.0`) |
| `WHATSAPP_TEMPLATE_NAME` | Name of your approved WhatsApp template |

### 3. Set Up Supabase Auth

1. Go to [supabase.com](https://supabase.com), create a project
2. Go to **Authentication > Providers > Email** and enable it
3. Copy your **Project URL** and **Anon Key** from **Project Settings > API**
4. Also copy the **Service Role Key** (backend only — keep it secret)

### 4. Set Up the Database

```bash
# In the backend directory
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Seed Test Data

```bash
npm run db:seed
```

This creates:
- **Business**: Zethnika (candle shop)
- **User**: `owner@zethnika.ma` / `zethnika123`
- **4 sample orders** in various statuses

### 6. Run the Application

**Backend:**
```bash
cd backend
npm run dev   # Runs on http://localhost:3001
```

**Frontend (in a new terminal):**
```bash
cd frontend  # or root directory
npm run dev  # Runs on http://localhost:5173
```

### 7. Log In

Open http://localhost:5173 and log in with:
- **Email**: `owner@zethnika.ma`
- **Password**: `zethnika123`

## Connecting WhatsApp (Meta Cloud API)

### Step 1: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → Select **Business** type
3. Add the **WhatsApp** product to your app
4. Go to **WhatsApp > Getting Started** and copy your:
   - **Phone Number ID** (save this in the `businesses` table in your DB)
   - **Access Token** (save as `WHATSAPP_ACCESS_TOKEN`)

### Step 2: Configure Your Business

Update the seed data or manually update your business record in the database:

```sql
UPDATE businesses
SET whatsapp_phone_number_id = 'YOUR_PHONE_NUMBER_ID',
    owner_notify_phone = '212600000000'  -- owner's personal WhatsApp with country code
WHERE name = 'Zethnika';
```

### Step 3: Create a WhatsApp Template

For the owner notification to work, you need an approved **utility template**:

1. Go to **WhatsApp > Message Templates** in Meta dashboard
2. Click **Create Template**
3. Category: **Utility**
4. Name: `nouvelle_commande` (or match `WHATSAPP_TEMPLATE_NAME`)
5. Languages: **French**
6. Body content:
```
🌸 Nouvelle commande !

👤 {{1}}
🛍️ {{2}} x{{3}}
📍 {{4}}
📅 {{5}}

Ouvrez votre tableau de bord pour la gérer.
```
7. Submit for approval (usually approved within minutes)

### Step 4: Set Up the Webhook

For local development, use a tunnel like **ngrok** or **cloudflared**:

**Using ngrok:**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001
# This gives you a public URL like https://abc123.ngrok.io
```

**Configure in Meta Dashboard:**
1. Go to your Meta app → **WhatsApp > Configuration**
2. Under **Webhooks**, click **Edit**
3. Callback URL: `https://your-ngrok-url.ngrok.io/api/webhook/whatsapp`
4. Verify Token: same as your `WHATSAPP_VERIFY_TOKEN` env variable
5. Click **Verify and Save**
6. Under **Webhook Fields**, subscribe to **messages**

**Send a test message** to your WhatsApp number — you should see it appear in the OrderFlow dashboard!

## How It Works

1. **Customer sends WhatsApp message** → Meta forwards it to your webhook
2. **Webhook saves the message** to `MessageLog` and sends it to Claude AI
3. **Claude parses the message** (handles French, Arabic, Darija) and extracts order details
4. **Order is created** with status `NEW` if it's a valid order
5. **Owner gets notified** via WhatsApp template message with order details
6. **Shop owner opens dashboard** to see all orders and update statuses

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/webhook/whatsapp` | No | Meta webhook verification |
| POST | `/api/webhook/whatsapp` | No | Receive WhatsApp messages |
| GET | `/api/orders` | Yes | List orders (filtered by business) |
| PATCH | `/api/orders/:id` | Yes | Update order status |
| GET | `/api/stats` | Yes | Dashboard statistics |

## Multi-Tenancy

Every request is scoped to the authenticated user's `businessId`. The auth middleware extracts the JWT, looks up the user in the database, and attaches their business context. All order queries include `WHERE businessId = ?` to ensure shops can never see each other's data.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase Auth
- **Backend**: Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL
- **AI**: Anthropic Claude (order parsing from natural language)
- **Messaging**: Meta WhatsApp Cloud API

## License

MIT
