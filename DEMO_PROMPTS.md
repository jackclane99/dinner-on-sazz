# Prepared prompts for the dry run

Infrastructure should be connected before the live session. Decide during rehearsal whether you will rebuild the full app on an isolated branch or build a new interface over the tested API. Describe the chosen scope accurately to the audience. Do not accidentally replace the known-working production app while experimenting.

## Prompt 1 — full V1 build in an isolated working branch

Build a small shared restaurant-voting app called Dinner on Sazz for 4–5 Chicago colleagues. Sazz offered to reimburse dinner; he is not necessarily attending. Use JavaScript, a Vercel Node.js API, and MongoDB Atlas. Hosting/database accounts and private environment variables are already configured; inspect what is available and never print secrets. Work in an isolated branch; preserve the working production version.

Give me a polished mobile-friendly participant view and protected host view. Everyone joins through a participant link, enters a name, and nominates one restaurant. The host can merge duplicates and open voting. Everyone rates all restaurants 1–5, including their own, and may edit until reveal. Add a Look it up link generated from each restaurant name that opens a Google search for that restaurant in Chicago. Keep everyone’s ratings hidden from other participants and the host until reveal. Show the host only who has submitted. The host clicks “Where are we going on Sazz?” to close voting and reveal the ranked results simultaneously on all devices. Rank by equal-weight average, then count of 5s, then show joint winners. Show individual ratings on expansion after reveal. Require complete ballots, confirm early reveal with missing voters, and prevent late votes. Persist identities on refresh and safely handle simultaneous submissions and retries. Enforce permissions on the backend. No payments, bookings, unrelated features, or client-side database secrets. Do not use a browser-only simulation for shared state.

Use warm cream, deep green and terracotta, elegant typography and a playful dinner motif. Test the three-stage journey with independent clients and check access controls. Report exact tests and any remaining deployment/setup steps. Do not publish or replace production until I approve the tested build.

## Prompt 2 — one visible refinement

Add a small host-side summary of the submitted nominations: how many people nominated each restaurant, updating as nominations arrive. Preserve hidden votes, host permissions and the existing scoring. Verify that merging duplicate nominations updates the counts. Show me the result before publishing.

## Prompt 3 — publish the reviewed build

Run the relevant checks, summarize the final changes, and publish this reviewed version through the dinner-on-sazz repository and its connected Vercel project. Preserve all private environment variables and existing session data. Verify deployment status if available; otherwise show me exactly where to verify it in Vercel. Give me the app URL and the steps to create a fresh host session and copy the participant link. Never claim deployment or multi-device testing succeeded unless it was checked.
