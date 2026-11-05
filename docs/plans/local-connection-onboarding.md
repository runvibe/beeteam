# Local connection onboarding

## Approved scope

Improve the disconnected application's actions and explain the connection to the local Bee Team service. The user approved planning, parallel workers, implementation and publication on November 5, 2026.

## Implementation

1. **Application worker:** align the installation link and retry button using shared button styling, including wrapping on mobile. Installation opens the localized public installation guide, not the landing page. Add a translated “Can't connect” link to the local connection guide. Preserve polling, retries and the version gate.
2. **Documentation worker:** publish `/guide/local-connection` and `/pt/guide/local-connection`, linked from the guide navigation. Explain why the hosted interface needs the service running on the same computer, then describe starting it, verifying the API, granting browser permission and retrying. Include exactly three troubleshooting cases: app not running, browser permission, and incorrect port. Verify commands and configuration against the actual application.
3. **Integration:** review EN/PT text, accessible links, responsive alignment and routing. Run focused tests, application/site builds, Worker packaging checks and browser inspection.
4. **Publication:** commit each repository separately, review the pull requests, wait for CI, merge to main, then verify Cloudflare publication and public URLs.

## Routes and acceptance

- Installation: `https://getbee.team/guide/installation`, or `/pt/guide/installation` in Portuguese.
- Connection help: `https://getbee.team/guide/local-connection`, or `/pt/guide/local-connection` in Portuguese.
- Help remains available when the local API cannot be reached, without making local business-data requests.
- Explain default port `59865`, `/health` and `/api/v1/info`, and distinguish service response from panel/API version compatibility.
- Do not claim the browser exposes a precise failure cause when it does not. Do not recommend disabling browser security or changing unrelated services/data.
- Keep exactly three troubleshooting cases. Preserve existing API, CORS, persistence and PWA update policies.

## Tracking

- Parent task: `01a1ad6c-aab3-7911-a322-88e238a36e85`.
- Frontend task: `01a1ad6d-93c1-7c71-a325-3b6fa89fdf4b`.
- Documentation task: `01a1ad6d-9739-7761-8b3f-6d6a555a4e21`.
- The integrated plan is also recorded in the parent task's Plans tab.
