/**
 * Script to list available Gemini models from Google AI Studio
 * Usage: node scripts/list-gemini-models.js YOUR_GEMINI_API_KEY
 */

const geminiApiKey = process.argv[2];

if (!geminiApiKey) {
  console.error('❌ Please provide your Gemini API key as an argument');
  console.log('Usage: node scripts/list-gemini-models.js YOUR_GEMINI_API_KEY');
  process.exit(1);
}

async function listModels(apiVersion = 'v1beta') {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${geminiApiKey}`;
  
  try {
    console.log(`\n🔍 Fetching models from ${apiVersion}...\n`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error (${apiVersion}): ${response.status} ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    if (models.length === 0) {
      console.log(`⚠️  No models found in ${apiVersion}`);
      return null;
    }
    
    console.log(`✅ Found ${models.length} models in ${apiVersion}:\n`);
    
    // Filter models that support generateContent
    const generateContentModels = models.filter(model => 
      model.supportedGenerationMethods?.includes('generateContent')
    );
    
    if (generateContentModels.length > 0) {
      console.log('📝 Models that support generateContent:\n');
      generateContentModels.forEach(model => {
        console.log(`  • ${model.name}`);
        if (model.displayName) {
          console.log(`    Display Name: ${model.displayName}`);
        }
        if (model.description) {
          console.log(`    Description: ${model.description}`);
        }
        console.log('');
      });
    }
    
    // Show all models
    console.log('\n📋 All available models:\n');
    models.forEach(model => {
      console.log(`  • ${model.name}`);
      if (model.supportedGenerationMethods) {
        console.log(`    Methods: ${model.supportedGenerationMethods.join(', ')}`);
      }
      console.log('');
    });
    
    return generateContentModels;
  } catch (error) {
    console.error(`❌ Error fetching models from ${apiVersion}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Listing Gemini models...\n');
  console.log('=' .repeat(60));
  
  // Try both API versions
  const v1betaModels = await listModels('v1beta');
  console.log('\n' + '='.repeat(60));
  const v1Models = await listModels('v1');
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Recommendation:\n');
  
  if (v1betaModels && v1betaModels.length > 0) {
    const recommended = v1betaModels.find(m => 
      m.name.includes('flash') || m.name.includes('2.0')
    ) || v1betaModels[0];
    console.log(`   Use: ${recommended.name}`);
    console.log(`   API Version: v1beta`);
  } else if (v1Models && v1Models.length > 0) {
    const recommended = v1Models.find(m => 
      m.name.includes('flash') || m.name.includes('2.0')
    ) || v1Models[0];
    console.log(`   Use: ${recommended.name}`);
    console.log(`   API Version: v1`);
  } else {
    console.log('   ⚠️  No generateContent-compatible models found.');
    console.log('   Check your API key and account permissions.');
  }
  
  console.log('\n');
}

main().catch(console.error);












