-- =============================================================================
-- Wunder Tutor — switching an invite code off stops everyone using it
-- =============================================================================
-- Switching a code off is the one lever against a code that has leaked, so it must apply to every device using it,
-- including those that already joined. The first version checked it AFTER "this device already has a place", which
-- told a joined device "ok" on a switched-off code that the API then refused on every request. Found before any code
-- was handed out, by reading the script's own promise ("families already in keep their place") against the server.
--
-- Expiry and a full code still only stop NEW joiners: those are about joining. A switch-off is about stopping.
-- =============================================================================

create or replace function public.redeem_invite(p_code text, p_device text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.invite_codes;
  used integer;
begin
  if p_device is null or char_length(p_device) not between 8 and 64 then
    raise exception 'bad device id' using errcode = '22023';
  end if;
  select * into c from public.invite_codes where code = upper(btrim(p_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if c.disabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  select count(*) into used from public.invite_redemptions where code = c.code;
  if exists (select 1 from public.invite_redemptions where code = c.code and device = p_device) then
    return jsonb_build_object('ok', true, 'reason', 'again', 'places', c.places, 'used', used, 'expires_at', c.expires_at);
  end if;
  if c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'expires_at', c.expires_at);
  end if;
  if used >= c.places then
    return jsonb_build_object('ok', false, 'reason', 'full', 'places', c.places, 'used', used);
  end if;
  insert into public.invite_redemptions (code, device) values (c.code, p_device);
  return jsonb_build_object('ok', true, 'reason', 'new', 'places', c.places, 'used', used + 1, 'expires_at', c.expires_at);
end;
$$;
revoke all on function public.redeem_invite(text, text) from public, anon, authenticated;
grant execute on function public.redeem_invite(text, text) to service_role;
