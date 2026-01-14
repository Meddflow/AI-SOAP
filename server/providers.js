// Model configuration
const MODEL_REGISTRY = {
  google: {
    'gemini 2.5 flash': 'gemini-2.5-flash',
    'gemini 2.5 pro': 'gemini-2.5-pro'
  },
  openai: {
    // GPT-5 series
    'gpt-5': 'gpt-5',
    'gpt 5': 'gpt-5',
    'gpt-5-mini': 'gpt-5-mini',
    'gpt 5 mini': 'gpt-5-mini',
    'gpt-5-nano': 'gpt-5-nano',
    'gpt 5 nano': 'gpt-5-nano',
    // GPT-5.1 series
    'gpt-5.1': 'gpt-5.1',
    'gpt 5.1': 'gpt-5.1',
    // GPT-5.2 series (latest)
    'gpt-5.2': 'gpt-5.2',
    'gpt 5.2': 'gpt-5.2',
    'gpt-5.2-instant': 'gpt-5.2-instant',
    'gpt 5.2 instant': 'gpt-5.2-instant',
    'gpt-5.2-thinking': 'gpt-5.2-thinking',
    'gpt 5.2 thinking': 'gpt-5.2-thinking'
  },
  mistral: {
    'mistral small': 'mistral-small',
    'mistral large': 'mistral-large'
  }
};

// API endpoints
const API_ENDPOINTS = {
  google: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  openai: 'https://api.openai.com/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions'
};

/**
 * Maps a model name to its provider and actual model identifier
 */
function resolveModel(modelName) {
  const normalized = modelName.trim().toLowerCase();
  
  for (const [provider, models] of Object.entries(MODEL_REGISTRY)) {
    if (models[normalized]) {
      return { provider, model: models[normalized] };
    }
  }
  
  return { provider: 'unknown', model: normalized };
}

/**
 * Builds the SOAP note generation prompt
 */
function buildSOAPPrompt({ notes, vitals, complaintType, painScale, diagnosisTags }) {
  const vitalsText = formatVitals(vitals);
  const tagsText = formatDiagnosisTags(diagnosisTags);
  
  // Build detailed vitals breakdown for better context
  const vitalsDetail = vitals && typeof vitals === 'object' ? [
    vitals.bp && `Blood Pressure: ${vitals.bp} mmHg`,
    vitals.hr && `Heart Rate: ${vitals.hr} bpm`,
    vitals.rr && `Respiratory Rate: ${vitals.rr} breaths/min`,
    vitals.spo2 && `Oxygen Saturation: ${vitals.spo2}%`,
    vitals.temp && `Temperature: ${vitals.temp}°C`
  ].filter(Boolean).join('\n  ') : 'Not provided';
  
  return [
    'You are an AI Visit Summary Generator that converts doctor\'s free-text notes and structured inputs into clean, standardized SOAP format.',
    '',
    'CRITICAL: You MUST generate ALL FOUR sections (S, O, A, P). Never skip the Plan section.',
    '',
    'INPUT DATA:',
    `- Doctor's free-text notes: ${notes || 'Not provided'}`,
    `- Chief complaint: ${complaintType || 'Not provided'}`,
    `- Pain scale (0-10): ${formatPainScale(painScale)}`,
    '',
    'VITAL SIGNS (use these in the Objective section):',
    `  ${vitalsDetail}`,
    '',
    `- Associated diagnosis tags: ${tagsText || 'None'}`,
    '',
    'REQUIRED JSON STRUCTURE (all 4 fields are MANDATORY):',
    '{',
    '  "subjective": "...",',
    '  "objective": "...",',
    '  "assessment": "...",',
    '  "plan": "..."',
    '}',
    '',
    'SECTION DEFINITIONS:',
    '1. SUBJECTIVE (S): Patient\'s complaint, symptoms, history, onset, progression, relevant background. Include pain scale if provided.',
    '2. OBJECTIVE (O): Vital signs + Physical exam findings extracted from doctor\'s notes (what doctor observed, examined, measured, or tested). Extract ALL objective observations from the notes.',
    '3. ASSESSMENT (A): Clinical diagnosis - most probable condition with differentials if applicable',
    '4. PLAN (P): Treatment plan - medications (with dose/route), patient advice, follow-up instructions, activity restrictions',
    '',
    'EXAMPLE:',
    'Input Notes: "Passenger is former diver... now pain during cruising... advised clearing ears... two tablets paracetamol... examined ears, tympanic membranes look normal, no redness"',
    'Vitals: BP 120/80, HR 78, SpO₂ 98%',
    'Pain Scale: 6',
    '',
    'Correct Output:',
    '{',
    '  "subjective": "Former diver presenting with ear pain during flight cruising altitude. Pain onset during descent, rated 6/10. No prior episodes.",',
    '  "objective": "Vitals: BP 120/80 mmHg, HR 78 bpm, SpO₂ 98%. Otoscopy: Tympanic membranes appear normal bilaterally, no erythema noted. External auditory canals clear.",',
    '  "assessment": "Barotrauma vs Eustachian tube dysfunction",',
    '  "plan": "Valsalva maneuver demonstrated for ear clearing during descent. Paracetamol 1g PO PRN for pain. Advised to avoid diving for 48 hours. Return if pain worsens or hearing loss develops."',
    '}',
    '',
    'CRITICAL RULES FOR OBJECTIVE SECTION:',
    '- Start with vital signs if provided: "Vitals: BP X mmHg, HR X bpm, RR X breaths/min, SpO₂ X%, Temp X°C"',
    '- Extract ALL physical exam findings, observations, and measurements from doctor\'s notes',
    '- Look for: examination results, what doctor saw/heard/felt, diagnostic test results, clinical observations',
    '- If doctor mentions examining body parts (ears, chest, abdomen, etc.), include those findings',
    '- If doctor mentions normal/abnormal findings, include them',
    '- Convert informal language to clinical terms (e.g., "ears look fine" → "Tympanic membranes intact, no erythema")',
    '- If notes have NO exam findings, you may add "Physical examination findings as documented" or similar',
    '',
    'CRITICAL RULES FOR SUBJECTIVE SECTION:',
    '- Extract patient complaints, symptoms, history, timeline from doctor\'s notes',
    '- Include pain scale if provided',
    '- What patient reports, not what doctor observed',
    '',
    'OTHER RULES:',
    '- ALL FOUR fields (subjective, objective, assessment, plan) are REQUIRED',
    '- Separate subjective (what patient says) from objective (what doctor observes/measures)',
    '- If doctor notes mention treatment/advice, it goes in Plan section',
    '- Stay faithful to doctor\'s notes - extract and rephrase, don\'t invent',
    '- Use clear clinical terminology',
    '- Keep each section 1-3 sentences',
    '- Return ONLY the JSON object, no markdown fences',
    '',
    'Generate the complete SOAP note JSON with ALL FOUR sections now:'
  ].join('\n');
}

/**
 * Formats vitals into a readable string with proper units
 */
function formatVitals(vitals) {
  if (!vitals || typeof vitals !== 'object') return '';
  
  const components = [
    vitals.bp && `BP ${vitals.bp} mmHg`,
    vitals.hr && `HR ${vitals.hr} bpm`,
    vitals.rr && `RR ${vitals.rr} breaths/min`,
    vitals.spo2 && `SpO₂ ${vitals.spo2}%`,
    vitals.temp && `Temp ${vitals.temp}°C`
  ].filter(Boolean);
  
  return components.length > 0 ? components.join(', ') : '';
}

/**
 * Formats diagnosis tags
 */
function formatDiagnosisTags(tags) {
  if (Array.isArray(tags)) {
    return tags.join(', ');
  }
  return tags || '';
}

/**
 * Formats pain scale value
 */
function formatPainScale(painScale) {
  return typeof painScale === 'number' ? painScale.toString() : 'Not provided';
}

/**
 * Calls Google Gemini API
 */
async function callGoogleAPI({ apiKey, model, prompt }) {
  const url = `${API_ENDPOINTS.google(model)}?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0,
        responseMimeType: 'application/json'
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text)
    .join('\n') || '';
  
  return text.trim();
}

/**
 * Calls OpenAI API
 */
async function callOpenAIAPI({ apiKey, model, prompt }) {
  const response = await fetch(API_ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Calls Mistral API
 */
async function callMistralAPI({ apiKey, model, prompt }) {
  const response = await fetch(API_ENDPOINTS.mistral, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Attempts to parse JSON from text, handling common formats
 */
function parseJSONResponse(text) {
  if (!text) {
    throw new Error('Empty response from API');
  }
  
  // Remove markdown code fences
  let cleaned = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  
  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try extracting JSON object
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    
    if (start >= 0 && end > start) {
      const extracted = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(extracted);
      } catch (innerError) {
        throw new Error(`Failed to parse JSON response. Original error: ${innerError.message}. Response text: ${text.substring(0, 200)}`);
      }
    }
    
    throw new Error(`Invalid JSON response: ${e.message}. Response text: ${text.substring(0, 200)}`);
  }
}

/**
 * Routes API call to appropriate provider
 */
async function callModelAPI(provider, { apiKey, model, prompt }) {
  const apiCalls = {
    google: callGoogleAPI,
    openai: callOpenAIAPI,
    mistral: callMistralAPI
  };
  
  const apiCall = apiCalls[provider];
  if (!apiCall) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  return await apiCall({ apiKey, model, prompt });
}

/**
 * Main function to generate SOAP notes
 */
export async function generateSOAP({ 
  env, 
  model, 
  notes, 
  vitals, 
  complaintType, 
  painScale, 
  diagnosisTags 
}) {
  // Validate inputs
  if (!env) {
    throw new Error('Environment configuration required');
  }
  if (!model) {
    throw new Error('Model name required');
  }
  
  // Resolve model
  const { provider, model: resolvedModel } = resolveModel(model);
  
  if (provider === 'unknown') {
    throw new Error(`Unknown model: ${model}`);
  }
  
  // Get API key
  const apiKeyMap = {
    google: env.GOOGLE_API_KEY,
    openai: env.OPENAI_API_KEY,
    mistral: env.MISTRAL_API_KEY
  };
  
  const apiKey = apiKeyMap[provider];
  if (!apiKey) {
    throw new Error(`API key not found for provider: ${provider}`);
  }
  
  // Build prompt
  const prompt = buildSOAPPrompt({ 
    notes, 
    vitals, 
    complaintType, 
    painScale, 
    diagnosisTags 
  });
  
  // Call API
  const responseText = await callModelAPI(provider, { 
    apiKey, 
    model: resolvedModel, 
    prompt 
  });
  
  // Parse and return
  return parseJSONResponse(responseText);
}
