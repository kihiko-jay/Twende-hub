SET search_path TO public;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS user_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_content_length'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_content_length CHECK (LENGTH(content) <= 2000);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trim_and_validate_chat_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.content := btrim(NEW.content);
  IF NEW.content IS NULL OR NEW.content = '' THEN
    RAISE EXCEPTION 'Chat message cannot be empty';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_chat_message ON public.chat_messages;
CREATE TRIGGER trg_trim_chat_message
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.trim_and_validate_chat_message();

CREATE TABLE IF NOT EXISTS public.reported_messages (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, reported_by)
);

ALTER TABLE public.reported_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can report" ON public.reported_messages
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins can read reports" ON public.reported_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
