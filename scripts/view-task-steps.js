/**
 * Script to view task breakdown steps from database
 * Usage: node scripts/view-task-steps.js [limit]
 * 
 * Requires: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const limit = parseInt(process.argv[2]) || 10;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('Required: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function viewTaskSteps() {
  try {
    console.log(`\n📋 Fetching last ${limit} task records...\n`);
    console.log('='.repeat(80));
    
    const { data, error } = await supabase
      .from('tasks')
      .select('id, input_hash, steps, token_usage, latency_ms, fallback_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Error fetching tasks:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No tasks found in database.');
      return;
    }
    
    data.forEach((task, index) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`\n📝 Task #${index + 1}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Created: ${new Date(task.created_at).toLocaleString()}`);
      console.log(`   Input Hash: ${task.input_hash.substring(0, 16)}...`);
      console.log(`   Token Usage: ${task.token_usage || 'N/A'}`);
      console.log(`   Latency: ${task.latency_ms || 'N/A'}ms`);
      console.log(`   Fallback Reason: ${task.fallback_reason || 'None'}`);
      
      if (task.steps && Array.isArray(task.steps)) {
        console.log(`\n   ✅ Steps (${task.steps.length}):`);
        task.steps.forEach((step, stepIndex) => {
          console.log(`      ${stepIndex + 1}. ${step}`);
        });
      } else if (task.steps) {
        console.log(`\n   ⚠️  Steps (not an array):`, JSON.stringify(task.steps, null, 2));
      } else {
        console.log(`\n   ⚠️  No steps stored`);
      }
    });
    
    console.log(`\n${'─'.repeat(80)}\n`);
    console.log(`✅ Total: ${data.length} tasks\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

viewTaskSteps();












