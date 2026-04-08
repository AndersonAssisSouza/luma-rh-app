// Supabase Edge Function — Extração de dados de documentos via Claude AI
// Deploy: supabase functions deploy extract-document
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS })
  }

  if (!ANTHROPIC_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada. Execute: supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { base64, mediaType } = await req.json()

    if (!base64 || !mediaType) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: base64, mediaType' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const isPdf = mediaType.includes('pdf')
    const docPart = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

    const prompt = 'Extraia os dados pessoais deste documento brasileiro e retorne APENAS um JSON com os campos disponíveis (use null para campos não encontrados): {"nome":null,"cpf":null,"rg":null,"pis_pasep":null,"ctps":null,"titulo_eleitor":null,"data_nascimento":null,"email":null,"telefone":null,"cep":null,"endereco":null,"numero":null,"bairro":null,"cidade":null,"uf":null,"genero":null}. data_nascimento deve estar no formato YYYY-MM-DD. genero: "M" ou "F". Retorne SOMENTE o JSON, sem texto adicional.'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [docPart, { type: 'text', text: prompt }] }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(
        JSON.stringify({ error: `Anthropic API ${res.status}: ${err.slice(0, 200)}` }),
        { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const result = await res.json()
    const text = result.content?.[0]?.text ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const data = match ? JSON.parse(match[0]) : {}

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
