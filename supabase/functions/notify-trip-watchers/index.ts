import { createClient } from 'npm:@supabase/supabase-js@2'

// Weather alerts for trips a customer chose to watch (opt-in, per trip).
// Auth is custom (verify_jwt=false on purpose, same as notify-owner): only the internal scheduler secret is accepted (checked in Vault via eye_cron_secret_ok).
// DRY_RUN by default: it logs what it would send and sends nothing. It goes live only when ALL of these are set as function secrets:
//   TRIP_ALERTS_LIVE=true, RESEND_API_KEY, TRIP_ALERTS_FROM (a sender on a domain verified in Resend, never resend.dev), TRIP_ALERTS_SITE_URL (for the unsubscribe link).
// The decision of WHO is due lives in SQL (trip_alert_due): opted in, departs within 36h, an airport is MVFR/IFR/LIFR, worse than last alert, >= 6h since the last one.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const CAT: Record<string, { ar: string; en: string }> = {
  MVFR: { ar: 'رؤية حدّية', en: 'marginal visibility' },
  IFR: { ar: 'رؤية منخفضة', en: 'low visibility' },
  LIFR: { ar: 'رؤية منخفضة جدًا', en: 'very low visibility' },
}
const MAX_PER_RUN = 50

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret) return json({ error: 'unauthorized' }, 401)
  const { data: okSecret } = await db.rpc('eye_cron_secret_ok', { p: cronSecret })
  if (okSecret !== true) return json({ error: 'unauthorized' }, 401)

  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('TRIP_ALERTS_FROM') ?? ''
  const site = (Deno.env.get('TRIP_ALERTS_SITE_URL') ?? '').replace(/\/$/, '')
  const live = Deno.env.get('TRIP_ALERTS_LIVE') === 'true' && !!key && !!from && !from.includes('resend.dev') && !!site
  await db.rpc('trip_alert_set_live', { p_live: live })

  const { data: due, error } = await db.rpc('trip_alert_due')
  if (error) return json({ error: error.message }, 500)
  const list = ((due ?? []) as any[]).slice(0, MAX_PER_RUN)
  if (!list.length) return json({ live, due: 0 })

  const codes = [...new Set(list.flatMap((d) => [d.origin, d.destination]))]
  const { data: aps } = await db.from('airports').select('iata_code,name_ar,name_en').in('iata_code', codes)
  const nameOf = (c: string, lang: 'ar' | 'en') => { const a = (aps ?? []).find((x: any) => x.iata_code === c); return (lang === 'ar' ? a?.name_ar ?? a?.name_en : a?.name_en ?? a?.name_ar) ?? c }

  let sent = 0, dry = 0, failed = 0
  for (const d of list) {
    const { data: prof } = await db.from('profiles').select('preferred_language').eq('id', d.customer_id).maybeSingle()
    const lang: 'ar' | 'en' = prof?.preferred_language === 'ar' ? 'ar' : 'en'
    const ar = lang === 'ar'
    const when = new Date(d.departure_at).toLocaleString(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    const legLine = (l: any) => {
      const place = nameOf(l.code, lang)
      const what = CAT[l.cat]?.[lang] ?? l.cat
      const alt = l.alt ? (ar ? `أقرب مطار رصده سليم الآن: ${l.alt.name_ar ?? l.alt.name_en} على بعد ${l.alt.km} كم.` : `Nearest airport reporting good conditions now: ${l.alt.name_en ?? l.alt.name_ar}, ${l.alt.km} km away.`) : (ar ? 'لا أجد الآن مطارًا قريبًا برصد حديث سليم.' : 'I cannot find a nearby airport with a recent, good report right now.')
      const head = l.leg === 'dep' ? (ar ? `مطار الإقلاع ${place}` : `Departure airport ${place}`) : (ar ? `مطار الوصول ${place}` : `Arrival airport ${place}`)
      return { head: `${head}: ${what}.`, alt }
    }
    const lines = (d.legs as any[]).map(legLine)
    const subject = ar ? `الجو يستحق انتباهك: رحلتك ${nameOf(d.origin, 'ar')} إلى ${nameOf(d.destination, 'ar')}` : `Conditions need your attention: ${nameOf(d.origin, 'en')} to ${nameOf(d.destination, 'en')}`
    const unsub = site ? `${site}/?view=watch&unsub=${d.token}` : ''
    const intro = ar ? `رحلتك المقرر إقلاعها ${when} تحت مراقبتي، ورصدتُ تغيّرًا في الطقس:` : `Your trip departing ${when} is under watch, and I noticed a change in the weather:`
    const foot = ar ? 'هذا رصد رسمي (Aviation Weather Center)، والقرار النهائي للمشغّل والطاقم. وصلتك هذه الرسالة لأنك فعّلت تنبيهات هذه الرحلة.' : 'This is an official report (Aviation Weather Center); the final decision rests with the operator and crew. You get this because you turned on alerts for this trip.'
    const stop = ar ? 'أوقف التنبيهات' : 'Turn off alerts'
    const html = `<div dir="${ar ? 'rtl' : 'ltr'}" style="font:16px/1.8 Tahoma,Arial,sans-serif;max-width:520px;margin:auto;color:#111"><p>${esc(intro)}</p>${lines.map((x) => `<p><b>${esc(x.head)}</b><br>${esc(x.alt)}</p>`).join('')}<p style="color:#666;font-size:13px">${esc(foot)}</p>${unsub ? `<p style="font-size:13px"><a href="${esc(unsub)}">${esc(stop)}</a></p>` : ''}</div>`

    if (!live) {
      // privacy: the log keeps what would be sent, never the customer's email address
      await db.rpc('trip_alert_mark', { p_trip_id: d.trip_id, p_customer: d.customer_id, p_cat: d.worst, p_mode: 'DRY_RUN', p_payload: { subject, lines, lang }, p_error: null })
      dry++; continue
    }
    const { data: u } = await db.auth.admin.getUserById(d.customer_id)
    const to = u?.user?.email
    if (!to) { await db.rpc('trip_alert_mark', { p_trip_id: d.trip_id, p_customer: d.customer_id, p_cat: d.worst, p_mode: 'FAILED', p_payload: null, p_error: 'no email on account' }); failed++; continue }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, headers: { 'List-Unsubscribe': `<${unsub}>` } }),
      })
      if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
      await db.rpc('trip_alert_mark', { p_trip_id: d.trip_id, p_customer: d.customer_id, p_cat: d.worst, p_mode: 'SENT', p_payload: { subject, lang }, p_error: null })
      sent++
    } catch (e) {
      await db.rpc('trip_alert_mark', { p_trip_id: d.trip_id, p_customer: d.customer_id, p_cat: d.worst, p_mode: 'FAILED', p_payload: null, p_error: String((e as Error).message).slice(0, 300) })
      failed++
    }
  }
  return json({ live, due: list.length, sent, dry, failed })
})
