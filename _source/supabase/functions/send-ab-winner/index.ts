import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Called when user picks the A/B winner. Enqueues remaining contacts with the winning template.
const BodySchema = z.object({
  winner_send_id: z.string().uuid(), // The campaign_send (A or B) that won
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the winner send
    const { data: winnerSend } = await supabaseAdmin
      .from("campaign_sends").select("*").eq("id", parsed.data.winner_send_id).single();

    if (!winnerSend || winnerSend.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Envío no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!winnerSend.is_ab_test) {
      return new Response(JSON.stringify({ error: "Este envío no es un A/B test" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get both A and B sends
    const partnerId = winnerSend.ab_parent_id;
    if (!partnerId) {
      return new Response(JSON.stringify({ error: "No se encontró la variante complementaria" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all contacts already sent (both A and B)
    const { data: sentEmails } = await supabaseAdmin
      .from("email_queue")
      .select("contact_id")
      .in("campaign_send_id", [winnerSend.id, partnerId]);

    const sentContactIds = new Set((sentEmails || []).map((e: any) => e.contact_id));

    // Get all segment contacts
    const { data: segmentContacts } = await supabaseAdmin
      .from("segment_contacts")
      .select("contact_id, contacts(id, email, first_name, last_name)")
      .eq("segment_id", winnerSend.segment_id);

    const remaining = (segmentContacts || [])
      .filter((sc: any) => sc.contacts?.email && !sentContactIds.has(sc.contacts.id))
      .map((sc: any) => ({
        contact_id: sc.contacts.id,
        to_email: sc.contacts.email,
        to_name: [sc.contacts.first_name, sc.contacts.last_name].filter(Boolean).join(" "),
      }));

    if (remaining.length === 0) {
      return new Response(JSON.stringify({ error: "No quedan contactos para enviar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign for date distribution
    const { data: campaign } = await supabaseAdmin
      .from("campaigns").select("*").eq("id", winnerSend.campaign_id).single();

    const today = new Date().toISOString().split("T")[0];
    let dates = [today];
    if (campaign?.start_date && campaign?.end_date) {
      const start = new Date(campaign.start_date);
      const end = new Date(campaign.end_date);
      const now = new Date(today);
      // Use remaining days from today to end
      const d = now > start ? now : start;
      dates = [];
      while (d <= end) {
        dates.push(d.toISOString().split("T")[0]);
        d.setDate(d.getDate() + 1);
      }
      if (dates.length === 0) dates = [today];
    }

    // Create winner send
    const { data: winnerCampaignSend, error: wsErr } = await supabaseAdmin
      .from("campaign_sends").insert({
        user_id: user.id,
        campaign_id: winnerSend.campaign_id,
        segment_id: winnerSend.segment_id,
        template_id: winnerSend.template_id,
        emails_per_second: winnerSend.emails_per_second,
        from_email: winnerSend.from_email,
        from_name: winnerSend.from_name,
        status: "processing",
        started_at: new Date().toISOString(),
        total_emails: remaining.length,
        is_ab_test: false,
      }).select().single();

    if (wsErr) throw new Error(wsErr.message);

    // Enqueue remaining
    const queueItems = remaining.map((c: any, i: number) => ({
      campaign_send_id: winnerCampaignSend.id,
      contact_id: c.contact_id,
      to_email: c.to_email,
      to_name: c.to_name,
      status: "pending",
      scheduled_date: dates[i % dates.length],
    }));

    for (let i = 0; i < queueItems.length; i += 500) {
      await supabaseAdmin.from("email_queue").insert(queueItems.slice(i, i + 500));
    }

    // Mark both A/B sends as winner_sent
    await supabaseAdmin.from("campaign_sends").update({ ab_winner_sent: true }).in("id", [winnerSend.id, partnerId]);

    return new Response(JSON.stringify({
      success: true,
      winner_variant: winnerSend.ab_variant,
      remaining_emails: remaining.length,
      campaign_send_id: winnerCampaignSend.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
