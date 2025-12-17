/**
 * Script to view recent task breakdown responses from Edge Function logs
 * Usage: node scripts/view-recent-responses.js
 * 
 * Note: This requires Supabase CLI to be configured and logged in
 */

const { execSync } = require('child_process');

async function viewRecentLogs() {
  try {
    console.log('📋 Fetching recent Edge Function logs...\n');
    console.log('='.repeat(80));
    
    // Get recent logs from Supabase
    const logs = execSync(
      'npx supabase@latest functions logs break-task --limit 50',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    console.log(logs);
    
    // Try to extract JSON responses
    const jsonMatches = logs.match(/\{[^{}]*"steps"[^{}]*\}/g);
    if (jsonMatches && jsonMatches.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('\n📝 Extracted JSON Responses:\n');
      jsonMatches.forEach((match, index) => {
        try {
          const parsed = JSON.parse(match);
          if (parsed.steps) {
            console.log(`\nResponse ${index + 1}:`);
            console.log(JSON.stringify(parsed, null, 2));
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching logs:', error.message);
    console.log('\n💡 Alternative: Check Supabase Dashboard → Edge Functions → break-task → Logs');
  }
}

viewRecentLogs();












