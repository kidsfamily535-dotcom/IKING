import {createClient} from '@supabase/supabase-js';
// مفتاح عام (publishable) مسموح بوجوده في المتصفح. لا تضع أبدًا مفتاح service_role هنا.
export const sb=createClient(import.meta.env.VITE_SUPABASE_URL??'https://yiklciblxwymcxxszkty.supabase.co',import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??'sb_publishable_RS0irv5OzcD1Z2VHLD-gzQ_4-wYez8_');
