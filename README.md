# Golden-Home-Care
A platform dedicated to helping elders find assistance they need independently.

Commands to run the site locally from the project root folder:

```npm install```
```npm run dev -- --port 3000```

Auth and email environment variables:

- `DATABASE_URL`: Neon Postgres connection string used by NextAuth and app data tables.
- `NEXTAUTH_SECRET` or `AUTH_SECRET`: secret for signing auth tokens. Local development falls back to a dev-only secret.
- `NEXTAUTH_URL` or `APP_BASE_URL`: public app URL used for signup verification and password reset links.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`: Google OAuth credentials.
- `RESEND_API_KEY` and `NOTIFICATIONS_FROM_EMAIL`: sender configuration for account verification and password reset email.
