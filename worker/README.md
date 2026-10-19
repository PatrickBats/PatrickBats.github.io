# Private visitor analytics

The GitHub Pages site posts empty requests to the Cloudflare Worker. The Worker reads Cloudflare edge IP and approximate location metadata, applies a per-location rate limit, and writes to private D1. Public requests cannot read records. Google Firebase ID tokens are verified server-side; only the verified Google account `jbatsell65@gmail.com` can read them.

New visits are paginated in groups of 50 using the last database ID. Repeat counts group by IP, not person. Historical Firebase visits have no raw IPs and use a separate timestamp/key pagination cursor. Records have no automatic expiry. Free quotas can eventually stop collection; no paid subscription is required or enabled.

## Deploy and verify

1. In this directory run `npm ci`, `npm test`, and `npx wrangler deploy --dry-run`.
2. Authenticate with `npx wrangler login`. Apply schema with `npx wrangler d1 migrations apply patrick-visitors --remote`, then `npx wrangler deploy`.
3. From the repository root, configure Google sign-in with `npx firebase-tools deploy --only auth --project patrickbatsell-site`. Ensure `patrickbats.github.io` is in Firebase Authentication's authorized domains. This does not require Blaze.
4. Verify the live Worker rejects unauthenticated GET `/visits` (401) and a POST `/visit` from the website origin succeeds (204). Do not use real visitor records as test fixtures or print IPs into deployment logs.
5. Set `analytics-config.js` to the verified Worker origin. Publish website assets to GitHub Pages and verify the Pages run succeeds.
6. Deploy `database.rules.json` using `npx firebase-tools deploy --only database --project patrickbatsell-site`. Confirm unauthenticated Firebase reads are denied. This closes old public writes; existing records remain intact.
7. Sign into the live dashboard as the owner and check both record views. Verify other accounts are denied and sign-out clears records.

The current database ID is in `wrangler.jsonc`. It is an identifier, not a credential. OAuth credentials stay in CLI-managed local storage. Never commit visitor exports or credentials. To remove records, use the authenticated D1 console and an explicit parameterized identifier/IP selection after verifying the deletion target.

## Failure behavior

Tracking errors never interrupt the website. The dashboard reports failures rather than showing private data after sign-out. Rate limits are best-effort per Cloudflare location; Origin checks are browser restrictions and do not prove requests are human. The Worker never trusts body or X-Forwarded-For IP values. Signed Firebase tokens can remain valid until their expiry; this deployment uses short-lived ID tokens rather than persistent API keys.

If rollback is needed, keep database access private. Do not restore the former public-write Firebase rules. Disable `track.js` collection until a healthy backend is available.
