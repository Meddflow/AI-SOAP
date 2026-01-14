const el = (id) => document.getElementById(id)
const output = el('output')
const errorEl = el('error')
const genBtn = el('generate')
const copyBtn = el('copy')

function readNumber(id) {
  const v = el(id).value.trim()
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function sync(rangeId, numberId) {
  const r = el(rangeId)
  const n = el(numberId)
  r.addEventListener('input', () => {
    n.value = r.value
    updatePreview()
  })
  n.addEventListener('input', () => {
    const v = Number(n.value)
    if (Number.isFinite(v)) r.value = String(v)
    updatePreview()
  })
}

function tagsToChips() {
  const t = el('tags').value.trim()
  const chips = (t ? t.split(',').map(s => s.trim()).filter(Boolean) : [])
  const c = el('tagsChips')
  c.innerHTML = ''
  chips.forEach(x => {
    const d = document.createElement('span')
    d.className = 'chip'
    d.textContent = x
    c.appendChild(d)
  })
}

function vitalsPreviewText() {
  const sbp = readNumber('sbp')
  const dbp = readNumber('dbp')
  const hr = readNumber('hr')
  const rr = readNumber('rr')
  const spo2 = readNumber('spo2')
  const temp = readNumber('temp')
  const parts = []
  if (sbp !== undefined && dbp !== undefined) parts.push(`BP ${sbp}/${dbp}`)
  if (hr !== undefined) parts.push(`HR ${hr} bpm`)
  if (rr !== undefined) parts.push(`RR ${rr} rpm`)
  if (spo2 !== undefined) parts.push(`SpO₂ ${spo2}%`)
  if (temp !== undefined) parts.push(`Temp ${temp}°C`)
  return parts.join(', ')
}

function updatePreview() {
  el('vitalsPreview').textContent = vitalsPreviewText()
  tagsToChips()
}

function payloadFromForm() {
  const sbp = readNumber('sbp')
  const dbp = readNumber('dbp')
  const bp = (sbp !== undefined && dbp !== undefined) ? `${sbp}/${dbp}` : ''
  return {
    model: el('model').value,
    notes: el('notes').value.trim(),
    complaintType: el('complaint').value.trim(),
    painScale: readNumber('pain'),
    diagnosisTags: el('tags').value.trim(),
    vitals: {
      bp,
      hr: readNumber('hr'),
      rr: readNumber('rr'),
      spo2: readNumber('spo2'),
      temp: readNumber('temp')
    }
  }
}

sync('painSlider', 'pain')
sync('sbpSlider', 'sbp')
sync('dbpSlider', 'dbp')
sync('hrSlider', 'hr')
sync('rrSlider', 'rr')
sync('spo2Slider', 'spo2')
sync('tempSlider', 'temp')
el('tags').addEventListener('input', updatePreview)
updatePreview()

genBtn.addEventListener('click', async () => {
  errorEl.textContent = ''
  output.textContent = ''
  const payload = payloadFromForm()
  if (!payload.notes) {
    errorEl.textContent = 'Doctor notes are required'
    return
  }
  if (payload.painScale !== undefined && (payload.painScale < 0 || payload.painScale > 10)) {
    errorEl.textContent = 'Pain scale must be between 0 and 10'
    return
  }
  genBtn.disabled = true
  genBtn.textContent = 'Generating…'
  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await r.json()
    if (!r.ok) {
      errorEl.textContent = data.error || 'Generation failed'
    } else {
      output.textContent = data.soap || ''
    }
  } catch {
    errorEl.textContent = 'Network error'
  } finally {
    genBtn.disabled = false
    genBtn.textContent = 'Generate SOAP'
  }
})

el('prefill').addEventListener('click', () => {
  el('notes').value = 'Passenger is former diver, now pain during cruising in flight, advised clearing ears, took two tablets paracetamol previously.'
  el('complaint').value = 'Ear pain'
  el('painSlider').value = '4'
  el('pain').value = '4'
  el('tags').value = 'Barotrauma,Eustachian tube dysfunction'
  el('sbpSlider').value = '120'
  el('dbpSlider').value = '80'
  el('sbp').value = '120'
  el('dbp').value = '80'
  el('hrSlider').value = '72'
  el('hr').value = '72'
  el('rrSlider').value = '14'
  el('rr').value = '14'
  el('spo2Slider').value = '98'
  el('spo2').value = '98'
  el('tempSlider').value = '36.8'
  el('temp').value = '36.8'
  updatePreview()
})

copyBtn.addEventListener('click', async () => {
  const t = output.textContent.trim()
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
  } catch {}
})
