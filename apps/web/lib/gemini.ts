import { GoogleGenAI } from '@google/genai'

let _client: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')
    _client = new GoogleGenAI({ apiKey })
  }
  return _client
}
