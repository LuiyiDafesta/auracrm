import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const BodySchema = z.object({
  campaign_id: z.string().uuid(),
  segment_id: z.string().uuid(),
  template_id: z.string().uuid(),
  emails_per_second: z.number().int().min(1).max(20).default(1),
  from_email: z.string().email().max(255).optional(),
  from_name: z.string().max(255).optional(),
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
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
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
      return new Response(
        JSON.stringify({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, segment_id, template_id, emails_per_second, from_email, from_name } = parsed.data;

    // Use service role to read segment contacts and insert queue
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify campaign belongs to user
    const { data: campaign } = await supabaseAdmin
      .from("campaigns").select("id, user_id, from_email, from_name").eq("id", campaign_id).single();
    if (!campaign || campaign.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Campaña no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contacts in segment that have an email
    const { data: segmentContacts, error: scError } = await supabaseAdmin
      .from("segment_contacts")
      .select("contact_id, contacts(id, email, first_name, last_name)")
      .eq("segment_id", segment_id);

    if (scError) {
      return new Response(JSON.stringify({ error: scError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validContacts = (segmentContacts || [])
      .filter((sc: any) => sc.contacts?.email)
      .map((sc: any) => ({
        contact_id: sc.contacts.id,
        to_email: sc.contacts.email,
        to_name: [sc.contacts.first_name, sc.contacts.last_name].filter(Boolean).join(" "),
      }));

    if (validContacts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay contactos con email en este segmento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine sender: param > campaign > global smtp (resolved at send time)
    const resolvedFromEmail = from_email || campaign.from_email || null;
    const resolvedFromName = from_name || campaign.from_name || null;

    // Create campaign_send record
    const { data: campaignSend, error: csError } = await supabaseAdmin
      .from("campaign_sends")
      .insert({
        user_id: user.id,
        campaign_id,
        segment_id,
        template_id,
        emails_per_second,
        total_emails: validContacts.length,
        from_email: resolvedFromEmail,
        from_name: resolvedFromName,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (csError) {
      return new Response(JSON.stringify({ error: csError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enqueue all emails
    const queueItems = validContacts.map((c: any) => ({
      campaign_send_id: campaignSend.id,
      contact_id: c.contact_id,
      to_email: c.to_email,
      to_name: c.to_name,
      status: "pending",
    }));

    // Insert in batches of 500
    for (let i = 0; i < queueItems.length; i += 500) {
      const batch = queueItems.slice(i, i + 500);
      const { error: qError } = await supabaseAdmin.from("email_queue").insert(batch);
      if (qError) {
        await supabaseAdmin.from("campaign_sends").update({ status: "failed" }).eq("id", campaignSend.id);
        return new Response(JSON.stringify({ error: qError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign_send_id: campaignSend.id,
        total_emails: validContacts.length,
        emails_per_second,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
