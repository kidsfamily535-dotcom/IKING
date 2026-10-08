import { createClient } from 'npm:@supabase/supabase-js@2'

// Public trip-request intake. verify_jwt=false ON PURPOSE (guests have no account). Safety is done here:
// strict validation, honeypot, per-IP / per-contact / global rate limits, writes only through the service role,
// and the table itself has no anon access. Nothing is sent to any operator or customer from here: only the owner is emailed.
// GET returns the airport reference list only (public reference data) so the guest form can fill its dropdowns.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json', ...extra } })
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map((x) => x.toString(16).padStart(2, '0')).join('')
const SOURCES = ['DIRECT', 'HOTEL', 'TRAVEL_AGENCY', 'CONCIERGE', 'YACHT_BROKER', 'CORPORATE', 'OTHER']
const PERIODS = ['morning', 'afternoon', 'evening', 'flexible']
const PERIOD_AR: Record<string, string> = { morning: 'صباحًا', afternoon: 'ظهرًا/عصرًا', evening: 'مساءً', flexible: 'مرن' }
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'))
const bad = (field: string) => json({ error: 'invalid', field }, 400)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (req.method === 'GET') {
    const { data, error } = await db.from('airports').select('iata_code,name_ar,name_en,country_code').order('country_code').limit(1000)
    if (error) return json({ error: 'server_error' }, 500)
    return json({ airports: data ?? [] }, 200, { 'Cache-Control': 'public, max-age=3600' })
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let b: any
  try { b = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  if (!b || typeof b !== 'object') return json({ error: 'bad_json' }, 400)
  if (b.website) return json({ ok: true }) // honeypot: bots fill it, humans never see it

  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
  const name = str(b.contact_name, 80)
  if (name.length < 2) return bad('contact_name')
  const channel = str(b.contact_channel, 20)
  if (!['whatsapp', 'phone', 'email'].includes(channel)) return bad('contact_channel')
  let value = str(b.contact_value, 120)
  if (channel === 'email') {
    value = value.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return bad('contact_value')
  } else {
    value = value.replace(/[\s\-()]/g, '')
    if (!/^\+?[0-9]{7,15}$/.test(value)) return bad('contact_value')
  }
  const origin = str(b.origin_code, 3).toUpperCase()
  const dest = str(b.destination_code, 3).toUpperCase()
  if (!/^[A-Z]{3}$/.test(origin)) return bad('origin_code')
  if (!/^[A-Z]{3}$/.test(dest) || dest === origin) return bad('destination_code')
  const travel = str(b.travel_date, 10)
  if (!isDate(travel)) return bad('travel_date')
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const t = Date.parse(travel + 'T00:00:00Z')
  if (t < today.getTime() - 86400000 || t > today.getTime() + 366 * 86400000) return bad('travel_date')
  let ret: string | null = str(b.return_date, 10) || null
  if (ret && (!isDate(ret) || Date.parse(ret + 'T00:00:00Z') < t)) return bad('return_date')
  const period = PERIODS.includes(str(b.departure_period, 20)) ? str(b.departure_period, 20) : 'flexible'
  const pax = Number(b.passengers)
  if (!Number.isInteger(pax) || pax < 1 || pax > 40) return bad('passengers')
  if (b.consent !== true) return bad('consent')
  const note = str(b.note, 500) || null
  const source = SOURCES.includes(str(b.source, 20)) ? str(b.source, 20) : 'DIRECT'
  const partner = str(b.referral_partner, 60) || null
  const campaign = str(b.campaign, 60) || null

  const { data: aps, error: apErr } = await db.from('airports').select('iata_code').in('iata_code', [origin, dest])
  if (apErr) return json({ error: 'server_error' }, 500)
  const known = new Set((aps ?? []).map((a: any) => a.iata_code))
  if (!known.has(origin)) return bad('origin_code')
  if (!known.has(dest)) return bad('destination_code')

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown'
  const ipHash = await sha(ip + '|trip_leads_v1|' + url)
  const since = (ms: number) => new Date(Date.now() - ms).toISOString()
  const count = async (col: string, val: string | null, ms: number) => {
    let q = db.from('trip_leads').select('id', { count: 'exact', head: true }).gte('created_at', since(ms))
    if (col) q = q.eq(col, val as string)
    const { count: c } = await q
    return c ?? 0
  }
  if ((await count('ip_hash', ipHash, 3600_000)) >= 5) return json({ error: 'rate_limited' }, 429)
  if ((await count('contact_value', value, 86400_000)) >= 3) return json({ error: 'rate_limited' }, 429)
  if ((await count('', null, 86400_000)) >= 300) return json({ error: 'rate_limited' }, 429)

  const { data: row, error: insErr } = await db.from('trip_leads').insert({
    contact_name: name, contact_channel: channel, contact_value: value, origin_code: origin, destination_code: dest,
    travel_date: travel, return_date: ret, departure_period: period, passengers: pax, note, consent: true,
    source, referral_partner: partner, campaign, ip_hash: ipHash,
  }).select('id').single()
  if (insErr || !row) { console.error('insert_failed', insErr?.message); return json({ error: 'server_error' }, 500) }

  // Instant email to the owner(s). A failure here never loses the lead: it is already saved and shows in the daily digest.
  try {
    const key = Deno.env.get('RESEND_API_KEY')
    const { data: admins } = await db.from('profiles').select('email').eq('role', 'admin').eq('status', 'active')
    const to = (admins ?? []).map((a: any) => a.email).filter(Boolean)
    if (key && to.length) {
      const digits = value.replace(/\D/g, '')
      const contact = channel === 'whatsapp'
        ? `واتساب: <a href="https://wa.me/${esc(digits)}">${esc(value)}</a>`
        : channel === 'email' ? `إيميل: ${esc(value)}` : `هاتف: ${esc(value)}`
      const html = `<div dir="rtl" style="font-family:system-ui,Tahoma,sans-serif;color:#111;line-height:1.8;max-width:600px">
<h2 style="margin:0">THE KING'S EYE — طلب رحلة جديد</h2>
<p style="color:#555;margin-top:4px">طلب حقيقي من نموذج العميل، مش محاكاة.</p>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td>المسار</td><td dir="ltr"><b>${esc(origin)} → ${esc(dest)}</b></td></tr>
<tr><td>التاريخ</td><td dir="ltr">${esc(travel)}${ret ? ' ← عودة ' + esc(ret) : ''}</td></tr>
<tr><td>الوقت</td><td>${esc(PERIOD_AR[period])}</td></tr>
<tr><td>عدد الركاب</td><td>${esc(pax)}</td></tr>
<tr><td>الاسم</td><td>${esc(name)}</td></tr>
<tr><td>التواصل</td><td>${contact}</td></tr>
${note ? `<tr><td>ملاحظة</td><td>${esc(note)}</td></tr>` : ''}
<tr><td>المصدر</td><td>${esc(source)}${partner ? ' / ' + esc(partner) : ''}${campaign ? ' / ' + esc(campaign) : ''}</td></tr>
</table>
<p style="color:#555">العميل وافق على التواصل معه بخصوص الطلب. مفيش حاجة اتبعتت لأي مشغّل. الرد عليه قرارك.</p></div>`
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: "King's Eye <onboarding@resend.dev>", to, subject: `طلب رحلة جديد: ${origin} → ${dest} (${pax} ركاب)`, html }),
      })
      if (r.ok) await db.from('trip_leads').update({ owner_notified_at: new Date().toISOString() }).eq('id', row.id)
      else console.error('email_failed', r.status)
    }
  } catch (e) { console.error('email_exception', String(e)) }

  return json({ ok: true })
})
