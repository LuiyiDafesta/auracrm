import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const BodySchema = z.object({
  campaign_id: z.string().uuid(),
  segment_id: z.string().uuid(),
  template_id: z.string().uuid(),
  emails_per_second: z.number().int().min(1).max(20).default(1),
  from_email: z.string().email().max(255).optional(),
  from_name: z.string().max(255).optional(),
  // A/B testing
  is_ab_test: z.boolean().default(false),
  template_id_b: z.string().uuid().optional(),
  ab_test_percentage: z.number().int().min(1).max(50).default(10),
  ab_wait_hours: z.number().int().min(1).max(168).default(24),
  // Date distribution
  distribute_over_days: z.boolean().default(false),
});

function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const endDate = new Date(end);
  while (d <= endDate) {
    dates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates.length > 0 ? dates : [new Date().toISOString().split("T")[0]];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
      return new Response(
        JSON.stringify({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, segment_id, template_id, emails_per_second, from_email, from_name,
            is_ab_test, template_id_b, ab_test_percentage, ab_wait_hours, distribute_over_days } = parsed.data;

    if (is_ab_test && !template_id_b) {
      return new Response(JSON.stringify({ error: "Se requiere una plantilla B para el A/B test" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify campaign belongs to user
    const { data: campaign } = await supabaseAdmin
      .from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaign || campaign.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Campaña no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contacts in segment with email
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

    const resolvedFromEmail = from_email || campaign.from_email || null;
    const resolvedFromName = from_name || campaign.from_name || null;

    // Calculate date distribution
    const dates = distribute_over_days && campaign.start_date && campaign.end_date
      ? getDatesBetween(campaign.start_date, campaign.end_date)
      : [new Date().toISOString().split("T")[0]];

    if (is_ab_test) {
      // === A/B TEST FLOW ===
      const shuffled = shuffleArray(validContacts);
      const testCount = Math.max(2, Math.floor(shuffled.length * (ab_test_percentage / 100)));
      const testPerVariant = Math.floor(testCount / 2);
      const testA = shuffled.slice(0, testPerVariant);
      const testB = shuffled.slice(testPerVariant, testPerVariant * 2);
      const remaining = shuffled.slice(testPerVariant * 2);

      // Create send A
      const { data: sendA, error: errA } = await supabaseAdmin.from("campaign_sends").insert({
        user_id: user.id, campaign_id, segment_id, template_id,
        emails_per_second, from_email: resolvedFromEmail, from_name: resolvedFromName,
        status: "processing", started_at: new Date().toISOString(),
        total_emails: testA.length,
        is_ab_test: true, ab_variant: "A", ab_test_percentage, ab_wait_hours,
      }).select().single();

      if (errA) throw new Error(errA.message);

      // Create send B
      const { data: sendB, error: errB } = await supabaseAdmin.from("campaign_sends").insert({
        user_id: user.id, campaign_id, segment_id, template_id: template_id_b!,
        emails_per_second, from_email: resolvedFromEmail, from_name: resolvedFromName,
        status: "processing", started_at: new Date().toISOString(),
        total_emails: testB.length,
        is_ab_test: true, ab_variant: "B", ab_parent_id: sendA.id,
        ab_test_percentage, ab_wait_hours, template_id_b: template_id_b!,
      }).select().single();

      if (errB) throw new Error(errB.message);

      // Update A with reference to B and store remaining count
      await supabaseAdmin.from("campaign_sends").update({
        ab_parent_id: sendB.id,
        template_id_b: template_id_b!,
      }).eq("id", sendA.id);

      // Enqueue test A emails
      const queueA = testA.map((c: any) => ({
        campaign_send_id: sendA.id, contact_id: c.contact_id,
        to_email: c.to_email, to_name: c.to_name, status: "pending",
        variant: "A", scheduled_date: dates[0],
      }));

      // Enqueue test B emails
      const queueB = testB.map((c: any) => ({
        campaign_send_id: sendB.id, contact_id: c.contact_id,
        to_email: c.to_email, to_name: c.to_name, status: "pending",
        variant: "B", scheduled_date: dates[0],
      }));

      // Insert in batches
      for (const batch of [queueA, queueB]) {
        for (let i = 0; i < batch.length; i += 500) {
          await supabaseAdmin.from("email_queue").insert(batch.slice(i, i + 500));
        }
      }

      return new Response(JSON.stringify({
        success: true, type: "ab_test",
        send_a_id: sendA.id, send_b_id: sendB.id,
        test_emails_a: testA.length, test_emails_b: testB.length,
        remaining_emails: remaining.length,
        wait_hours: ab_wait_hours,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      // === NORMAL SEND FLOW ===
      const { data: campaignSend, error: csError } = await supabaseAdmin
        .from("campaign_sends").insert({
          user_id: user.id, campaign_id, segment_id, template_id,
          emails_per_second, from_email: resolvedFromEmail, from_name: resolvedFromName,
          status: "processing", started_at: new Date().toISOString(),
          total_emails: validContacts.length,
        }).select().single();

      if (csError) throw new Error(csError.message);

      // Distribute contacts across dates
      const queueItems = validContacts.map((c: any, i: number) => ({
        campaign_send_id: campaignSend.id, contact_id: c.contact_id,
        to_email: c.to_email, to_name: c.to_name, status: "pending",
        scheduled_date: dates[i % dates.length],
      }));

      for (let i = 0; i < queueItems.length; i += 500) {
        const batch = queueItems.slice(i, i + 500);
        const { error: qError } = await supabaseAdmin.from("email_queue").insert(batch);
        if (qError) {
          await supabaseAdmin.from("campaign_sends").update({ status: "failed" }).eq("id", campaignSend.id);
          throw new Error(qError.message);
        }
      }

      return new Response(JSON.stringify({
        success: true, type: "normal",
        campaign_send_id: campaignSend.id,
        total_emails: validContacts.length,
        emails_per_second, days: dates.length,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
