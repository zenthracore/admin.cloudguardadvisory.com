> Security update: see [SECURITY-HARDENING.md](../../SECURITY-HARDENING.md). Login now uses expiring HttpOnly sessions; earlier token-storage notes below describe the redesign stage and are superseded. Backend and admin must deploy together.

# Unified ZenthraCore Operations Desk

One deployed admin frontend, built from this directory, manages all three public websites. `zen.gateway/nginx.conf` routes the shared admin and public `/api/` requests to `zen_backend` on port 8088. EU and UA compose files deploy only their public frontends. The historical regional admin/server directories are not used by these compose deployments.

Existing entry point: `https://admin.cloudguardadvisory.com`; `https://admin.zenthracore.com` redirects there. Domain/certificate routing has not been changed by the redesign.

## Connected workflows

- Verify a shared admin token; credential is kept in React memory and removed from the old localStorage key. Reload requires sign-in.
- List all inquiries, filter by source market/status and search company/contact/email.
- Read brief data, open/copy brief link, download an available PDF.
- Explicitly confirm sending an email or syncing Jira from a lead.
- Create/update/delete journal entries, including language and publishing destinations. New entries default to drafts; destructive actions require confirmation.
- Metrics are computed from loaded API records. Failed requests produce errors rather than fake live statistics.
- Integration screen describes actual backend configuration; it does not pretend to save credentials or wallets locally.

## Development and QA

`npm run dev` runs on port 3001, proxying `/api` to BACKEND_URL (default localhost:8088). `npm run build` produces the production bundle.

`qa/check.cjs` runs Playwright against localhost:3001 with all API calls mocked. Set PLAYWRIGHT_MODULE and CHROMIUM_PATH if needed. It tests login, market/search filters, email cancellation, draft payload, mobile layout and session rejection. It never sends a production email or Jira request. Screenshots are synthetic fixtures, not live customer data.

## Review findings and remaining work

1. Old UI advertised a default token on the login screen; removed. **Backend/compose still have a predictable development token fallback.** Ensure ADMIN_TOKEN is overridden with a strong secret in deployment. Runtime production values were not inspected. Removing that fallback requires a coordinated environment change, not a claim that this UI redesign fixes server authentication.
2. Shared-token authentication has no individual accounts, role separation, expiry or per-user audit trail in the inspected middleware. Memory-only storage reduces persistence but is not equivalent to an HttpOnly session.
3. Mailgun/Jira/crypto settings previously wrote localStorage only. Their API configuration is server-side; no settings CRUD endpoint exists. Those fake controls have been replaced by an explicit capability screen.
4. The three source copies had diverged. Only this frontend is active in gateway/compose routing; archived regional copies must not be redeployed as independent desks.
5. Wildcard CORS exists in the backend. It is not itself an authentication bypass, but should be reviewed with the eventual session architecture.
6. Live secrets, deployment, delivery and Jira health were not tested. UI/browser tests use fixtures. No deployment, customer messaging or data migration performed.
