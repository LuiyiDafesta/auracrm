import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: /channel-webhook/{channel_id}
  const channelId = pathParts[pathParts.length - 1];

  if (!channelId || channelId === "channel-webhook") {
    return new Response(JSON.stringify({ error: "Missing channel_id in URL" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get channel config
  const { data: channel, error: chErr } = await supabase
    .from("channels")
    .select("*")
    .eq("id", channelId)
    .single();

  if (chErr || !channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify webhook secret if configured
  const secret = url.searchParams.get("secret");
  if (channel.webhook_secret && secret !== channel.webhook_secret) {
    return new Response(JSON.stringify({ error: "Invalid secret" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let messages: Array<{
    sender_name: string;
    sender_identifier: string;
    content: string;
    media_url?: string;
    media_type?: string;
    external_id?: string;
    metadata?: any;
  }> = [];

  // Parse based on channel type
  switch (channel.type) {
    case "whatsapp_evolution": {
      // Evolution API v2 webhook format
      const data = body.data || body;
      if (body.event === "messages.upsert" || data.key) {
        const msg = data.message || data;
        const key = data.key || {};
        if (key.fromMe) break; // Skip outbound
        messages.push({
          sender_name: data.pushName || key.remoteJid?.split("@")[0] || "Desconocido",
          sender_identifier: key.remoteJid || data.from || "",
          content: msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || "[Media]",
          media_url: msg.imageMessage?.url || msg.videoMessage?.url || msg.audioMessage?.url || undefined,
          media_type: msg.imageMessage ? "image" : msg.videoMessage ? "video" : msg.audioMessage ? "audio" : undefined,
          external_id: key.id || data.id || undefined,
          metadata: body,
        });
      }
      break;
    }
    case "telegram": {
      // Telegram Bot API webhook format
      const msg = body.message || body.edited_message;
      if (msg) {
        messages.push({
          sender_name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Desconocido",
          sender_identifier: String(msg.from?.id || msg.chat?.id || ""),
          content: msg.text || msg.caption || "[Media]",
          media_url: undefined, // Would need getFile call
          media_type: msg.photo ? "image" : msg.video ? "video" : msg.voice ? "audio" : undefined,
          external_id: String(body.update_id || ""),
          metadata: body,
        });
      }
      break;
    }
    case "email": {
      // Generic email webhook (e.g., from forwarding service)
      messages.push({
        sender_name: body.from_name || body.from || "Desconocido",
        sender_identifier: body.from_email || body.from || body.sender || "",
        content: body.text || body.html || body.body || body.subject || "",
        external_id: body.message_id || body.id || undefined,
        metadata: body,
      });
      break;
    }
    default: {
      // Generic webhook — try to extract what we can
      messages.push({
        sender_name: body.name || body.sender_name || body.from || "Desconocido",
        sender_identifier: body.phone || body.email || body.identifier || body.from || "",
        content: body.message || body.text || body.content || body.body || JSON.stringify(body).slice(0, 500),
        external_id: body.id || body.message_id || undefined,
        metadata: body,
      });
    }
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processedCount = 0;

  for (const msg of messages) {
    // Skip duplicates by external_id
    if (msg.external_id) {
      const { data: existing } = await supabase
        .from("channel_messages")
        .select("id")
        .eq("channel_id", channelId)
        .eq("external_id", msg.external_id)
        .maybeSingle();
      if (existing) continue;
    }

    // Try to match existing contact by identifier (phone/email)
    let contactId: string | null = null;
    if (msg.sender_identifier) {
      const identifier = msg.sender_identifier.replace(/@.*$/, ""); // Clean WhatsApp JID
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", channel.user_id)
        .or(`phone.ilike.%${identifier}%,email.ilike.%${identifier}%`)
        .limit(1);

      if (contacts && contacts.length > 0) {
        contactId = contacts[0].id;
      }
      // No auto-create — user creates contacts manually from the inbox
    }

    // Insert message
    await supabase.from("channel_messages").insert({
      user_id: channel.user_id,
      channel_id: channelId,
      contact_id: contactId,
      direction: "inbound",
      sender_name: msg.sender_name,
      sender_identifier: msg.sender_identifier,
      content: msg.content,
      media_url: msg.media_url || null,
      media_type: msg.media_type || null,
      external_id: msg.external_id || null,
      metadata: msg.metadata || {},
    });

    processedCount++;
  }

  return new Response(JSON.stringify({ ok: true, processed: processedCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
