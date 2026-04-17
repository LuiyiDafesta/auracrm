import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim().replace(/^"|"$/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSync() {
    console.log("Fetching a random contact with its opportunities...");
    
    // Get a contact that has ANY opportunity
    const { data: opps, error: err1 } = await supabase.from('opportunities').select('contact_id, is_archived').limit(1);
    if (!opps || opps.length === 0) {
        console.log("No opportunities found AT ALL.");
        return;
    }
    
    const contactId = opps[0].contact_id;
    console.log("Contact ID to test:", contactId);

    // Initial state
    const { data: contact1 } = await supabase.from('contacts').select('lead_score').eq('id', contactId).single();
    const { data: opps1 } = await supabase.from('opportunities').select('id, probability, name, is_archived').eq('contact_id', contactId);
    
    console.log("--- BEFORE UPDATE ---");
    console.log("Contact lead_score:", contact1?.lead_score);
    console.log("Opportunities:", opps1);

    // Update Contact lead score to 42
    console.log("\nUpdating contact lead_score to 42...");
    const { error: errUpdate } = await supabase.from('contacts').update({ lead_score: 42 }).eq('id', contactId);
    if (errUpdate) console.error("Update failed:", errUpdate);

    // State immediately after update
    const { data: contact2 } = await supabase.from('contacts').select('lead_score').eq('id', contactId).single();
    const { data: opps2 } = await supabase.from('opportunities').select('id, probability, name, is_archived').eq('contact_id', contactId);
    
    console.log("--- AFTER UPDATE ---");
    console.log("Contact lead_score:", contact2?.lead_score);
    console.log("Opportunities:", opps2);

}

testSync();
