/**
 * Auth off while Anna is still on the fixed local owner id.
 * Set Vercel env VITE_AUTH_DISABLED=false after creating Anna's Supabase Auth user
 * and pointing data at her auth UUID, then run close_dev_open_access.sql.
 */
export const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED !== "false";

/** Stable UUID used as owner_id while auth is off. */
export const LOCAL_OWNER_ID = "a1111111-1111-4111-8111-111111111111";
