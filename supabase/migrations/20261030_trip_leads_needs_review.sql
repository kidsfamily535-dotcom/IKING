-- طلبات برحلات تمر بمطار خارج الجدول المرجعي airports تُقبَل ويُعلَّم عليها للمراجعة اليدوية.
-- آمنة لإعادة التشغيل. التراجع: alter table public.trip_leads drop column needs_review, drop column review_reason;
alter table public.trip_leads
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;
create index if not exists trip_leads_needs_review_idx on public.trip_leads (created_at desc) where needs_review;
comment on column public.trip_leads.needs_review is 'true = كود مطار غير موجود في airports؛ يراجعه المالك قبل أي رد. لا يُرسل لأي مشغّل.';
comment on column public.trip_leads.review_reason is 'سبب المراجعة، مثل airport_not_in_reference: VNY';
