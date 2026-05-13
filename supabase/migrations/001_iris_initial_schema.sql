-- =====================================================================
-- IRIS — Schéma Supabase initial
-- Stockage centralisé : conversations, articles, images, SEO, leads, audits
-- À exécuter UNE FOIS sur https://app.supabase.com/project/lxtcbkqysfnpgqzllkyp/sql
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================
-- 1. CONVERSATIONS (chat Iris)
-- ============================
create table if not exists iris_conversations (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_iris_conv_user on iris_conversations(user_email, updated_at desc);

create table if not exists iris_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references iris_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool_result')),
  content text not null,
  tool_calls jsonb,
  tokens_input int,
  tokens_output int,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_msg_conv on iris_messages(conversation_id, created_at);

-- ============================
-- 2. ARTICLES (miroir Webflow + statut éditorial)
-- ============================
create table if not exists iris_articles (
  id uuid primary key default gen_random_uuid(),
  webflow_item_id text unique,
  webflow_collection_id text,
  slug text not null,
  title text not null,
  meta_title text,
  meta_description text,
  target_keyword text,
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  category text,
  content_markdown text,
  content_html text,
  featured_image_url text,
  word_count int,
  seo_score int,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by text default 'iris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_iris_art_slug on iris_articles(slug);
create index if not exists idx_iris_art_status on iris_articles(status, scheduled_at);
create index if not exists idx_iris_art_keyword on iris_articles(target_keyword);

-- ============================
-- 3. IMAGES (générées par Kie/Fal, stockées sur Webflow ou Supabase Storage)
-- ============================
create table if not exists iris_images (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  provider text not null check (provider in ('kie', 'fal', 'manual', 'webflow')),
  model text,
  format text default '16:9',
  url text not null,
  webflow_asset_id text,
  storage_path text, -- si stocké dans Supabase Storage
  used_in_article_id uuid references iris_articles(id) on delete set null,
  cost_usd numeric(8,4),
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_img_article on iris_images(used_in_article_id);
create index if not exists idx_iris_img_created on iris_images(created_at desc);

-- ============================
-- 4. SEO — historique positions (DataForSEO)
-- ============================
create table if not exists iris_seo_positions (
  id bigserial primary key,
  keyword text not null,
  target_domain text not null default 'autoecole-inris.com',
  position int, -- null = hors top 100
  url text,
  total_results int,
  location_code int default 2250,
  language_code text default 'fr',
  tracked_at timestamptz not null default now()
);
create index if not exists idx_iris_seo_kw_date on iris_seo_positions(keyword, tracked_at desc);
create index if not exists idx_iris_seo_date on iris_seo_positions(tracked_at desc);

-- ============================
-- 5. SEO — audits on-page
-- ============================
create table if not exists iris_seo_audits (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  onpage_score int,
  status_code int,
  title text,
  title_length int,
  meta_description text,
  meta_description_length int,
  h1 jsonb,
  word_count int,
  internal_links int,
  external_links int,
  largest_contentful_paint int,
  time_to_interactive int,
  issues jsonb,
  warnings jsonb,
  audited_at timestamptz not null default now()
);
create index if not exists idx_iris_audit_url on iris_seo_audits(url, audited_at desc);

-- ============================
-- 6. LEADS — cache miroir GHL
-- ============================
create table if not exists iris_leads_cache (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique,
  first_name text,
  last_name text,
  email text,
  phone text,
  city text,
  agency text,
  source text,
  tags jsonb,
  pipeline_stage text,
  raw_payload jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_iris_lead_email on iris_leads_cache(email);
create index if not exists idx_iris_lead_synced on iris_leads_cache(synced_at desc);

-- ============================
-- 7. TOOL LOGS — audit trail des tool calls Iris
-- ============================
create table if not exists iris_tool_calls (
  id bigserial primary key,
  conversation_id uuid references iris_conversations(id) on delete set null,
  tool_name text not null,
  input jsonb,
  output jsonb,
  status text check (status in ('success', 'error')),
  error_message text,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_tool_conv on iris_tool_calls(conversation_id, created_at);
create index if not exists idx_iris_tool_name on iris_tool_calls(tool_name, created_at desc);

-- ============================
-- 8. COSTS — tracking dépenses API
-- ============================
create table if not exists iris_api_costs (
  id bigserial primary key,
  service text not null check (service in ('anthropic', 'kie', 'fal', 'dataforseo', 'apify', 'resend', 'webflow', 'ghl', 'google', 'onesignal', 'supabase')),
  operation text,
  cost_usd numeric(10,6),
  units int,
  metadata jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_iris_cost_service_date on iris_api_costs(service, occurred_at desc);

-- ============================
-- Trigger updated_at
-- ============================
create or replace function iris_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_iris_conv_updated on iris_conversations;
create trigger trg_iris_conv_updated before update on iris_conversations
  for each row execute function iris_set_updated_at();

drop trigger if exists trg_iris_art_updated on iris_articles;
create trigger trg_iris_art_updated before update on iris_articles
  for each row execute function iris_set_updated_at();
