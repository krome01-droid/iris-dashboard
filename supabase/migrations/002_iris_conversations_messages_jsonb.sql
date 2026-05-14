-- Store the full message stream directly on the conversation row.
-- Simpler than splitting into iris_messages for the chat UI which always
-- overwrites the entire history on save.
alter table iris_conversations
  add column if not exists messages_json jsonb not null default '[]'::jsonb;
