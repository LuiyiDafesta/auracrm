
-- Channel type enum
CREATE TYPE public.channel_type AS ENUM ('whatsapp_evolution', 'telegram', 'email', 'facebook', 'instagram', 'webchat');

-- Channel status enum
CREATE TYPE public.channel_status AS ENUM ('active', 'inactive', 'error');

-- Message direction enum
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- Channels configuration table
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type public.channel_type NOT NULL,
  status public.channel_status NOT NULL DEFAULT 'inactive',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own channels" ON public.channels FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Channel messages table
CREATE TABLE public.channel_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction public.message_direction NOT NULL DEFAULT 'inbound',
  sender_name TEXT,
  sender_identifier TEXT,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  external_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own channel_messages" ON public.channel_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_channel_messages_channel_id ON public.channel_messages(channel_id);
CREATE INDEX idx_channel_messages_contact_id ON public.channel_messages(contact_id);
CREATE INDEX idx_channel_messages_created_at ON public.channel_messages(created_at DESC);
CREATE INDEX idx_channel_messages_is_read ON public.channel_messages(is_read) WHERE is_read = false;

-- Enable realtime for inbox
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
