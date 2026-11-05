# Sebastian Photos

Photography portfolio and password-protected dashboard served by one Node.js app. The contact form stores messages in the dashboard inbox and can send email notifications through Brevo.

## Hosting

Deploy as a Render Node web service. Build: `npm ci && npm run build`. Start: `npm start`. Set `NODE_ENV=production`, `DATABASE_URL` to a PostgreSQL connection string, and `ADMIN_PASSWORD` to a private password of 14–128 characters. Never commit these values. On first startup the app hashes the password and saves the hash in the database. Changing the environment variable later does not reset an existing password.

The database stores dashboard changes, photos uploaded after launch, sessions and contact inquiries; the 76 initial photos are bundled in the app. The initial content is inserted once, not on every deploy. Back up the database and monitor the free database provider's storage and compute allowances.

Render free web services can sleep during inactivity and take time to wake up. Free hosted services and database quotas can change; see the providers' current terms.

For email notifications, set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (a verified sender on the Brevo account), and `NOTIFY_EMAIL` in Render. The Brevo transactional sending service must be activated. Render supplies `RENDER_EXTERNAL_URL`; for another host set `PUBLIC_URL`. Notification emails include the visitor's name, email, package, and message, and set the visitor as the reply-to address. Messages remain in the database if delivery fails, and the app retries pending notifications while it is running.

## Dashboard

Visit `/admin/` and sign in with the password configured at first startup. The Portfolio editor manages galleries and packages. Inquiries lists contact messages, including each visitor's return email address. Opening an email address starts a reply in the device's mail app.
