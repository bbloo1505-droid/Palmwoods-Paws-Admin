/**
 * Auth is ON by default.
 * Set VITE_AUTH_DISABLED=true only for local emergency bypass.
 */
export const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === "true";

/**
 * Stable UUID used as Anna's owner_id.
 * Bootstrap creates her Supabase Auth user with this same id so CRM data stays linked.
 */
export const LOCAL_OWNER_ID = "a1111111-1111-4111-8111-111111111111";

export const ANNA_LOGIN_EMAIL = "contact@palmwoodspaws.com";
