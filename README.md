# Bill Wallah Rewards Website

A production-oriented Node/Express + MongoDB starter for the Bill Wallah ₹15 manual-verification campaign.

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000` for the user site.
6. Open `http://localhost:3000/admin` for the protected admin panel.

## Notes

- Screenshot uploads are limited to PNG/JPEG/WEBP and 5 MB each.
- One submission is allowed per mobile number. Only the mobile number is collected; social usernames/IDs are not required.
- Admin authentication uses an HTTP-only cookie and JWT. The login reads ADMIN_EMAIL and ADMIN_PASSWORD from `.env`.
- Proof files are only served through an authenticated admin route.
- There is deliberately no automatic screenshot verification or automatic payout.
- For production, use HTTPS, a strong JWT secret, a managed MongoDB instance, object storage for uploads, and a real admin identity provider or rotated credentials.
- The app-store CTA remains disabled because no official app-store URL was supplied.

## ImageKit storage

Screenshot uploads are now sent directly from the backend to ImageKit. The server does not save screenshots to the local `uploads/` directory. MongoDB stores the ImageKit CDN URL in:

- `instagramScreenshot`
- `youtubeScreenshot`
- `founderInstagramScreenshot`

Set `IMAGEKIT_PRIVATE_KEY` in your environment before starting the server.

Install dependencies:

```bash
npm install
npm start
```

The current `@imagekit/nodejs` SDK requires Node.js 20 LTS or newer.

