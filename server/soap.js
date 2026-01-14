function coerceString(v) {
  if (typeof v === 'string') return v.trim()
  if (v == null) return ''
  return String(v).trim()
}

function coerceNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v || '').trim())
  return Number.isFinite(n) ? n : undefined
}

export function sanitizeInputs(body) {
  const vit = body.vitals || {}
  return {
    model: coerceString(body.model),
    notes: coerceString(body.notes),
    complaintType: coerceString(body.complaintType),
    painScale: coerceNumber(body.painScale),
    diagnosisTags: Array.isArray(body.diagnosisTags)
      ? body.diagnosisTags.map(coerceString).filter(Boolean)
      : (coerceString(body.diagnosisTags) ? coerceString(body.diagnosisTags).split(',').map(s => s.trim()).filter(Boolean) : []),
    vitals: {
      bp: coerceString(vit.bp),
      hr: coerceNumber(vit.hr),
      rr: coerceNumber(vit.rr),
      spo2: coerceNumber(vit.spo2),
      temp: coerceNumber(vit.temp)
    }
  }
}

export function validateInputs(input) {
  const issues = []
  if (!input.model) issues.push({ field: 'model', message: 'Model is required' })
  if (!input.notes) issues.push({ field: 'notes', message: 'Doctor notes are required' })
  if (input.painScale !== undefined && (input.painScale < 0 || input.painScale > 10)) {
    issues.push({ field: 'painScale', message: 'Pain scale must be 0-10' })
  }
  const v = input.vitals || {}
  ;['hr', 'rr', 'spo2', 'temp'].forEach(k => {
    const val = v[k]
    if (val !== undefined && !Number.isFinite(val)) issues.push({ field: `vitals.${k}`, message: 'Must be a number' })
  })
  return { ok: issues.length === 0, issues }
}

function formatVitals(v) {
  const parts = []
  if (v.bp) parts.push(`BP: ${v.bp}`)
  if (v.hr !== undefined) parts.push(`HR: ${v.hr} bpm`)
  if (v.rr !== undefined) parts.push(`RR: ${v.rr} rpm`)
  if (v.spo2 !== undefined) parts.push(`SpO₂: ${v.spo2}%`)
  if (v.temp !== undefined) parts.push(`Temp: ${v.temp}°C`)
  return parts.length ? parts.join('; ') : 'Not provided'
}

function extractAssessment(notes, tags) {
  const base = (tags && tags.length) ? tags.join(' vs ') : ''
  if (base) return base
  const lowered = (notes || '').toLowerCase()
  if (lowered.includes('ear') && lowered.includes('pain')) return 'Barotrauma vs Eustachian tube dysfunction'
  return 'To be determined'
}

function extractPlan(notes) {
  const lowered = (notes || '').toLowerCase()
  const actions = []
  if (lowered.includes('clear') && lowered.includes('ear')) actions.push('Clear ears')
  if (lowered.includes('paracetamol') || lowered.includes('acetaminophen')) actions.push('Paracetamol 1g as needed')
  actions.push('Monitor symptoms and follow-up if worsening')
  return actions.join(', ')
}

export function fallbackGenerateSOAP({ notes, vitals, complaintType, painScale, diagnosisTags }) {
  const S = [
    complaintType ? `${complaintType}.` : '',
    notes ? notes : ''
  ].filter(Boolean).join(' ')
  const O = formatVitals(vitals || {})
  const A = extractAssessment(notes, diagnosisTags)
  const P = extractPlan(notes)
  return [`S: ${S || 'Not provided'}`, `O: ${O}`, `A: ${A}`, `P: ${P}`].join('\n')
}
