# StoreFront Step 21

Final security / production-hardening milestone.

1. Run `STEP21-SQL.sql`
2. Upload website files while preserving your working `js/config.js`
3. Open Admin → Security Audit and run the live checks
4. Follow `STEP21-SECURITY.md`

No Edge Function redeployment and no new secrets are required.

Main changes:
- hardened PostgreSQL function privileges/search paths
- profile role-change defense-in-depth
- customer order-update defense-in-depth
- stored HTML sanitization
- safe external URL handling
- admin live security audit
- referrer-policy hardening
