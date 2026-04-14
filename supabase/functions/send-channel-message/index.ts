import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { channel_id, contact_id, content, recipient } = await req.json();

  if (!channel_id || !content) {
    return new Response(JSON.stringify({ error: "channel_id and content required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get channel
  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("id", channel_id)
    .eq("user_id", user.id)
    .single();

  if (!channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let externalId: string | null = null;
  let sendError: string | null = null;

  // Send via channel's API
  switch (channel.type) {
    case "whatsapp_evolution": {
      const config = channel.config as any;
      const apiUrl = config.api_url;
      const instance = config.instance_name;
      const apiKey = config.api_key;

      if (!apiUrl || !instance || !apiKey) {
        sendError = "Canal WhatsApp no configurado correctamente (api_url, instance_name, api_key)";
        break;
      }

      try {
        const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            number: recipient,
            text: content,
          }),
        });
        const data = await res.json();
        externalId = data.key?.id || null;
        if (!res.ok) sendError = JSON.stringify(data);
      } catch (e) {
        sendError = `Evolution API error: ${e.message}`;
      }
      break;
    }
    case "telegram": {
      const config = channel.config as any;
      const botToken = config.bot_token;
      const chatId = recipient;

      if (!botToken) {
        sendError = "Canal Telegram no configurado (bot_token)";
        break;
      }

      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: content }),
        });
        const data = await res.json();
        externalId = String(data.result?.message_id || "");
        if (!res.ok) sendError = JSON.stringify(data);
      } catch (e) {
        sendError = `Telegram error: ${e.message}`;
      }
      break;
    }
    default:
      // For other types, just record the message
      break;
  }

  if (sendError) {
    return new Response(JSON.stringify({ error: sendError }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Record outbound message
  const { data: msg, error: insertErr } = await supabase
    .from("channel_messages")
    .insert({
      user_id: user.id,
      channel_id,
      contact_id: contact_id || null,
      direction: "outbound",
      sender_name: "Tú",
      sender_identifier: "",
      content,
      external_id: externalId,
    })
    .select()
    .single();

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
