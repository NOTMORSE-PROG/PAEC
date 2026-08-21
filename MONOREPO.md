# PAEC monorepo

This branch keeps the learner application at `/` and imports the admin
application under `corpus-admin/`.

The original admin repository remains the authoritative history and rollback
source. This branch imports its latest committed tree as a clean
synchronization snapshot.

- Canonical GitHub URL: https://github.com/NOTMORSE-PROG/PAEC
- Admin history and rollback source: https://github.com/NOTMORSE-PROG/PAEC_ADMIN
- Learner Vercel project: `paec-corpus`
- Learner production alias: https://corpusbasedsystem.vercel.app
- Admin Vercel project: `paec-admin`
- Admin production alias: https://corpus-admin.vercel.app

The learner Vercel project remains rooted at `/`. The existing admin Vercel
project must keep its domains and environment variables and use
`corpus-admin/` as its root directory only at the staged source cutover.
Neither Vercel project is replaced or renamed.
