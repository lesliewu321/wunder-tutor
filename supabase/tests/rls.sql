-- Who can do what: two made-up families, every rule of the first migration tried out.
-- Run it as it is (SQL editor, or the Supabase MCP's execute_sql). It ALWAYS rolls back: nothing it makes is kept. The
-- outcome arrives as the error message, one line per check — "ok" or "FAILED" — ending in "ALL OK" or "n FAILED".
do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  out_text text := '';
  failed int := 0;
  n int;
  r record;
  doc jsonb := '{"name": "Tiger", "age": 7, "xp": 12}'::jsonb;

  -- expect(sql, what should happen): 'ok' | an SQLSTATE | 'rows:N'
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'family-a-' || a || '@example.invalid'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'family-b-' || b || '@example.invalid');

  create temp table checks (step serial, what text, sql text, as_role text, as_user uuid, expect text) on commit drop;
  insert into checks (what, sql, as_role, as_user, expect) values
    ('a parents row appears with the sign-in',            format('select 1 from public.parents where id = %L', a), 'postgres', null, 'rows:1'),
    ('signed out: learners are closed',                   'select 1 from public.learners', 'anon', null, '42501'),
    ('signed out: pages are closed',                      'select 1 from public.learner_pages', 'anon', null, '42501'),
    ('signed out: cannot delete an account',              'select public.delete_my_account()', 'anon', null, '42501'),
    ('A adds a learner',                                  format('insert into public.learners (id, state) values (%L, %L)', 'learner-a-1', doc), 'authenticated', a, 'ok'),
    ('A sees their learner',                              'select 1 from public.learners', 'authenticated', a, 'rows:1'),
    ('B sees nothing of A',                               'select 1 from public.learners', 'authenticated', b, 'rows:0'),
    ('B cannot add a learner to A''s family',             format('insert into public.learners (parent_id, id, state) values (%L, %L, %L)', a, 'learner-b-x', doc), 'authenticated', b, '42501'),
    ('B cannot write A''s learner',                       format('update public.learners set state = %L, rev = 2 where id = %L', doc, 'learner-a-1'), 'authenticated', b, 'rows:0'),
    ('B may use the same learner id in their own family', format('insert into public.learners (id, state) values (%L, %L)', 'learner-a-1', doc), 'authenticated', b, 'ok'),
    ('A writes with the next rev',                        format('update public.learners set state = %L, rev = 2 where id = %L and rev = 1', doc || '{"xp": 20}', 'learner-a-1'), 'authenticated', a, 'rows:1'),
    ('a stale write finds no row',                        format('update public.learners set state = %L, rev = 2 where id = %L and rev = 1', doc, 'learner-a-1'), 'authenticated', a, 'rows:0'),
    ('rev cannot jump',                                   format('update public.learners set state = %L, rev = 9 where id = %L', doc, 'learner-a-1'), 'authenticated', a, '40001'),
    ('a parent cannot set deleted_at themselves',         format('update public.learners set deleted_at = now() where id = %L', 'learner-a-1'), 'authenticated', a, '42501'),
    ('a nickname is short',                               format('insert into public.learners (id, state) values (%L, %L)', 'learner-a-2', doc || '{"name": "A very long legal name, with address"}'), 'authenticated', a, '23514'),
    ('an age is whole years from 4',                      format('insert into public.learners (id, state) values (%L, %L)', 'learner-a-3', doc || '{"age": 3}'), 'authenticated', a, '23514'),
    ('A adds a page',                                     format('insert into public.learner_pages (learner_id, id, data, changed) values (%L, %L, %L, 1000)', 'learner-a-1', 'page-0001', '{"reading": {"language": "en", "lines": [{"text": "The brown dog sleeps."}]}, "best": {}, "at": 1000}'), 'authenticated', a, 'ok'),
    ('A upserts the page in one step',                    format('insert into public.learner_pages (learner_id, id, data, changed) values (%L, %L, %L, 2000) on conflict (parent_id, learner_id, id) do update set data = excluded.data, changed = excluded.changed', 'learner-a-1', 'page-0001', '{"reading": {"language": "en", "lines": []}, "best": {"0": 88}, "at": 1000}'), 'authenticated', a, 'ok'),
    ('B cannot see A''s page',                            'select 1 from public.learner_pages', 'authenticated', b, 'rows:0'),
    ('a page needs its learner',                          format('insert into public.learner_pages (learner_id, id, data, changed) values (%L, %L, %L, 1)', 'no-such-learner', 'page-0002', '{}'), 'authenticated', a, '23503'),
    ('a live page cannot be removed for good',            'delete from public.learner_pages', 'authenticated', a, 'rows:0'),
    ('a parent cannot count usage',                       format('select public.count_usage(%L, %L)', a, 'scorings'), 'authenticated', a, '42501'),
    ('the API counts usage',                              format('select 1 from public.count_usage(%L, %L) u where u.scorings = 1', a, 'scorings'), 'service_role', null, 'rows:1'),
    ('the API counts again',                              format('select 1 from public.count_usage(%L, %L, 2) u where u.scorings = 3', a, 'scorings'), 'service_role', null, 'rows:1'),
    ('the API cannot read learners',                      'select 1 from public.learners', 'service_role', null, '42501'),
    ('the API sets a plan',                               format('insert into public.plans (parent_id, plan, source) values (%L, %L, %L)', a, 'beta', 'manual'), 'service_role', null, 'ok'),
    ('A reads their plan and usage',                      'select 1 from public.plans p join public.usage_daily u using (parent_id) where p.plan = ''beta'' and u.scorings = 3', 'authenticated', a, 'rows:1'),
    ('A cannot give themselves a plan',                   format('update public.plans set plan = %L', 'family'), 'authenticated', a, '42501'),
    ('A records a consent',                               format('insert into public.consents (consent_type, policy_version, language, wording) values (%L, %L, %L, %L)', 'terms_and_privacy', '2026-09', 'en', 'I agree.'), 'authenticated', a, 'ok'),
    ('a consent cannot be reworded',                      'update public.consents set wording = ''something else''', 'authenticated', a, '42501'),
    ('A deletes the learner',                             format('select public.delete_learner(%L)', 'learner-a-1'), 'authenticated', a, 'ok'),
    ('what is left is an empty tombstone',                'select 1 from public.learners where id = ''learner-a-1'' and state = ''{}''::jsonb and deleted_at is not null and rev = 3', 'authenticated', a, 'rows:1'),
    ('its pages are emptied too',                         'select 1 from public.learner_pages where data = ''{}''::jsonb and deleted_at is not null', 'authenticated', a, 'rows:1'),
    ('a deleted learner cannot be written to',            format('update public.learners set state = %L, rev = 4 where id = %L', doc, 'learner-a-1'), 'authenticated', a, '55000'),
    ('B''s learner of the same id is untouched',          'select 1 from public.learners where deleted_at is null', 'authenticated', b, 'rows:1'),
    ('A deletes the account',                             'select public.delete_my_account()', 'authenticated', a, 'ok'),
    ('nothing of A is left',                              format('select 1 from auth.users where id = %L union all select 1 from public.parents where id = %L union all select 1 from public.learners where parent_id = %L union all select 1 from public.usage_daily where parent_id = %L union all select 1 from public.plans where parent_id = %L union all select 1 from public.consents where parent_id = %L', a, a, a, a, a, a), 'postgres', null, 'rows:0'),
    ('B is still there',                                  format('select 1 from public.parents where id = %L', b), 'postgres', null, 'rows:1');

  for r in select * from checks order by step loop
    declare got text;
    begin
      execute format('set local role %I', r.as_role);
      perform set_config('request.jwt.claims', case when r.as_user is null then '' else json_build_object('sub', r.as_user, 'role', r.as_role)::text end, true);
      begin
        execute r.sql;
        get diagnostics n = row_count;
        got := case when r.expect like 'rows:%' then 'rows:' || n else 'ok' end;
      exception when others then
        got := sqlstate;
      end;
      reset role;
      if got is distinct from r.expect then failed := failed + 1; end if;
      out_text := out_text || format(E'\n%s  %s%s', case when got = r.expect then 'ok    ' else 'FAILED' end, r.what, case when got = r.expect then '' else format(' (expected %s, got %s)', r.expect, got) end);
    end;
  end loop;

  -- A family has at most 8 learners.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    for n in 2..9 loop
      insert into public.learners (id, state) values ('learner-b-' || n, doc);
    end loop;
    failed := failed + 1;
    out_text := out_text || E'\nFAILED  a ninth learner is refused (it was accepted)';
  exception when sqlstate '54000' then
    out_text := out_text || E'\nok      a ninth learner is refused';
  end;
  reset role;

  raise exception E'RLS checks (rolled back, nothing kept):%\n%', out_text, case when failed = 0 then 'ALL OK' else failed || ' FAILED' end;
end
$test$;
