import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request body
    const body = await req.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userMessage = messages[messages.length - 1]?.content
    if (!userMessage || typeof userMessage !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: last message must have content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate Bytez API key
    const bytezApiKey = Deno.env.get('BYTEZ_API_KEY')
    if (!bytezApiKey) {
      console.error('BYTEZ_API_KEY environment variable is not set')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing message for user ${user.id}: "${userMessage.substring(0, 50)}..."`)

    // Prepare messages for Bytez API (OpenAI-compatible format)
    const apiMessages = [
      {
        role: 'system',
        content: `You are a helpful and enthusiastic college assistant chatbot.
Answer the student's questions about the college to the best of your ability.
If you don't know something, say so and advise them to contact the college administration.
Format your response using Markdown (bold, lists, etc.) where appropriate.`
      },
      ...messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]

    // Call Bytez API using OpenAI-compatible endpoint
    const response = await fetch('https://api.bytez.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bytezApiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-4B-Instruct-2507',
        messages: apiMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Bytez API error:', response.status, errorText)
      throw new Error(`Bytez API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content

    if (!responseText) {
      console.error('Invalid response from Bytez API:', data)
      throw new Error('Invalid response from AI model')
    }

    console.log(`Response generated successfully (${responseText.length} chars)`)

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Edge Function Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    // Provide user-friendly error messages
    let errorMessage = 'An unexpected error occurred'
    let statusCode = 500

    if (error.message?.includes('API key') || error.message?.includes('401')) {
      errorMessage = 'Invalid API key configuration'
    } else if (error.message?.includes('quota') || error.message?.includes('429')) {
      errorMessage = 'API quota exceeded. Please try again later.'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.'
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
