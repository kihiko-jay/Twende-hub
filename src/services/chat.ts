import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: number;
  event_id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

function mapRow(row: any): ChatMessage {
  return {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    user_name:
      row.user_name ||
      (Array.isArray(row.users) ? row.users[0]?.name : row.users?.name) ||
      'Participant',
    content: row.content,
    created_at: row.created_at,
  };
}

export async function fetchMessages(eventId: number): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, event_id, user_id, content, created_at, users!chat_messages_user_id_fkey(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function sendMessage(eventId: number, userId: string, content: string): Promise<void> {
  const clean = content.trim();
  if (!clean) return;

  const { data: profile } = await supabase.from('users').select('name').eq('id', userId).single();
  const { error } = await supabase.from('chat_messages').insert({
    event_id: eventId,
    user_id: userId,
    content: clean,
    user_name: (profile as { name?: string } | null)?.name ?? null,
  } as any);

  if (error) throw error;
}

export function subscribeToMessages(
  eventId: number,
  onMessage: (msg: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(`chat:${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `event_id=eq.${eventId}`,
      },
      async (payload) => {
        const row = payload.new as any;
        let user_name = row.user_name as string | undefined;
        if (!user_name && row.user_id) {
          const { data } = await supabase.from('users').select('name').eq('id', row.user_id).single();
          user_name = (data as { name?: string } | null)?.name ?? 'Participant';
        }
        onMessage({
          id: row.id,
          event_id: row.event_id,
          user_id: row.user_id,
          user_name: user_name ?? 'Participant',
          content: row.content,
          created_at: row.created_at,
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function reportMessage(messageId: number, reason: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    throw new Error('You need to be signed in to report a message.');
  }

  const { error } = await supabase.from('reported_messages').insert({
    message_id: messageId,
    reported_by: userId,
    reason: reason.trim() || null,
  } as any);
  if (error) throw error;
}
