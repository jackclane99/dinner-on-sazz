# Dry run before the session

## First acceptance run: use separate browsers

1. Wait for Vercel to show Ready. Open the app, create a host session, and keep that tab open.
2. Copy the participant link. Open it in an incognito window as Alice and in a second browser/profile as Bob. Separate tabs in one browser share a participant identity and are not independent people.
3. Nominate two different restaurants. Check the host sees both. Edit one nomination; confirm it changes on the host screen without refreshing.
4. Refresh a participant’s browser. Confirm the name and nomination persist. Test a duplicate nomination, then change it back so there are two different choices.
5. Open voting. Confirm both participant screens advance within a few seconds. A new unjoined browser should no longer be able to join.
6. Look up one restaurant using its Google link; verify that the query contains its submitted name plus Chicago and that your ballot stays intact.
7. As Alice, submit scores 5 and 3. As Bob, submit scores 3 and 5. Verify the host sees submission status only. Alice should not see Bob’s scores.
8. Edit Alice’s scores to 4 and 3, and resubmit. The host count remains two ballots, not three.
9. Reveal. Both participant screens should advance. The second restaurant’s average is 4.0, the first’s is 3.5. Expand the results to see individual scores.
10. Refresh results in both browsers. They must remain identical. Submitting another vote after the reveal must fail.
11. Use Start a fresh dinner on the host screen for another test. Confirm the earlier results are still accessible from their original link.
12. Check the participant link on the actual meeting laptop/phone and network. Check deployment protection/sign-in requirements before sharing.

## Second run: edge cases

- Merge two spelling variants before opening voting; everyone should be voting on the same restaurant IDs.
- Attempt an incomplete ballot: it must not submit.
- Reveal with a missing voter: the host must see their name and explicitly confirm. Their incomplete ballot must not count.
- Give equal totals with different numbers of 5s: the restaurant with more 5s wins. Give identical totals and 5 counts: show a tie.
- Turn a participant’s internet connection off temporarily: show a clear connection message; reconnect and retry without duplicating their identity or ballot.
- Open the host URL in a browser without the host credentials: no host controls should appear.

## Presentation flow (after the infrastructure is already connected)

Introduce honestly: “I’ve set up the hosting and shared database ahead of time. We’re using Codex to build the app and test it, then we’ll use it together.”

1. Explain the prompt and three phases (1 minute).
2. Run the rehearsed build; while it works, explain the shared-data setup (variable build time).
3. Make one small visible change using the second prompt.
4. Verify/deploy the build, create a **fresh** session, share the participant link.
5. Nominate, give a short verbal introduction to each restaurant, rate, and reveal (3–5 minutes).
6. Connect to consulting: “We supplied the criteria and decision rules. The tool collected everyone’s inputs, calculated consistently, and exposed differences for discussion.”

Keep a known-working deployment and a spare fresh host session ready. Do not reset or overwrite the working fallback during a live build. Building is variable, so rehearse with a stopwatch and switch to the fallback when necessary. Never promise an exact build duration or an identical generated layout.
