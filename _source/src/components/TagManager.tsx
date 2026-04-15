import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Tag } from 'lucide-react';

const TAG_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

interface TagManagerProps {
  contactId: string;
  compact?: boolean;
}

export function TagManager({ contactId, compact = false }: TagManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allTags, setAllTags] = useState<any[]>([]);
  const [contactTags, setContactTags] = useState<any[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [open, setOpen] = useState(false);

  const fetchTags = async () => {
    if (!user) return;
    const [all, assigned] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('*, tags(*)').eq('contact_id', contactId),
    ]);
    setAllTags(all.data || []);
    setContactTags(assigned.data || []);
  };

  useEffect(() => { fetchTags(); }, [user, contactId]);

  const createTag = async () => {
    if (!user || !newTagName.trim()) return;
    const { data, error } = await supabase.from('tags').insert({ user_id: user.id, name: newTagName.trim(), color: selectedColor }).select().single();
    if (error) {
      if (error.code === '23505') toast({ title: 'Esa etiqueta ya existe', variant: 'destructive' });
      else toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setNewTagName('');
    await assignTag(data.id);
    fetchTags();
  };

  const assignTag = async (tagId: string) => {
    const exists = contactTags.some(ct => ct.tag_id === tagId);
    if (exists) return;
    await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: tagId });
    fetchTags();
  };

  const removeTag = async (tagId: string) => {
    await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tagId);
    fetchTags();
  };

  const assignedTagIds = contactTags.map(ct => ct.tag_id);
  const availableTags = allTags.filter(t => !assignedTagIds.includes(t.id));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {contactTags.map(ct => (
        <Badge key={ct.id} variant="secondary" className="text-xs gap-1" style={{ backgroundColor: ct.tags?.color + '20', color: ct.tags?.color, borderColor: ct.tags?.color + '40' }}>
          {ct.tags?.name}
          {!compact && <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(ct.tag_id)} />}
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Tag className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Etiquetas disponibles</p>
              {availableTags.length === 0 && <p className="text-xs text-muted-foreground">Sin etiquetas disponibles</p>}
              <div className="flex flex-wrap gap-1">
                {availableTags.map(t => (
                  <Badge key={t.id} variant="outline" className="text-xs cursor-pointer hover:opacity-80" style={{ borderColor: t.color, color: t.color }} onClick={() => { assignTag(t.id); }}>
                    <Plus className="h-3 w-3 mr-1" />{t.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="border-t pt-2 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Crear nueva</p>
              <div className="flex gap-1">
                <Input className="h-7 text-xs" placeholder="Nombre..." value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTag()} />
                <Button size="sm" className="h-7 px-2" onClick={createTag}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button key={c} className={`h-5 w-5 rounded-full border-2 ${selectedColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setSelectedColor(c)} />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
