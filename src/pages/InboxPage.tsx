import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Send, Inbox, Phone, Bot, Mail, MessageSquare, Globe, User, Search, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CHANNEL_ICONS: Record<string, any> = {
  whatsapp_evolution: Phone,
  telegram: Bot,
  email: Mail,
  facebook: MessageSquare,
  instagram: MessageSquare,
  webchat: Globe,
};
const CHANNEL_COLORS: Record<string, string> = {
  whatsapp_evolution: 'text-green-500',
  telegram: 'text-blue-500',
  email: 'text-orange-500',
  facebook: 'text-blue-600',
  instagram: 'text-pink-500',
  webchat: 'text-primary',
};

type Message = {
  id: string; channel_id: string; contact_id: string | null; direction: string;
  sender_name: string | null; sender_identifier: string | null; content: string | null;
  is_read: boolean; created_at: string; media_url: string | null; media_type: string | null;
  user_id: string; external_id: string | null; metadata: any;
};

type Conversation = {
  identifier: string;
  name: string;
  channelId: string;
  channelType: string;
  channelName: string;
  contactId: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
};

export default function InboxPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [channels, setChannels] = useState<any[]>([]);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: msgs }, { data: chs }] = await Promise.all([
      supabase.from('channel_messages').select('*').order('created_at', { ascending: true }),
      supabase.from('channels').select('*'),
    ]);

    setChannels(chs || []);
    const allMsgs = (msgs as Message[]) || [];

    // Group by sender_identifier + channel_id
    const groups: Record<string, Conversation> = {};
    allMsgs.forEach(m => {
      const key = `${m.channel_id}::${m.direction === 'inbound' ? m.sender_identifier : 'self'}`;
      const convKey = m.direction === 'inbound' ? `${m.channel_id}::${m.sender_identifier}` : null;
      
      // For outbound, find matching inbound conversation
      let actualKey = key;
      if (m.direction === 'outbound' && m.contact_id) {
        // Find conversation by contact
        const matchKey = Object.keys(groups).find(k => {
          const g = groups[k];
          return g.contactId === m.contact_id && g.channelId === m.channel_id;
        });
        if (matchKey) actualKey = matchKey;
      }

      if (!groups[actualKey]) {
        const ch = (chs || []).find((c: any) => c.id === m.channel_id);
        groups[actualKey] = {
          identifier: m.sender_identifier || '',
          name: m.sender_name || 'Desconocido',
          channelId: m.channel_id,
          channelType: ch?.type || 'webchat',
          channelName: ch?.name || 'Canal',
          contactId: m.contact_id,
          lastMessage: m.content || '',
          lastMessageAt: m.created_at,
          unreadCount: 0,
          messages: [],
        };
      }
      groups[actualKey].messages.push(m);
      if (m.direction === 'inbound') {
        groups[actualKey].lastMessage = m.content || '';
        groups[actualKey].lastMessageAt = m.created_at;
        if (!m.is_read) groups[actualKey].unreadCount++;
        groups[actualKey].name = m.sender_name || groups[actualKey].name;
        groups[actualKey].contactId = m.contact_id || groups[actualKey].contactId;
      }
    });

    const sorted = Object.values(groups).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(sorted);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('inbox-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv, conversations]);

  const selected = conversations.find(c => `${c.channelId}::${c.identifier}` === selectedConv);

  // Mark as read
  useEffect(() => {
    if (selected) {
      const unread = selected.messages.filter(m => !m.is_read && m.direction === 'inbound').map(m => m.id);
      if (unread.length > 0) {
        supabase.from('channel_messages').update({ is_read: true }).in('id', unread).then(() => fetchData());
      }
    }
  }, [selectedConv]);

  const handleSend = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('send-channel-message', {
      body: {
        channel_id: selected.channelId,
        contact_id: selected.contactId,
        content: replyText,
        recipient: selected.identifier,
      },
    });
    if (error) {
      toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
    } else {
      setReplyText('');
      fetchData();
    }
    setSending(false);
  };

  const filtered = conversations.filter(c => {
    if (filterChannel !== 'all' && c.channelId !== filterChannel) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.identifier.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] -mt-2">
      {/* Conversation list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Inbox
              {totalUnread > 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{totalUnread}</Badge>}
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-7 h-8 text-xs" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {channels.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              <Button variant={filterChannel === 'all' ? 'default' : 'ghost'} size="sm" className="h-6 text-[10px] px-2" onClick={() => setFilterChannel('all')}>Todos</Button>
              {channels.map((ch: any) => {
                const Icon = CHANNEL_ICONS[ch.type] || MessageSquare;
                return (
                  <Button key={ch.id} variant={filterChannel === ch.id ? 'default' : 'ghost'} size="sm" className="h-6 text-[10px] px-2" onClick={() => setFilterChannel(ch.id)}>
                    <Icon className="h-3 w-3 mr-1" /> {ch.name}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Inbox className="h-8 w-8 mb-2" />
              <p>Sin conversaciones</p>
            </div>
          ) : filtered.map(conv => {
            const key = `${conv.channelId}::${conv.identifier}`;
            const isActive = selectedConv === key;
            const Icon = CHANNEL_ICONS[conv.channelType] || MessageSquare;
            return (
              <div
                key={key}
                className={`flex items-start gap-3 p-3 cursor-pointer border-b transition-colors ${isActive ? 'bg-accent' : 'hover:bg-muted/50'}`}
                onClick={() => setSelectedConv(key)}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs">{conv.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-sm truncate">{conv.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(conv.lastMessageAt), 'dd/MM HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon className={`h-3 w-3 shrink-0 ${CHANNEL_COLORS[conv.channelType] || ''}`} />
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                </div>
                {conv.unreadCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5 shrink-0">{conv.unreadCount}</Badge>
                )}
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Seleccioná una conversación</p>
            <p className="text-sm">Los mensajes de todos tus canales aparecen acá</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{selected.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{selected.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {(() => { const Icon = CHANNEL_ICONS[selected.channelType] || MessageSquare; return <Icon className={`h-3 w-3 ${CHANNEL_COLORS[selected.channelType]}`} />; })()}
                    {selected.channelName} · {selected.identifier}
                  </div>
                </div>
              </div>
              {selected.contactId && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/contactos/${selected.contactId}`)}>
                  <User className="h-3.5 w-3.5 mr-1" /> Ver Contacto
                </Button>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.direction === 'outbound' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                      {m.content}
                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${m.direction === 'outbound' ? 'text-primary-foreground/60 justify-end' : 'text-muted-foreground'}`}>
                        {format(new Date(m.created_at), 'HH:mm', { locale: es })}
                        {m.direction === 'outbound' && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Reply input */}
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button onClick={handleSend} disabled={!replyText.trim() || sending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
