# Push Notifications Setup

## VAPID Keys (generated 2026-04-12)

```
PUBLIC:  BD7ly6__W92jUNdvGE33vtXyyd7GXji3gPCTrw7bkgR1IVSBEL0mSwtxwsanocB_rR2x24Pp6pKyIiEKL30VlOU
PRIVATE: wAg1N8Q0pdu6q-hqF8aaFMgreXQdvPgk69aoNHMRiNU
```

Public key is hardcoded in `services/pushService.ts` (it's safe to expose).
Private key MUST stay server-side only.

## Vercel environment variables

Add these in Vercel → Project → Settings → Environment Variables:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BD7ly6__W92jUNdvGE33vtXyyd7GXji3gPCTrw7bkgR1IVSBEL0mSwtxwsanocB_rR2x24Pp6pKyIiEKL30VlOU` |
| `VAPID_PRIVATE_KEY` | `wAg1N8Q0pdu6q-hqF8aaFMgreXQdvPgk69aoNHMRiNU` |
| `VAPID_SUBJECT` | `mailto:luna@wadeos.app` (any mailto: or https:// URL identifying you) |

After adding them, redeploy so the API route picks them up.

## Supabase migration

Apply `supabase/migrations/20260412_push_subscriptions.sql` in the Supabase SQL editor.

## How Luna installs WadeOS as a PWA on iPhone

1. Open https://wadeos.vercel.app in **Safari** (must be Safari, not Chrome)
2. Tap the share button (square with arrow up) at the bottom
3. Scroll down → **Add to Home Screen**
4. Tap Add — WadeOS icon appears on home screen
5. **Open WadeOS from the home screen icon** (not from Safari)
6. Go to Settings → Push Notifications → tap "Enable"
7. Allow notifications when iOS asks

iOS only delivers Web Push to PWAs that are installed to the home screen.
Safari tabs can never receive push.
