-- Tables référencées par les crons / routes API mais absentes du schéma initial.
-- iris_content_log    : journal d'activité (briefs, veille, newsletters)
-- iris_seo_reports    : rapports SEO hebdomadaires
-- iris_social_posts   : posts réseaux sociaux programmés
-- iris_editorial_calendar : calendrier éditorial

-- ============================
-- 1. CONTENT LOG — activité IRIS (brief / veille / newsletter)
-- ============================
create table if not exists iris_content_log (
  id bigserial primary key,
  title text not null,
  type text not null,
  status text not null default 'published',
  content_markdown text,
  meta_json jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_clog_type on iris_content_log(type, created_at desc);
create index if not exists idx_iris_clog_created on iris_content_log(created_at desc);

-- ============================
-- 2. SEO REPORTS — rapports SEO automatisés
-- ============================
create table if not exists iris_seo_reports (
  id bigserial primary key,
  report_type text not null default 'weekly',
  period_start date,
  period_end date,
  summary text,
  data_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_seorep_created on iris_seo_reports(created_at desc);

-- ============================
-- 3. SOCIAL POSTS — posts programmés
-- ============================
create table if not exists iris_social_posts (
  id bigserial primary key,
  platform text not null,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text not null default 'scheduled',
  caption text,
  media_urls jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_social_sched on iris_social_posts(scheduled_at desc);

-- ============================
-- 4. EDITORIAL CALENDAR — calendrier éditorial
-- ============================
create table if not exists iris_editorial_calendar (
  id bigserial primary key,
  title text not null,
  content_type text not null default 'article'
    check (content_type in ('article', 'newsletter', 'social_campaign', 'email_sequence', 'other')),
  planned_date date not null,
  status text not null default 'planned'
    check (status in ('idea', 'planned', 'in_progress', 'review', 'published', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_iris_cal_date on iris_editorial_calendar(planned_date);
