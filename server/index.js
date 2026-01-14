import express from 'express'
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateSOAP } from './providers.js'
import { sanitizeInputs, validateInputs } from './soap.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use(express.static(path.join(__dirname, '..', 'public')))

const env = {
  GOOGLE_API_KEY: (process.env.GOOGLE_API_KEY || '').trim(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || '').trim(),
  MISTRAL_API_KEY: (process.env.MISTRAL_API_KEY || '').trim()
}

app.post('/api/generate', async (req, res) => {
  try {
    const input = sanitizeInputs(req.body || {})
    const validation = validateInputs(input)
    if (!validation.ok) {
      return res.status(400).json({ error: 'Invalid input', issues: validation.issues })
    }

    const model = String(input.model || '').toLowerCase()
    const hasKey =
      (model.includes('gemini') && !!env.GOOGLE_API_KEY) ||
      (model.includes('gpt') && !!env.OPENAI_API_KEY) ||
      (model.includes('mistral') && !!env.MISTRAL_API_KEY)

    if (!hasKey) {
      return res.status(400).json({ error: 'Missing API key for selected model' })
    }

    const output = await generateSOAP({
      env,
      model,
      notes: input.notes,
      vitals: input.vitals,
      complaintType: input.complaintType,
      painScale: input.painScale,
      diagnosisTags: input.diagnosisTags
    })

    res.json({ soap: output })
  } catch (e) {
    res.status(500).json({ error: 'Generation failed' })
  }
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`Visit Summary Generator running at http://localhost:${port}/`)
})
