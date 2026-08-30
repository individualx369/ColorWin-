# ColorWin — StackBlitz-compatible virtual-credit demo

This is a mobile-first BG678/WinGo-inspired **virtual-credit simulation**. It does not process real-money gambling, real UPI deposits, cash withdrawals, or payment settlement.

## Run

```bash
npm install
npm start
```

StackBlitz WebContainer is supported: this version intentionally does **not** use native SQLite/better-sqlite3. Data is stored in `db/colorwin.json`.

## Demo
- OTP: `123456`
- Gift: `GIFT50` (₹50 virtual credit)
- Admin route: `/admin-login`
- Default demo admin: `admin / admin-demo-only`

For deployment, set `ADMIN_USER`, `ADMIN_PASSWORD`, and `JWT_SECRET` as environment variables.

## Important
Virtual credits only. No real-money betting, payment processing, UPI settlement, or cash withdrawal is implemented.
