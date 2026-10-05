import { createClient } from 'npm:@supabase/supabase-js@2'

// Auth is custom (verify_jwt=false on purpose): either the internal scheduler secret (checked against Vault
// through eye_cron_secret_ok) or a signed-in active admin/broker. Anything else gets 401/403.
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const n = (v: unknown) => Number(v ?? 0)

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const mode = new URL(req.url).searchParams.get('mode') === 'digest' ? 'digest' : 'alerts'

  let recipients: string[] = []
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret) {
    const { data: ok } = await db.rpc('eye_cron_secret_ok', { p: cronSecret })
    if (ok !== true) return json({ error: 'unauthorized' }, 401)
    const { data: admins } = await db.from('profiles').select('email').eq('role', 'admin').eq('status', 'active')
    recipients = (admins ?? []).map((a: any) => a.email).filter(Boolean)
  } else {
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: u } = await caller.auth.getUser()
    if (!u?.user?.email) return json({ error: 'unauthorized' }, 401)
    const { data: prof } = await db.from('profiles').select('role,status').eq('id', u.user.id).maybeSingle()
    if (!prof || prof.status !== 'active' || !['admin', 'broker'].includes(prof.role)) return json({ error: 'forbidden' }, 403)
    recipients = [u.user.email]
  }
  if (!recipients.length) return json({ error: 'no_recipients' }, 500)

  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return json({ error: 'RESEND_API_KEY missing' }, 500)

  const send = (subject: string, html: string) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: "King's Eye <onboarding@resend.dev>", to: recipients, subject, html }),
    })

  // Opportunities waiting for a human decision (used by both modes)
  const { data: opps, error: oppErr } = await db
    .from('opportunities')
    .select('id,origin_code,destination_code,trigger_type,score,detect_reason,aircraft_availability(seats,departure_from,is_demo)')
    .eq('status', 'ACTIVATION_PENDING')
  if (oppErr) return json({ error: oppErr.message }, 500)

  const oppRow = (o: any) => {
    const a = o.aircraft_availability
    const demo = a?.is_demo ? ' [SIMULATION]' : ''
    const hrs = o.detect_reason?.hours_to_departure
    return `<tr><td><b>${esc(o.origin_code)} → ${esc(o.destination_code)}</b>${demo}</td><td>${esc(o.trigger_type)}</td><td>score ${esc(o.score)}</td><td>${esc(a?.seats)} seats</td><td>${hrs != null ? 'departs in ~' + esc(hrs) + ' h' : ''}</td></tr>`
  }

  if (mode === 'alerts') {
    const { data: done } = await db.from('owner_alerts').select('opportunity_id')
    const seen = new Set((done ?? []).map((d: any) => d.opportunity_id))
    const fresh = (opps ?? []).filter((o: any) => !seen.has(o.id))
    if (!fresh.length) return json({ sent: 0, note: 'no new opportunities' })
    const allDemo = fresh.every((o: any) => o.aircraft_availability?.is_demo)
    const html = `<div dir="ltr" style="font-family:system-ui;color:#111"><h3>THE KING'S EYE — ${fresh.length} opportunity(ies) awaiting your approval</h3><table cellpadding="6" style="border-collapse:collapse">${fresh.map(oppRow).join('')}</table><p style="color:#555">Nothing was sent to any customer. Open the Watch Room to approve or reject. Availability is operator-confirmed only.</p></div>`
    const r = await send(`${allDemo ? '[SIMULATION] ' : ''}${fresh.length} new opportunity(ies) awaiting approval`, html)
    if (!r.ok) return json({ error: 'email_failed', status: r.status }, 502)
    await db.from('owner_alerts').insert(fresh.map((o: any) => ({ opportunity_id: o.id, channel: 'email', status: 'SENT' })))
    return json({ sent: fresh.length })
  }

  // ---- digest: what the three eyes saw (Arabic, plain wording) ----
  const { data: d, error: dErr } = await db.rpc('eye_digest')
  if (dErr || !d) return json({ error: 'digest_failed', detail: dErr?.message }, 500)
  const f = d.flight ?? {}, w = d.journey ?? {}, dm = d.demand ?? {}, op = d.opportunities ?? {}, sy = d.system ?? {}

  const warns: string[] = []
  if (f.minutes_since_last_sighting == null || n(f.minutes_since_last_sighting) > 30) warns.push(`عين الطيران: آخر رصد منذ ${f.minutes_since_last_sighting ?? '؟'} دقيقة (والمفترض كل بضع دقائق)`)
  if (w.minutes_since_weather == null || n(w.minutes_since_weather) > 60) warns.push(`عين الرحلة: آخر تحديث للطقس منذ ${w.minutes_since_weather ?? '؟'} دقيقة`)
  if (n(sy.cron_failed_24h) > 0) warns.push(`ثمّة ${n(sy.cron_failed_24h)} مهمة مجدولة أخفقت خلال آخر 24 ساعة`)
  if (n(f.fetch_failed_24h) > 0) warns.push(`أخفق رصد الطائرات ${n(f.fetch_failed_24h)} مرة خلال آخر 24 ساعة`)

  const list = (a: unknown) => (Array.isArray(a) && a.length ? a.slice(0, 12).map(esc).join(' ، ') : 'لا يوجد')
  const grades = Object.entries(dm.by_grade ?? {}).map(([g, c]) => `${esc(g)}: ${esc(c)}`).join(' ، ') || '—'
  const pending = (opps ?? []) as any[]
  const html = `<div dir="rtl" style="font-family:system-ui,Tahoma,sans-serif;color:#111;line-height:1.8;max-width:640px">
<h2 style="margin:0">THE KING'S EYE — تقرير العيون</h2>
<p style="color:#555;margin-top:4px">آخر 24 ساعة. الأرقام مستمدّة من بيانات حقيقية، أما الفرص الحالية فتجريبية.</p>
${warns.length ? `<div style="background:#fff4e5;border:1px solid #e6a23c;padding:10px"><b>تنبيهات النظام:</b><ul>${warns.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<p>✅ جميع المهام تعمل على نحو طبيعي.</p>'}
<h3>1) عين الطيران</h3>
<ul><li>${esc(n(f.sightings_24h))} رصد لـ ${esc(n(f.distinct_aircraft_24h))} طائرة مختلفة</li>
<li>رحلات مستنتجة: ${esc(n(f.legs_24h))} اليوم (الإجمالي ${esc(n(f.legs_total))})</li>
<li>الرصد: ${esc(n(f.fetch_ok_24h))} نجح، ${esc(n(f.fetch_failed_24h))} أخفق</li>
<li style="color:#555">الطائرة المرصودة لا تعني أنها متاحة، والتوافر يؤكده المشغّل وحده.</li></ul>
<h3>2) عين الرحلة (الطقس)</h3>
<ul><li>مطارات طقسها IFR أو أسوأ: ${list(w.ifr_or_worse)}</li>
<li>مطارات تبلغ رياحها 25 عقدة أو أكثر: ${list(w.strong_wind_25kt)}</li></ul>
<h3>3) عين الطلب</h3>
<ul><li>إشارات طلب نشطة: ${esc(n(dm.active))} (الدرجة: ${grades}). الدرجة D تعني إشارة ضعيفة.</li>
${(dm.latest_titles ?? []).map((t: string) => `<li dir="ltr" style="text-align:left">${esc(t)}</li>`).join('')}</ul>
<h3>الفرص</h3>
<p>بانتظار موافقتك: <b>${esc(n(op.awaiting_approval))}</b> — محققة: ${esc(n(op.validated))} — منتهية: ${esc(n(op.expired))}</p>
${pending.length ? `<table cellpadding="6" dir="ltr" style="border-collapse:collapse">${pending.map(oppRow).join('')}</table>` : ''}
<p style="color:#555">لم يُرسَل شيء إلى أي عميل، وكل إرسال بانتظار موافقتك.</p></div>`

  const r = await send(`THE KING'S EYE — تقرير العيون${warns.length ? ' ⚠️' : ''}`, html)
  if (!r.ok) return json({ error: 'email_failed', status: r.status }, 502)
  return json({ sent: 'digest', warnings: warns.length })
})
