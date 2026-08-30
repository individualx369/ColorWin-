# ColorWin — Full-stack demo

A mobile-first, BG678/WinGo-inspired **virtual-credit demo** with a user/admin loop. It intentionally does **not** process real-money gambling, real UPI deposits, cash withdrawals, or payment settlement.

## Included
- Phone/email login + registration with demo OTP
- Virtual wallet and transaction ledger
- Independent 30s / 1m / 3m / 5m game timers
- Color / number / Big-Small virtual bets
- Round settlement + history
- Gift code redemption (`GIFT50` seeded)
- Demo deposit/withdrawal requests using virtual credits only
- Hidden `/admin-login` route with environment-configured admin credentials
- Admin overview, request approval/rejection, gift-code manager
- SQLite persistence
- Responsive UI matching the supplied visual direction

## Run
```bash
npm install
ADMIN_USER=admin ADMIN_PASSWORD='change-me' JWT_SECRET='replace-this' npm start
```
Open `http://localhost:3000`.

For development:
```bash
npm run dev
```

## Demo admin
If env vars are omitted, the development fallback is `admin / admin-demo-only`.
Change this before any deployment.

## Important
This project is deliberately a **virtual-credit simulation**. The payment QR/UPI details from the reference image are not wired into the application, and no real-money gambling/payment flow is implemented.
