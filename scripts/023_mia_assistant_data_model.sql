-- MIA Assistant Data Model and Security RLS.
-- Run manually in Supabase SQL editor or via apply_migration.

BEGIN;

-- 1. MIA CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.mia_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mia_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mia_conversations_select_own" ON public.mia_conversations;
CREATE POLICY "mia_conversations_select_own"
  ON public.mia_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_conversations_insert_own" ON public.mia_conversations;
CREATE POLICY "mia_conversations_insert_own"
  ON public.mia_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_conversations_update_own" ON public.mia_conversations;
CREATE POLICY "mia_conversations_update_own"
  ON public.mia_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_conversations_delete_own" ON public.mia_conversations;
CREATE POLICY "mia_conversations_delete_own"
  ON public.mia_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mia_conversations_user_id ON public.mia_conversations(user_id);

-- 2. MIA MESSAGES
CREATE TABLE IF NOT EXISTS public.mia_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.mia_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mia_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mia_messages_select_own" ON public.mia_messages;
CREATE POLICY "mia_messages_select_own"
  ON public.mia_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_messages_insert_own" ON public.mia_messages;
CREATE POLICY "mia_messages_insert_own"
  ON public.mia_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_messages_update_own" ON public.mia_messages;
CREATE POLICY "mia_messages_update_own"
  ON public.mia_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_messages_delete_own" ON public.mia_messages;
CREATE POLICY "mia_messages_delete_own"
  ON public.mia_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mia_messages_conversation_id ON public.mia_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mia_messages_user_id ON public.mia_messages(user_id);

-- 3. MIA TOOL CALLS
CREATE TABLE IF NOT EXISTS public.mia_tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.mia_conversations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mia_tool_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mia_tool_calls_select_own" ON public.mia_tool_calls;
CREATE POLICY "mia_tool_calls_select_own"
  ON public.mia_tool_calls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_tool_calls_insert_own" ON public.mia_tool_calls;
CREATE POLICY "mia_tool_calls_insert_own"
  ON public.mia_tool_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_tool_calls_update_own" ON public.mia_tool_calls;
CREATE POLICY "mia_tool_calls_update_own"
  ON public.mia_tool_calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_tool_calls_delete_own" ON public.mia_tool_calls;
CREATE POLICY "mia_tool_calls_delete_own"
  ON public.mia_tool_calls FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mia_tool_calls_conversation_id ON public.mia_tool_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mia_tool_calls_user_id ON public.mia_tool_calls(user_id);

-- 4. MIA MEMORY
CREATE TABLE IF NOT EXISTS public.mia_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.mia_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mia_memory_select_own" ON public.mia_memory;
CREATE POLICY "mia_memory_select_own"
  ON public.mia_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_memory_insert_own" ON public.mia_memory;
CREATE POLICY "mia_memory_insert_own"
  ON public.mia_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_memory_update_own" ON public.mia_memory;
CREATE POLICY "mia_memory_update_own"
  ON public.mia_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mia_memory_delete_own" ON public.mia_memory;
CREATE POLICY "mia_memory_delete_own"
  ON public.mia_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mia_memory_user_id ON public.mia_memory(user_id);

-- TRIGGERS TO UPDATE updated_at
DROP TRIGGER IF EXISTS mia_conversations_updated_at ON public.mia_conversations;
CREATE TRIGGER mia_conversations_updated_at
  BEFORE UPDATE ON public.mia_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS mia_memory_updated_at ON public.mia_memory;
CREATE TRIGGER mia_memory_updated_at
  BEFORE UPDATE ON public.mia_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMIT;
