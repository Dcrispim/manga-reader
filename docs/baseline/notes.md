# Notes

## M1-03 Move the Next.js server into apps/server

- `scripts/upscale-worker.mjs` was moved to `apps/server/scripts/upscale-worker.mjs` to preserve git history via `git mv`.
- Comment in `apps/server/src/services/upscale.ts` line 23 still references the old path (`scripts/upscale-worker.mjs`), but this is just a documentation comment and does not affect functionality (the actual location is used at runtime via `UPSCALE_WORKER_URL` environment variable).
- `docker-compose.yml` was not modified (hard constraint) and contains a comment referencing the old path structure; this is documented here for reference.
