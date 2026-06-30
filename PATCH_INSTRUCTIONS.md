# v1.0 Write-Enabled Patch Instructions

This patch is intended to overlay the previous `0.4.6` project.

## Apply

1. Stop the development server.
2. Back up your current project folder and `.env.local`.
3. Extract this patch into the project root, allowing files to be replaced.
4. Remove old build output if present:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue
```

5. Install dependencies and validate:

```powershell
npm install
npm run typecheck
npm run test
npm run lint
npm run build
```

6. Start the app:

```powershell
npm run dev
```

## Environment

Keep your existing `.env.local`. The app no longer uses any `CCB_ENABLE_*` flags.

Supported CCB create/update writes are active whenever the configured CCB API user has permission for the relevant service. CCB delete/remove/inactivate/deactivate operations are blocked in code.

## Database

Run any migrations you have not already applied from:

```txt
supabase/migrations/
```

There is no new v1.0-only migration beyond the existing `0001` through `0004` migration set.
