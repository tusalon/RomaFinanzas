import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    }
  });
}

function allowedOrigin(requestOrigin: string) {
  const configured = (Deno.env.get('ROMA_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!configured.length) return '';
  return configured.includes(requestOrigin) ? requestOrigin : '';
}

function readDefaultSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return keys.default || '';
  } catch {
    return '';
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  const responseOrigin = allowedOrigin(origin);

  if (!responseOrigin) return json({ error: 'Origen no permitido.' }, 403, 'null');
  if (request.method === 'OPTIONS') return json({ ok: true }, 200, responseOrigin);
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido.' }, 405, responseOrigin);

  try {
    const payload = await request.json();
    const action = String(payload?.action || 'login');
    const slug = String(payload?.slug || '')
      .trim()
      .toLowerCase()
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    // El login actual de RservasRoma elimina espacios accidentales al inicio
    // y al final antes de comprobar el hash bcrypt. Conservamos exactamente
    // ese comportamiento para que las mismas credenciales den el mismo resultado.
    const password = String(payload?.password || '').trim();

    const sourceUrl = Deno.env.get('RSERVASROMA_SUPABASE_URL') || '';
    const sourceKey = Deno.env.get('RSERVASROMA_SUPABASE_ANON_KEY') || '';
    const targetUrl = Deno.env.get('SUPABASE_URL') || '';
    const targetSecret = readDefaultSecretKey();

    if (!sourceUrl || !sourceKey || !targetUrl || !targetSecret) {
      return json({ error: 'La integracion de acceso no esta configurada.' }, 503, responseOrigin);
    }

    const source = createClient(sourceUrl, sourceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const target = createClient(targetUrl, targetSecret, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    if (action === 'load-business-data') {
      const token = String(payload?.token || '').trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        return json({ error: 'La sesion de Roma Finanzas no es valida.' }, 401, responseOrigin);
      }

      const { data: resumeData, error: resumeError } = await target.rpc(
        'resume_roma_finanzas_session',
        { p_token: token }
      );
      const resume = Array.isArray(resumeData) ? resumeData[0] : resumeData;
      const targetBusinessId = String(resume?.business?.id || '');

      if (resumeError || !targetBusinessId) {
        return json({ error: 'La sesion de Roma Finanzas vencio. Entra nuevamente.' }, 401, responseOrigin);
      }

      const { data: targetBusiness, error: targetBusinessError } = await target
        .from('negocios')
        .select('external_negocio_id,slug')
        .eq('id', targetBusinessId)
        .maybeSingle();

      if (targetBusinessError || !targetBusiness?.external_negocio_id) {
        return json({ error: 'El negocio no esta enlazado con RservasRoma.' }, 409, responseOrigin);
      }

      const externalBusinessId = String(targetBusiness.external_negocio_id);
      const [servicesResponse, bookingsResponse] = await Promise.all([
        source
          .from('servicios')
          .select('id,nombre,categoria,precio,precio_moneda,duracion,activo')
          .eq('negocio_id', externalBusinessId)
          .order('id', { ascending: true }),
        source
          .from('reservas')
          .select('id,fecha,cliente_nombre,servicio,estado,monto_cobrado,precio_final,precio_original')
          .eq('negocio_id', externalBusinessId)
          .eq('estado', 'Completado')
          .order('fecha', { ascending: false })
          .limit(2000)
      ]);

      if (servicesResponse.error || bookingsResponse.error) {
        console.error('RservasRoma business data error', {
          servicesCode: servicesResponse.error?.code,
          bookingsCode: bookingsResponse.error?.code
        });
        return json({ error: 'No pudimos cargar los servicios y citas de RservasRoma.' }, 502, responseOrigin);
      }

      return json({
        catalog_services: servicesResponse.data || [],
        completed_bookings: bookingsResponse.data || []
      }, 200, responseOrigin);
    }

    if (action !== 'login') {
      return json({ error: 'Accion no permitida.' }, 400, responseOrigin);
    }

    if (!slug || slug.length > 128 || !password || password.length > 512) {
      return json({ error: 'Escribe el slug y la contrasena de RservasRoma.' }, 400, responseOrigin);
    }

    const { data: identity, error: identityError } = await source.rpc(
      'verify_roma_finanzas_identity',
      { p_slug: slug, p_password: password }
    );

    if (identityError) {
      const providerMessage = String(identityError.message || '').toLowerCase();
      if (providerMessage.includes('no tiene acceso activo')) {
        return json({ error: 'Tu negocio no tiene acceso activo a Roma Finanzas.' }, 403, responseOrigin);
      }
      if (providerMessage.includes('demasiados intentos')) {
        return json({ error: 'Demasiados intentos. Espera 15 minutos y prueba otra vez.' }, 429, responseOrigin);
      }

      console.error('RservasRoma identity provider error', {
        code: identityError.code,
        message: identityError.message
      });
      return json({
        error: 'No pudimos consultar RservasRoma. Revisa la clave de conexion de la integracion.'
      }, 502, responseOrigin);
    }

    if (!identity || identity.ok !== true) {
      return json({ error: 'Slug o contrasena incorrectos.' }, 401, responseOrigin);
    }

    const { data: session, error: sessionError } = await target.rpc(
      'create_federated_roma_finanzas_session',
      { p_identity: identity }
    );

    if (sessionError || !session?.token || !session?.business) {
      return json({ error: 'No se pudo abrir Roma Finanzas. Intenta de nuevo.' }, 503, responseOrigin);
    }

    return json({
      token: session.token,
      expires_at: session.expires_at,
      business: session.business
    }, 200, responseOrigin);
  } catch {
    return json({ error: 'No se pudo conectar con RservasRoma.' }, 503, responseOrigin);
  }
});
