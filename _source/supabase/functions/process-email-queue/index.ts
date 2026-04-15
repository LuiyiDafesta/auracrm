import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  const pixelUrl = `${FUNCTION_BASE}?t=open&q=${queueItemId}&s=${campaignSendId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  let tracked = html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url) => {
    const trackUrl = `${FUNCTION_BASE}?t=click&q=${queueItemId}&s=${campaignSendId}&url=${encodeURIComponent(url)}`;
    return `href="${trackUrl}"`;
  });

  if (tracked.includes("</body>")) {
    tracked = tracked.replace("</body>", `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  return tracked;
}

/**
 * Send a single email via Emailit HTTP API or generic SMTP.
 */
async function sendEmail(
  smtpConfig: any,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (smtpConfig.host?.includes("emailit.com")) {
    // Emailit: SMTP password = API key
    const res = await fetch("https://api.emailit.com/v2/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${smtpConfig.password}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Emailit API error (${res.status}): ${body}`);
    }
  } else {
    throw new Error(`El proveedor SMTP "${smtpConfig.host}" no es compatible con Edge Functions. Usa Emailit (smtp.emailit.com).`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

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

  const { data: smtpConfig } = await supabase
    .from("smtp_config")
    .select("*")
    .eq("user_id", send.user_id)
    .single();

  if (!smtpConfig) {
    await supabase.from("campaign_sends").update({ status: "failed" }).eq("id", send.id);
    return { send_id: send.id, error: "No hay configuración SMTP" };
  }

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

  // Fetch pending emails for today
  const { data: pendingEmails } = await supabase
    .from("email_queue")
    .select("*")
    .eq("campaign_send_id", send.id)
    .eq("status", "pending")
    .or(`scheduled_date.is.null,scheduled_date.lte.${today}`)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (!pendingEmails || pendingEmails.length === 0) {
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
      return { send_id: send.id, status: "completed" };
    }

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
      html = injectTracking(html, email.id, send.id);

      await sendEmail(smtpConfig, from, email.to_email, template.subject || "(Sin asunto)", html);

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

  const newSent = (send.sent_count || 0) + sentInBatch;
  const newFailed = (send.failed_count || 0) + failedInBatch;
  const totalProcessed = newSent + newFailed;

  const updateData: any = { sent_count: newSent, failed_count: newFailed };
  if (totalProcessed >= send.total_emails) {
    updateData.status = "completed";
    updateData.completed_at = new Date().toISOString();
  }

  await supabase.from("campaign_sends").update(updateData).eq("id", send.id);

  return { send_id: send.id, sent: sentInBatch, failed: failedInBatch, remaining: send.total_emails - totalProcessed };
}
