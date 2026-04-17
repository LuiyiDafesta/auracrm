import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: triggers, error } = await supabaseClient.rpc('get_triggers');
  
  if (error) {
    // try direct sql if rpc doesn't exist? we can't easily do direct sql from rest api without rpc.
    return new Response(JSON.stringify({ error: "no rpc" }), { status: 500 });
  }

  return new Response(JSON.stringify({
      triggers
  }), { headers: { "Content-Type": "application/json" } });
});
