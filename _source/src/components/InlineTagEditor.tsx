import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Plus, Tag } from 'lucide-react';

interface InlineTagEditorProps {
  contactId: string;
  allTags: { id: string; name: string; color: string }[];
  assignedTags: { id: string; name: string; color: string }[];
  onTagsUpdated: () => void;
}

export function InlineTagEditor({ contactId, allTags, assignedTags, onTagsUpdated }: InlineTagEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const assignTag = async (tagId: string) => {
    if (!user || loading) return;
    setLoading(true);
    const { error } = await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: tagId });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    onTagsUpdated();
  };

  const removeTag = async (tagId: string) => {
    if (!user || loading) return;
    setLoading(true);
    const { error } = await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tagId);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    onTagsUpdated();
  };

  const toggleTag = (tagId: string, isAssigned: boolean) => {
    if (isAssigned) {
      removeTag(tagId);
    } else {
      assignTag(tagId);
    }
  };

  const assignedTagIds = new Set(assignedTags.map(t => t.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); }}>
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Editor de Etiquetas</h4>
            <p className="text-xs text-muted-foreground">Toca para agregar o quitar etiquetas de este contacto.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto pr-1">
            {allTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay etiquetas creadas.</p>
            ) : (
              allTags.map(tag => {
                const isAssigned = assignedTagIds.has(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isAssigned ? 'default' : 'outline'}
                    className={`text-xs cursor-pointer transition-colors ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{
                      backgroundColor: isAssigned ? `${tag.color}15` : 'transparent',
                      color: isAssigned ? tag.color : 'inherit',
                      borderColor: isAssigned ? `${tag.color}50` : 'rgba(0,0,0,0.1)'
                    }}
                    onClick={() => toggleTag(tag.id, isAssigned)}
                  >
                    {tag.name}
                  </Badge>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
