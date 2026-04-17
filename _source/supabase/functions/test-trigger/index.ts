import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1. Fetch a contact with opportunities
  console.log("Fetching contacts...");
  const { data: contacts, error: cErr } = await supabaseClient
    .from('contacts')
    .select('id, lead_score, opportunities(id, probability, is_archived)')
    .limit(10);
    
  if (cErr) return new Response(JSON.stringify({ error: cErr }), { status: 500 });
  
  const targetContact = contacts?.find(c => c.opportunities && c.opportunities.length > 0);
  
  if (!targetContact) return new Response(JSON.stringify({ contacts }), { status: 200 });

  console.log("Found target:", targetContact);
  
  return new Response(JSON.stringify({
      targetContact
  }), { headers: { "Content-Type": "application/json" } });
});
