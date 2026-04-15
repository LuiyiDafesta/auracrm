import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FUNCTION_BASE = Deno.env.get("SUPABASE_URL")! + "/functions/v1/email-track";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function injectTracking(html: string, queueItemId: string, campaignSendId: string): string {
  // Inject open tracking pixel before </body>
  const pixelUrl = `${FUNCTION_BASE}?t=open&q=${queueItemId}&s=${campaignSendId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  // Replace links with click tracking redirects
  let tracked = html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url) => {
    const trackUrl = `${FUNCTION_BASE}?t=click&q=${queueItemId}&s=${campaignSendId}&url=${encodeURIComponent(url)}`;
    return `href="${trackUrl}"`;
  });

  // Add pixel
  if (tracked.includes("</body>")) {
    tracked = tracked.replace("</body>", `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  return tracked;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Find active campaign_sends that are processing
    const { data: activeSends } = await supabase
      .from("campaign_sends")
      .select("*")
      .eq("status", "processing")
      .order("created_at", { ascending: true })
      .limit(5);

    if (!activeSends || activeSends.length === 0) {
      return new Response(JSON.stringify({ message: "No hay envíos pendientes" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const send of activeSends) {
      const result = await processSend(send, today);
      results.push(result);
    }

    return new Response(JSON.stringify({ processed: results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processSend(send: any, today: string) {
  const batchSize = send.emails_per_second || 1;

  // Get SMTP config for this user
  const { data: smtpConfig } = await supabase
    .from("smtp_config")
    .select("*")
    .eq("user_id", send.user_id)
    .single();

  if (!smtpConfig) {
    await supabase.from("campaign_sends").update({ status: "failed" }).eq("id", send.id);
    return { send_id: send.id, error: "No hay configuración SMTP" };
  }

  // Get the email template
  const { data: template } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", send.template_id)
    .single();

  if (!template) {
    await supabase.from("campaign_sends").update({ status: "failed" }).eq("id", send.id);
    return { send_id: send.id, error: "Plantilla no encontrada" };
  }

  const fromEmail = send.from_email || smtpConfig.from_email;
  const fromName = send.from_name || smtpConfig.from_name || "";

  // Connect SMTP
  let client: SMTPClient;
  try {
    const tls = smtpConfig.encryption === "tls" || smtpConfig.encryption === "ssl";
    client = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        tls,
        auth: {
          username: smtpConfig.username,
          password: smtpConfig.password,
        },
      },
    });
  } catch (e) {
    await supabase.from("campaign_sends").update({ status: "failed" }).eq("id", send.id);
    return { send_id: send.id, error: `Error SMTP: ${e instanceof Error ? e.message : e}` };
  }

  // Fetch pending emails for today (or without scheduled_date) in batch
  const { data: pendingEmails } = await supabase
    .from("email_queue")
    .select("*")
    .eq("campaign_send_id", send.id)
    .eq("status", "pending")
    .or(`scheduled_date.is.null,scheduled_date.lte.${today}`)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (!pendingEmails || pendingEmails.length === 0) {
    // Check if there are future scheduled emails
    const { count } = await supabase
      .from("email_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_send_id", send.id)
      .eq("status", "pending");

    if (!count || count === 0) {
      await supabase.from("campaign_sends").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", send.id);
      try { await client.close(); } catch (_) {}
      return { send_id: send.id, status: "completed" };
    }

    // Future emails exist, skip for now
    try { await client.close(); } catch (_) {}
    return { send_id: send.id, status: "waiting_for_scheduled_date", remaining: count };
  }

  let sentInBatch = 0;
  let failedInBatch = 0;

  for (const email of pendingEmails) {
    await supabase.from("email_queue").update({ status: "sending" }).eq("id", email.id);

    try {
      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      let html = template.html_content || "<p>Sin contenido</p>";
      html = html.replace(/\{\{nombre\}\}/gi, email.to_name || "");
      html = html.replace(/\{\{email\}\}/gi, email.to_email || "");

      // Inject tracking
      html = injectTracking(html, email.id, send.id);

      await client.send({
        from,
        to: email.to_email,
        subject: template.subject || "(Sin asunto)",
        content: "auto",
        html,
      });

      await supabase.from("email_queue").update({
        status: "sent", sent_at: new Date().toISOString(),
      }).eq("id", email.id);

      sentInBatch++;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      await supabase.from("email_queue").update({
        status: "failed", error_message: errorMsg.substring(0, 500),
      }).eq("id", email.id);
      failedInBatch++;
    }

    if (batchSize > 1) await sleep(Math.floor(1000 / batchSize));
  }

  // Update counts
  const newSent = (send.sent_count || 0) + sentInBatch;
  const newFailed = (send.failed_count || 0) + failedInBatch;
  const totalProcessed = newSent + newFailed;

  const updateData: any = { sent_count: newSent, failed_count: newFailed };
  if (totalProcessed >= send.total_emails) {
    updateData.status = "completed";
    updateData.completed_at = new Date().toISOString();
  }

  await supabase.from("campaign_sends").update(updateData).eq("id", send.id);

  try { await client.close(); } catch (_) {}

  return { send_id: send.id, sent: sentInBatch, failed: failedInBatch, remaining: send.total_emails - totalProcessed };
}
