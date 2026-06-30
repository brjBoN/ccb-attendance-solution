# Upgrade to v1.1 — Permissions and CCB Checklist

## 1. Back up

Copy your current project folder and `.env.local` before replacing files.

## 2. Apply files

Either use the full v1.1 project or extract the patch over the v1.0 write-enabled project.

Do not replace your existing `.env.local`.

## 3. Run the required migration

In Supabase SQL Editor, run the complete contents of:

```txt
supabase/migrations/0005_permissions_and_ccb_checklist.sql
```

This must be completed before starting v1.1 because login now reads `admin_users.ccb_individual_id`.

## 4. Install and validate

```powershell
npm install
npm run typecheck
npm run test
npm run lint
npm run dev
```

## 5. Configure permissions

Sign in as an existing Owner/Admin and open:

```txt
http://localhost:3000/admin/permissions
```

For each user:

1. Choose a role.
2. Enter the person's CCB individual ID when they are a Group Manager or Group Leader.
3. Click Save.

Existing `owner`, `admin`, and `leader` roles remain valid. Assign `group_manager` to the new role that can create/edit groups but cannot access guests, permissions, or the checklist.

## 6. Refresh existing group leader mappings

For existing groups:

1. Open **Groups**.
2. Search the group in CCB.
3. Click **Update mapping**.

The server reads the main leader ID directly from CCB; it does not trust a client-supplied leader ID.

## 7. Initialize old checklists

Open:

```txt
/admin/checklist
```

For mappings created before v1.1, click **Create checklist**.
