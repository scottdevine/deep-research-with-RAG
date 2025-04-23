
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const generationJsonConfig = {
  temperature: 1,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
}

const generationPlainTextConfig = {
  temperature: 1,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

// Gemini 2.0 Models
export const gemini20FlashModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-001',
  safetySettings,
  generationConfig: generationJsonConfig,
})

export const gemini20ProModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-pro-exp-02-05',
  safetySettings,
  generationConfig: generationJsonConfig,
})

// Gemini 2.5 Models
export const gemini25FlashModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-001',
  safetySettings,
  generationConfig: generationJsonConfig,
})

export const gemini25ProModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro-exp-02-05',
  safetySettings,
  generationConfig: generationJsonConfig,
})
