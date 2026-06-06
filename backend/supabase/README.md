# Supabase configuration

The `orghub-storage` Edge Function brokers private Storage operations for the
Django backend. Before deploying it from this repository, configure the shared
server-side secret:

```bash
supabase secrets set ORGHUB_STORAGE_KEY=<same value as SUPABASE_STORAGE_FUNCTION_SECRET>
supabase functions deploy orghub-storage --no-verify-jwt
```

The `orghub-documents` bucket must remain private. Django authorization protects
document access before issuing a short-lived signed Storage URL.
