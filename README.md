# Dinner on Sazz

A small, shared restaurant-voting app for a Chicago team. Sazz is reimbursing dinner; no booking or payment happens here. Nominate one restaurant each, rate every option privately, and reveal the group’s picks together.

## What is implemented

- Separate host and participant views, with a copyable participant link.
- Names and one editable nomination per person; exact duplicate nominations combine automatically. The host can merge spelling variants before voting.
- Google lookup links generated from each live nomination (no external search API).
- Host-controlled nomination, voting and results phases.
- Complete 1–5 ballots, editable until voting closes. Individual scores appear only after the reveal. The host cannot read other people’s scores before revealing.
- Equal-weight average ranking, then count of 5s; true ties share a rank. Unfinished ballots never contribute.
- Confirmation naming missing voters before an early reveal.
- Synchronized polling every two seconds, a reveal countdown, and per-restaurant individual ratings.
- Browser resume credentials, idempotent submission retries, and optimistic database concurrency to avoid losing simultaneous votes.
- Session links expire after seven days. Expiration prevents reads/edits; automatic deletion is optional (see below).

## How it works

The browser calls `/api/session`. That Vercel Node.js function validates the caller, the current session phase, and each input before reading/writing MongoDB Atlas. Database credentials are never sent to the browser. A single session document holds the small dinner party. Version-checked atomic replacements prevent one person’s submission from silently overwriting another’s. No Supabase account is required.

Only opaque host/participant capabilities are saved in browser local storage. These survive refresh on that browser, but are not corporate login identities. A participant link allows joining during nominations; it does not grant host controls. The host should keep their original browser profile and tab available. A new browser cannot recover an existing host capability just from the URL. Use a separate fresh session for each dry run.

## Deploy to Vercel from GitHub

1. In Vercel, create a **new project**, import `jackclane99/dinner-on-sazz`, and select framework **Other**.
2. Leave Root Directory at repository root. Leave Build Command unset. The included `vercel.json` sets Output Directory to `public`; Vercel installs the MongoDB dependency and deploys `api/session.mjs` as a server function. This is a full source deployment, not an HTML-only Vercel Drop upload.
3. Add these **server environment variables** to the Production environment (also Preview if rehearsing preview branches):

| Name | Value |
| --- | --- |
| `MONGODB_URI` | Your private completed `mongodb+srv://…` connection string |
| `MONGODB_DB` | `dinner_on_sazz` |
| `HOST_PASSWORD` | A private password of at least 16 characters, distinct from your database password |
| `APP_ORIGIN` | Optional: canonical app URL, without a trailing slash. Leave unset initially so previews and production accept their own origin. |

4. Deploy. If you add/change environment variables afterward, redeploy for them to take effect.
5. Open the live URL, choose **Host a dinner**, enter your host password and create a session. You then receive the participant link from the host screen.

### MongoDB configuration

- Use your existing `dinner-on-sazz` cluster. No manual collection creation or sample data is necessary: the first successful session creates the `sessions` collection in `dinner_on_sazz`.
- Create/use an application database user with `readWrite` on **only** `dinner_on_sazz` rather than an Atlas admin user. Use a new private password if a previous one was exposed.
- When assembling the URI, replace `<db_password>` and URL-encode reserved characters in the username/password. Do not include literal angle brackets. Never paste the completed URI into chat, source code, or GitHub.
- The cluster’s Network Access rules must permit Vercel’s outbound connections. The automatically added office IP alone does not permit connections from Vercel. Vercel normally uses dynamic outbound IPs. MongoDB’s documented simple integration permits `0.0.0.0/0`, which makes the database endpoint reachable from any IP while still requiring authentication. Use that configuration only if permitted for this demo; otherwise arrange approved static-egress or private-network hosting. Do not work around EY restrictions.
- If desired, an authorized administrator can create a TTL index on `expiresAt` with `expireAfterSeconds: 0` to automatically delete expired session documents. The app already rejects expired sessions even without that index.

References: [MongoDB client connections](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/), [MongoDB/Vercel networking](https://www.mongodb.com/docs/atlas/reference/partner-integrations/vercel/), [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).

## Run locally

Node.js 22 is the deployment target. Install dependencies with `npm install`. Put real credentials in `.env.local`, using `.env.example` as the template, then:

```sh
npm start
```

Open `http://127.0.0.1:3000`. For a completely offline developer rehearsal without a database:

```sh
node scripts/serve.mjs --local-rehearsal
```

The local test host password is `rehearsal-host-only`. This is visibly labeled as **LOCAL REHEARSAL**. Multiple browser contexts on that server share temporary memory, which disappears on restart. The Vercel production entry point cannot select this store and never falls back to it on database failure.

## Validation and limits

```sh
npm test
npm run check
```

The automated suite covers nomination changes and merging, ownership/host permission checks, hidden ballot filtering, complete ballots and edits, early close, exact ranking and ties, expiration, concurrency (including reveal racing a final submission), and independent HTTP clients through the API handler. Tests use an explicitly injected in-memory repository and do not require installing the driver. These establish application behavior, not a successful live MongoDB connection or a full browser run.

At initial handoff, the 12 backend/HTTP checks passed. This workspace blocked downloads of the browser and npm dependencies, so full browser rendering and the production MongoDB adapter could not be exercised here. Complete `REHEARSAL.md` before presenting. There is no automatic claim of successful deployment.

Designed for a small trusted group (maximum 30 participants), not a public high-volume poll service. Do not distribute the host password. Keep the Vercel project’s deployment-access settings consistent with how your colleagues will join. Repository source can be public; environment secrets and voting data must stay out of it.

## Files

- `public/`: responsive interface and safe browser-only helpers.
- `api/session.mjs`: production Vercel API.
- `lib/core.mjs`: session rules, authorization and response filtering.
- `lib/service.mjs`: idempotent creation and concurrency retry loop.
- `lib/store.mjs`: MongoDB adapter; explicitly selected local/test store.
- `scripts/serve.mjs`: local server.
- `tests/session.test.mjs`: automated behavior and HTTP checks.
- `REHEARSAL.md`: acceptance checklist and presentation sequence.
- `DEMO_PROMPTS.md`: prompts for a rehearsed build and one visible refinement.

No dependency files, app names, domains, or secrets from the separate Atlas revenue-planning project are used.
