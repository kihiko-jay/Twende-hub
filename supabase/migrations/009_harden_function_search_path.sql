create or replace function public.is_event_cancellable(p_event_id bigint)
returns boolean
language sql
stable
set search_path = public
as $$
  select not exists (
    select 1
    from public.payments
    where event_id = p_event_id
      and payment_status in ('confirmed', 'refunded')
  );
$$;

create or replace function public.is_payment_refundable(p_payment_id bigint)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p.payment_status = 'confirmed'
    and e.date_time > now()
  from public.payments p
  join public.events e on e.id = p.event_id
  where p.id = p_payment_id;
$$;