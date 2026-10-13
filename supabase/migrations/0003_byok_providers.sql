-- BYOK top-5 providers: widen the ai_settings provider check.
alter table if exists ai_settings drop constraint if exists ai_settings_provider_check;
alter table if exists ai_settings
  add constraint ai_settings_provider_check
  check (provider in ('openai', 'anthropic', 'google', 'xai', 'deepseek', 'offline'));
-- Migrate the legacy single-provider value to the OpenAI registry id.
update ai_settings set provider = 'openai' where provider = 'openai_compatible';
