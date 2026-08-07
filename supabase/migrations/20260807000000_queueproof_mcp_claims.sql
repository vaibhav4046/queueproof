-- QueueProof's Supabase project is the OAuth authorization server for web users and
-- AI clients. Normal browser sessions retain Supabase's default `authenticated`
-- audience; OAuth client tokens are minted specifically for QueueProof's MCP resource.
create or replace function public.queueproof_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := event->'claims';
begin
  if claims ? 'client_id' then
    claims := jsonb_set(
      claims,
      '{aud}',
      to_jsonb('https://queueproof.vercel.app/mcp'::text),
      true
    );
    claims := jsonb_set(
      claims,
      '{queueproof_permissions}',
      '["queueproof:read"]'::jsonb,
      true
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.queueproof_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.queueproof_access_token_hook(jsonb) from anon, authenticated, public;
