// Supabase Edge Function: elimina la cuenta del cliente que la llama.
// Desplegar con:  supabase functions deploy delete-account
// Usa la service_role key que Supabase inyecta en el servidor; NUNCA va en el codigo del sitio.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Identifica al usuario con SU token (no se puede borrar a otra persona).
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sesión no válida' }, 401);

    const admin = createClient(url, serviceKey);
    const now = new Date().toISOString();

    // 2. Cancela citas activas y anonimiza el historial (se conserva sin nombre ni contacto).
    const { error: cancelError } = await admin.from('appointments')
        .update({ status: 'CANCELADA', canceled_by_client: true, canceled_at: now, cancellation_alert_seen_by: [] })
        .eq('client_id', user.id).in('status', ['PENDIENTE', 'APROBADA']);
    if (cancelError) return json({ error: cancelError.message }, 500);

    const { error: anonError } = await admin.from('appointments')
        .update({ client_name: 'Cuenta eliminada', client_email: '', vip_details: null, client_id: null })
        .eq('client_id', user.id);
    if (anonError) return json({ error: anonError.message }, 500);

    await admin.from('reviews').update({ client_name: 'Cliente', client_id: null }).eq('client_id', user.id);
    await admin.from('memos').delete().eq('client_id', user.id);

    // 3. Borra el usuario de Auth (el perfil se borra en cascada).
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ ok: true });
});
