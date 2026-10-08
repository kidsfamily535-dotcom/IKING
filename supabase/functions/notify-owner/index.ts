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
  const m = new URL(req.url).searchParams.get('mode')
  const mode = m === 'digest' ? 'digest' : m === 'events' ? 'events' : 'alerts'

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

  // ---- events: verified (2 sources) events starting within 14 days with ZERO operator-confirmed supply ----
  if (mode === 'events') {
    const { data: due, error: dueErr } = await db.rpc('eye_event_alerts_due')
    if (dueErr) return json({ error: 'events_failed', detail: dueErr.message }, 500)
    const list = (Array.isArray(due) ? due : []) as any[]
    if (!list.length) return json({ sent: 0, note: 'no events due' })
    const rows = list.map((e) => `<tr><td><b>${esc(e.title_ar || e.title)}</b><br><span style="color:#555" dir="ltr">${esc(e.title)}</span></td><td>${esc(e.city)}</td><td dir="ltr">${esc(e.starts_on)}<br>بعد ${esc(e.days_until)} يوم</td><td>${esc(n(e.confirmed_availability))}</td><td>${esc(n(e.tracked_aircraft_near_24h))}</td><td>${esc(n(e.open_requests))}</td></tr>`).join('')
    const html = `<div dir="rtl" style="font-family:system-ui,Tahoma,sans-serif;color:#111;line-height:1.8;max-width:680px">
<h2 style="margin:0">THE KING'S EYE — فعاليات قريبة وعرضها المؤكد صفر</h2>
<p style="color:#555;margin-top:4px">فعاليات موثّقة بمصدرين مستقلين، وتبدأ خلال 14 يومًا، ومفيش أي مشغّل أكّد إتاحة لوجهتها.</p>
<table cellpadding="6" border="1" style="border-collapse:collapse;border-color:#ddd"><tr style="background:#f6f6f6"><td>الفعالية</td><td>المدينة</td><td>تبدأ</td><td>إتاحة مؤكدة</td><td>طائرات مرصودة (استنتاج)</td><td>طلبات مفتوحة</td></tr>${rows}</table>
<p>الخطوة المقترحة: كلّم مشغّلًا ينشر إتاحته لهذه الوجهة قبل بداية الفعالية.</p>
<p style="color:#555">الفعالية حقيقة تقويمية من مصادر عامة، وليست طلبًا مؤكدًا. الطائرات المرصودة استنتاج ولا تعني التوافر. مفيش حاجة اتبعتت لأي عميل أو مشغّل.</p></div>`
    const r = await send(`فعاليات قريبة بدون عرض مؤكد (${list.length})`, html)
    if (!r.ok) return json({ error: 'email_failed', status: r.status }, 502)
    await db.from('event_alerts_sent').upsert(list.map((e) => ({ event_id: e.id, band: e.band })), { onConflict: 'event_id,band', ignoreDuplicates: true })
    return json({ sent: list.length })
  }

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
  if (f.minutes_since_last_sighting == null || n(f.minutes_since_last_sighting) > 30) warns.push(`عين الطيران: آخر رصد من ${f.minutes_since_last_sighting ?? '؟'} دقيقة (المفروض كل بضع دقايق)`)
  if (w.minutes_since_weather == null || n(w.minutes_since_weather) > 60) warns.push(`عين الرحلة: آخر تحديث للطقس من ${w.minutes_since_weather ?? '؟'} دقيقة`)
  if (n(sy.cron_failed_24h) > 0) warns.push(`فيه ${n(sy.cron_failed_24h)} مهمة مجدولة فشلت في آخر 24 ساعة`)
  if (n(f.fetch_failed_24h) > 0) warns.push(`رصد الطيارات فشل ${n(f.fetch_failed_24h)} مرة في آخر 24 ساعة`)

  const list = (a: unknown) => (Array.isArray(a) && a.length ? a.slice(0, 12).map(esc).join(' ، ') : 'لا يوجد')
  const grades = Object.entries(dm.by_grade ?? {}).map(([g, c]) => `${esc(g)}: ${esc(c)}`).join(' ، ') || '—'
  const pending = (opps ?? []) as any[]
  const { data: newLeads } = await db.from('trip_leads').select('origin_code,destination_code,travel_date,passengers,created_at').eq('status', 'NEW').order('created_at', { ascending: false }).limit(20)
  const leads = (newLeads ?? []) as any[]
  const html = `<div dir="rtl" style="font-family:system-ui,Tahoma,sans-serif;color:#111;line-height:1.8;max-width:640px">
<h2 style="margin:0">THE KING'S EYE — تقرير العيون</h2>
<p style="color:#555;margin-top:4px">آخر 24 ساعة. الأرقام دي من بيانات حقيقية، لكن الفرص الحالية تجريبية.</p>
${warns.length ? `<div style="background:#fff4e5;border:1px solid #e6a23c;padding:10px"><b>تنبيهات النظام:</b><ul>${warns.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<p>✅ كل المهام شغالة بشكل طبيعي.</p>'}
<h3>1) عين الطيران</h3>
<ul><li>${esc(n(f.sightings_24h))} رصد لـ ${esc(n(f.distinct_aircraft_24h))} طيارة مختلفة</li>
<li>رحلات اتستنتجت: ${esc(n(f.legs_24h))} اليوم (الإجمالي ${esc(n(f.legs_total))})</li>
<li>الرصد: ${esc(n(f.fetch_ok_24h))} نجح، ${esc(n(f.fetch_failed_24h))} فشل</li>
<li style="color:#555">الطيارة اللي اتشافت مش معناها متاحة. التوافر بيتأكد من المشغّل بس.</li></ul>
<h3>2) عين الرحلة (الطقس)</h3>
<ul><li>مطارات طقسها IFR أو أسوأ: ${list(w.ifr_or_worse)}</li>
<li>مطارات رياحها 25 عقدة أو أكتر: ${list(w.strong_wind_25kt)}</li></ul>
<h3>3) عين الطلب</h3>
<ul><li>إشارات طلب نشطة: ${esc(n(dm.active))} (الدرجة: ${grades}). D معناها إشارة ضعيفة.</li>
${(dm.latest_titles ?? []).map((t: string) => `<li dir="ltr" style="text-align:left">${esc(t)}</li>`).join('')}</ul>
<h3>طلبات العملاء الجديدة (من النموذج)</h3>
${leads.length ? `<p>لسه ما اتردّش عليها: <b>${leads.length}</b></p><table cellpadding="6" dir="ltr" style="border-collapse:collapse">${leads.map((l) => `<tr><td><b>${esc(l.origin_code)} → ${esc(l.destination_code)}</b></td><td>${esc(l.travel_date)}</td><td>${esc(l.passengers)} pax</td></tr>`).join('')}</table>` : '<p>لا يوجد طلبات جديدة.</p>'}
<h3>الفرص</h3>
<p>منتظرة موافقتك: <b>${esc(n(op.awaiting_approval))}</b> — محققة: ${esc(n(op.validated))} — منتهية: ${esc(n(op.expired))}</p>
${pending.length ? `<table cellpadding="6" dir="ltr" style="border-collapse:collapse">${pending.map(oppRow).join('')}</table>` : ''}
<p style="color:#555">مفيش حاجة اتبعتت لأي عميل. أي إرسال بيستنى موافقتك.</p></div>`

  const r = await send(`THE KING'S EYE — تقرير العيون${warns.length ? ' ⚠️' : ''}`, html)
  if (!r.ok) return json({ error: 'email_failed', status: r.status }, 502)
  return json({ sent: 'digest', warnings: warns.length })
})
