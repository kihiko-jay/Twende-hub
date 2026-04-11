
SET search_path TO public;

CREATE OR REPLACE FUNCTION public.set_chat_user_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT u.name INTO NEW.user_name
  FROM public.users u
  WHERE u.id = NEW.user_id;

  NEW.content := btrim(COALESCE(NEW.content, ''));
  IF NEW.content = '' THEN
    RAISE EXCEPTION 'Chat message cannot be empty';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_set_user_name ON public.chat_messages;

CREATE TRIGGER chat_messages_set_user_name
BEFORE INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_chat_user_name();
