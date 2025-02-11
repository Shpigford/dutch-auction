# Dutch Auction Platform

A Next.js-based Dutch auction platform originally built to sell [Optic](https://withoptic.com), a competitive monitoring and analysis platform. This project implements a fully automated Dutch auction system where the price decreases continuously over time until someone makes a purchase.

NOTE: This was originally thrown together very quickly for one specific purpose (selling Optic), so there's some cleanup to be done to repurpose it for your own use.

![Example Auction](https://github.com/user-attachments/assets/bac66077-f48a-4765-a981-af17b45daf4f)

## Features

- 🏷️ **Dutch Auction System**
  - Automated price reduction over a 7-day period
  - Configurable starting and ending prices
  - Real-time price updates
  - First-come, first-served purchase system

- 📊 **Price Monitoring**
  - Real-time price display with automatic updates
  - Countdown timer for auction start/end
  - Average target price indicator
  - Current visitor count display

- 📧 **Price Notifications**
  - Email notification system when price reaches target
  - Rate limiting and spam protection
  - IP-based subscription limits
  - Automated email delivery via Postmark

- 💳 **Payment Processing**
  - Stripe integration for secure payments
  - Automatic auction completion upon successful purchase
  - Sale status tracking

- 🔒 **Security Features**
  - Rate limiting on all API endpoints
  - IP address hashing for privacy
  - Input validation and sanitization
  - Secure environment variable handling

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Email**: Postmark
- **Payment**: Stripe
- **Deployment**: Vercel

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Supabase account
- Postmark account
- Stripe account

## Environment Variables

Create a `.env.local` file using the `.env.example` file as a template.

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/Shpigford/dutch-auction.git
cd dutch-auction
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Set up your environment variables in `.env.local`

4. Run the database migrations:

```bash
npm run supabase:migrate
# or
yarn supabase:migrate
```

5. Start the development server:

```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup

The project uses Supabase for database management. The necessary migrations are included in the `supabase/migrations` directory. They will create the following tables:

- `sale_status`: Tracks the auction status and final sale price
- `email_notifications`: Stores user notification preferences
- `visitor_count`: Tracks unique visitors

## API Routes

- `/api/check-price-notifications`: Checks and sends price notifications
- `/api/create-checkout-session`: Creates Stripe checkout sessions
- `/api/subscribe-notification`: Handles notification subscriptions
- `/api/verify-payment`: Processes successful payments
- `/api/webhook`: Handles Stripe webhooks

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.en.html) - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Animations by [Framer Motion](https://www.framer.com/motion/)
- Database by [Supabase](https://supabase.com/)
- Payments by [Stripe](https://stripe.com/)
- Email delivery by [Postmark](https://postmarkapp.com/)
