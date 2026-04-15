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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { event_type, contact_id, user_id, event_data } = body;

    if (!event_type || !contact_id || !user_id) {
      // Also process waiting runs
      await processWaitingRuns();
      return new Response(JSON.stringify({ message: "Processed waiting runs" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active automations matching this trigger
    const { data: automations } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .eq("trigger_type", event_type);

    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "No matching automations" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const automation of automations) {
      // Check if trigger config matches
      if (!matchesTrigger(automation.trigger_config, event_data)) continue;

      // Check if this contact already has a running instance
      const { data: existingRun } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("automation_id", automation.id)
        .eq("contact_id", contact_id)
        .in("status", ["running", "waiting"])
        .limit(1)
        .single();

      if (existingRun) continue; // Already running

      // Create a new run
      const { data: run, error: runErr } = await supabase
        .from("automation_runs")
        .insert({
          automation_id: automation.id,
          user_id,
          contact_id,
          status: "running",
          context: { event_data: event_data || {} },
        })
        .select()
        .single();

      if (runErr) {
        results.push({ automation_id: automation.id, error: runErr.message });
        continue;
      }

      // Execute the workflow
      const workflow = automation.workflow || { nodes: [], edges: [] };
      const triggerNode = workflow.nodes.find((n: any) => n.type === "trigger");
      if (!triggerNode) continue;

      await executeFromNode(automation, run, workflow, triggerNode.id, contact_id, user_id);

      // Increment run count
      await supabase
        .from("automations")
        .update({ run_count: (automation.run_count || 0) + 1, last_run_at: new Date().toISOString() })
        .eq("id", automation.id);

      results.push({ automation_id: automation.id, run_id: run.id, status: "started" });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function matchesTrigger(config: any, eventData: any): boolean {
  if (!config || Object.keys(config).length === 0) return true;
  if (config.tag_id && eventData?.tag_id && config.tag_id !== eventData.tag_id) return false;
  if (config.segment_id && eventData?.segment_id && config.segment_id !== eventData.segment_id) return false;
  if (config.field_name && eventData?.field_name && config.field_name !== eventData.field_name) return false;
  if (config.value !== undefined && eventData?.value !== undefined) {
    if (String(config.value) !== String(eventData.value)) return false;
  }
  return true;
}

async function executeFromNode(automation: any, run: any, workflow: any, nodeId: string, contactId: string, userId: string) {
  const node = workflow.nodes.find((n: any) => n.id === nodeId);
  if (!node) {
    await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    return;
  }

  // Find next nodes via edges
  const outEdges = workflow.edges.filter((e: any) => e.source === nodeId);

  if (node.type === "trigger") {
    // Just go to next
    for (const edge of outEdges) {
      await executeFromNode(automation, run, workflow, edge.target, contactId, userId);
    }
    return;
  }

  if (node.type === "condition") {
    const result = await evaluateCondition(node.data, contactId, userId);
    await logStep(run.id, node.id, "condition", node.data.nodeType, { result });

    const nextEdge = outEdges.find((e: any) => e.sourceHandle === (result ? "yes" : "no"));
    if (nextEdge) {
      await executeFromNode(automation, run, workflow, nextEdge.target, contactId, userId);
    } else {
      await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    }
    return;
  }

  if (node.type === "action") {
    const actionType = node.data.nodeType;

    if (actionType === "wait") {
      const hours = node.data.config?.wait_unit === "hours"
        ? (node.data.config?.wait_value || 1)
        : (node.data.config?.wait_value || 1) * 24;
      const waitUntil = new Date(Date.now() + hours * 3600000).toISOString();

      await supabase.from("automation_runs").update({
        status: "waiting",
        current_step_id: nodeId,
        wait_until: waitUntil,
      }).eq("id", run.id);

      await logStep(run.id, node.id, "action", "wait", { wait_until: waitUntil });
      return; // Stop here, cron will resume
    }

    try {
      const result = await executeAction(node.data, contactId, userId);
      await logStep(run.id, node.id, "action", actionType, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logStep(run.id, node.id, "action", actionType, null, msg);
      await supabase.from("automation_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id);
      return;
    }

    // Continue to next nodes
    if (outEdges.length > 0) {
      for (const edge of outEdges) {
        await executeFromNode(automation, run, workflow, edge.target, contactId, userId);
      }
    } else {
      await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    }
  }
}

async function evaluateCondition(data: any, contactId: string, userId: string): Promise<boolean> {
  const { nodeType, config } = data;

  if (nodeType === "has_tag" || nodeType === "not_has_tag") {
    const { data: ct } = await supabase
      .from("contact_tags").select("id").eq("contact_id", contactId).eq("tag_id", config?.tag_id).limit(1).single();
    return nodeType === "has_tag" ? !!ct : !ct;
  }

  if (nodeType === "lead_score_gt" || nodeType === "lead_score_lt") {
    const { data: contact } = await supabase.from("contacts").select("lead_score").eq("id", contactId).single();
    if (!contact) return false;
    return nodeType === "lead_score_gt" ? contact.lead_score > (config?.value || 0) : contact.lead_score < (config?.value || 0);
  }

  if (nodeType === "status_is") {
    const { data: contact } = await supabase.from("contacts").select("status").eq("id", contactId).single();
    return contact?.status === config?.value;
  }

  if (nodeType === "in_segment" || nodeType === "not_in_segment") {
    const { data: sc } = await supabase
      .from("segment_contacts").select("id").eq("contact_id", contactId).eq("segment_id", config?.segment_id).limit(1).single();
    return nodeType === "in_segment" ? !!sc : !sc;
  }

  return true;
}

async function executeAction(data: any, contactId: string, userId: string): Promise<any> {
  const { nodeType, config } = data;

  if (nodeType === "send_email") {
    // Get SMTP config and template, then send
    const [smtpRes, tmplRes, contactRes] = await Promise.all([
      supabase.from("smtp_config").select("*").eq("user_id", userId).single(),
      supabase.from("email_templates").select("*").eq("id", config?.template_id).single(),
      supabase.from("contacts").select("email, first_name, last_name").eq("id", contactId).single(),
    ]);

    if (!smtpRes.data) throw new Error("No SMTP config");
    if (!tmplRes.data) throw new Error("Template not found");
    if (!contactRes.data?.email) throw new Error("Contact has no email");

    const smtp = smtpRes.data;
    const template = tmplRes.data;
    const contact = contactRes.data;
    const tls = smtp.encryption === "tls" || smtp.encryption === "ssl";

    const client = new SMTPClient({
      connection: {
        hostname: smtp.host, port: smtp.port, tls,
        auth: { username: smtp.username, password: smtp.password },
      },
    });

    let html = template.html_content || "<p>Sin contenido</p>";
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    html = html.replace(/\{\{nombre\}\}/gi, name);
    html = html.replace(/\{\{email\}\}/gi, contact.email);

    const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;
    await client.send({ from, to: contact.email, subject: template.subject || "(Sin asunto)", content: "auto", html });
    await client.close();

    return { sent_to: contact.email };
  }

  if (nodeType === "add_tag") {
    await supabase.from("contact_tags").insert({ contact_id: contactId, tag_id: config?.tag_id });
    return { tag_id: config?.tag_id };
  }

  if (nodeType === "remove_tag") {
    await supabase.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", config?.tag_id);
    return { tag_id: config?.tag_id };
  }

  if (nodeType === "update_status") {
    await supabase.from("contacts").update({ status: config?.new_status }).eq("id", contactId);
    return { new_status: config?.new_status };
  }

  if (nodeType === "update_lead_score") {
    const { data: contact } = await supabase.from("contacts").select("lead_score").eq("id", contactId).single();
    let newScore = contact?.lead_score || 0;
    if (config?.operation === "add") newScore += (config?.value || 0);
    else if (config?.operation === "subtract") newScore -= (config?.value || 0);
    else if (config?.operation === "set") newScore = config?.value || 0;
    await supabase.from("contacts").update({ lead_score: Math.max(0, newScore) }).eq("id", contactId);
    return { new_score: Math.max(0, newScore) };
  }

  if (nodeType === "update_field") {
    const field = config?.field_name;
    if (field && ["notes", "phone", "position", "status"].includes(field)) {
      await supabase.from("contacts").update({ [field]: config?.value }).eq("id", contactId);
    }
    return { field, value: config?.value };
  }

  if (nodeType === "add_to_segment") {
    await supabase.from("segment_contacts").insert({ contact_id: contactId, segment_id: config?.segment_id });
    return { segment_id: config?.segment_id };
  }

  if (nodeType === "remove_from_segment") {
    await supabase.from("segment_contacts").delete().eq("contact_id", contactId).eq("segment_id", config?.segment_id);
    return { segment_id: config?.segment_id };
  }

  return {};
}

async function logStep(runId: string, stepId: string, stepType: string, action: string, result?: any, errorMessage?: string) {
  await supabase.from("automation_run_logs").insert({
    run_id: runId, step_id: stepId, step_type: stepType,
    action, result: result || {}, error_message: errorMessage || null,
  });
}

async function processWaitingRuns() {
  const now = new Date().toISOString();
  const { data: waitingRuns } = await supabase
    .from("automation_runs")
    .select("*, automations(*)")
    .eq("status", "waiting")
    .lte("wait_until", now)
    .limit(20);

  if (!waitingRuns || waitingRuns.length === 0) return;

  for (const run of waitingRuns) {
    const automation = (run as any).automations;
    if (!automation) continue;

    const workflow = automation.workflow || { nodes: [], edges: [] };
    const currentStepId = run.current_step_id;

    // Mark as running
    await supabase.from("automation_runs").update({ status: "running" }).eq("id", run.id);

    // Find next edges from current step
    const outEdges = workflow.edges.filter((e: any) => e.source === currentStepId);
    if (outEdges.length > 0) {
      for (const edge of outEdges) {
        await executeFromNode(automation, run, workflow, edge.target, run.contact_id, run.user_id);
      }
    } else {
      await supabase.from("automation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
    }
  }
}
