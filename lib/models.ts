
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import ollama from 'ollama'
import {
  gemini20FlashModel,
  gemini20ProModel,
  gemini25FlashModel,
  gemini25ProModel,
} from './gemini'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function generateWithGemini(
  systemPrompt: string,
  model: string
): Promise<string> {
  let result
  switch (model) {
    case 'gemini-2.0-flash':
      result = await gemini20FlashModel.generateContent(systemPrompt)
      break
    case 'gemini-2.0-pro':
      result = await gemini20ProModel.generateContent(systemPrompt)
      break
    case 'gemini-2.5-flash':
      result = await gemini25FlashModel.generateContent(systemPrompt)
      break
    case 'gemini-2.5-pro':
      result = await gemini25ProModel.generateContent(systemPrompt)
      break
    default:
      throw new Error('Invalid Gemini model specified')
  }
  
  const text = result.response.text()
  if (!text) {
    throw new Error('No response content from Gemini')
  }
  return text
}

export async function generateWithOllama(
  systemPrompt: string,
  model: string
): Promise<string> {
  try {
    const response = await ollama.generate({
      model: model,
      prompt: systemPrompt,
    })
    return response.response
  } catch (error) {
    console.error('Ollama generation error:', error)
    throw new Error(`Failed to generate with Ollama: ${error.message}`)
  }
}

export async function generateWithOpenAI(
  systemPrompt: string,
  model: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: systemPrompt }],
      temperature: 1,
      // Add support for larger context windows in GPT-4.1 models
      max_tokens: model.startsWith('gpt-4.1') ? 32768 : 4096,
      // Add response format for consistent JSON handling
      response_format: { type: "json_object" }
    })
    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response content from OpenAI')
    }
    return content
  } catch (error) {
    console.error('OpenAI generation error:', error)
    throw new Error(`Failed to generate with OpenAI: ${error.message}`)
  }
}

export async function generateWithAnthropic(
  systemPrompt: string,
  model: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: model,
      messages: [{ role: 'user', content: systemPrompt }],
      max_tokens: 4096,
    })
    const content = response.content[0]?.text
    if (!content) {
      throw new Error('No response content from Anthropic')
    }
    return content
  } catch (error) {
    console.error('Anthropic generation error:', error)
    throw new Error(`Failed to generate with Anthropic: ${error.message}`)
  }
}

export async function generateWithDeepSeek(
  systemPrompt: string,
  model: string
): Promise<string> {
  try {
    const response = await deepseek.chat.completions.create({
      model: `deepseek-${model}`,
      messages: [{ role: 'user', content: systemPrompt }],
      max_tokens: 4000,
    })
    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response content from DeepSeek')
    }
    return content
  } catch (error) {
    console.error('DeepSeek generation error:', error)
    throw new Error(`Failed to generate with DeepSeek: ${error.message}`)
  }
}

export async function generateWithOpenRouter(
  systemPrompt: string,
  model: string
): Promise<string> {
  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.replace('openrouter/', ''),
          messages: [
            {
              role: 'user',
              content: systemPrompt,
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('No response content from OpenRouter')
    }
    return content
  } catch (error) {
    console.error('OpenRouter generation error:', error)
    throw new Error(`Failed to generate with OpenRouter: ${error.message}`)
  }
}

export async function generateWithModel(
  systemPrompt: string,
  platformModel: string
): Promise<string> {
  const [platform, model] = platformModel.split('__')

  switch (platform) {
    case 'google':
      return generateWithGemini(systemPrompt, model)
    case 'openai':
      return generateWithOpenAI(systemPrompt, model)
    case 'deepseek':
      return generateWithDeepSeek(systemPrompt, model)
    case 'anthropic':
      return generateWithAnthropic(systemPrompt, model)
    case 'ollama':
      return generateWithOllama(systemPrompt, model)
    case 'openrouter':
      return generateWithOpenRouter(systemPrompt, model)
    default:
      throw new Error('Invalid platform specified')
  }
}
