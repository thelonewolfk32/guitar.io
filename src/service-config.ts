// Public project URL/key only. Billing, signing and service-role keys belong on the server.
const env=(import.meta as any).env || {};
export const serviceConfig={url:env.VITE_SUPABASE_URL || '',key:env.VITE_SUPABASE_PUBLISHABLE_KEY || '',enabled:env.VITE_ACCOUNTS_ENABLED==='true'||env.VITE_MONETISATION_ENABLED==='true'};
export function servicesReady(){return serviceConfig.enabled&&/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(serviceConfig.url)&&!!serviceConfig.key;}
