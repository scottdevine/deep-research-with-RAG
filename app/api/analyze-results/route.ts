import { NextResponse } from 'next/server'
import { reportContentRatelimit } from '@/lib/redis'
import { CONFIG } from '@/lib/config'
import { extractAndParseJSON } from '@/lib/utils'
import { generateWithModel } from '@/lib/models'
import { type ModelVariant } from '@/types'

type SearchResultInput = {
  title: string
  snippet: string
  url: string
  content?: string
}

export async function POST(request: Request) {
  try {
    const {
      prompt,
      results,
      isTestQuery = false,
      platformModel = 'google__gemini-flash',
    } = (await request.json()) as {
      prompt: string
      results: SearchResultInput[]
      isTestQuery?: boolean
      platformModel: ModelVariant
    }

    if (!prompt || !results?.length) {
      return NextResponse.json(
        { error: 'Prompt and results are required' },
        { status: 400 }
      )
    }

    // Return test results for test queries
    if (
      isTestQuery ||
      results.some((r) => r.url.includes('example.com/test'))
    ) {
      return NextResponse.json({
        rankings: results.map((result, index) => ({
          url: result.url,
          score: index === 0 ? 1 : 0.5, // Give first result highest score
          reasoning: 'Test ranking result',
        })),
        analysis: 'Test analysis of search results',
      })
    }

    // Only check rate limit if enabled and not using Ollama (local model)
    const platform = platformModel.split('__')[0]
    const model = platformModel.split('__')[1]
    if (CONFIG.rateLimits.enabled && platform !== 'ollama') {
      const { success } = await reportContentRatelimit.limit(
        'agentOptimizations'
      )
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429 }
        )
      }
    }

    // Check if selected platform is enabled
    const platformConfig =
      CONFIG.platforms[platform as keyof typeof CONFIG.platforms]
    if (!platformConfig?.enabled) {
      return NextResponse.json(
        { error: `${platform} platform is not enabled` },
        { status: 400 }
      )
    }

    // Check if selected model exists and is enabled
    const modelConfig = (platformConfig as any).models[model]
    if (!modelConfig) {
      return NextResponse.json(
        { error: `${model} model does not exist` },
        { status: 400 }
      )
    }
    if (!modelConfig.enabled) {
      return NextResponse.json(
        { error: `${model} model is disabled` },
        { status: 400 }
      )
    }

    const systemPrompt = `You are a research assistant tasked with analyzing search results for relevance to a research topic.

Research Topic: "${prompt}"

Analyze these search results and score them based on:
1. Relevance to the research topic
2. Information quality and depth
3. Source credibility and authority
4. Uniqueness of perspective

Source Prioritization Guidelines:
- HIGHLY PRIORITIZE peer-reviewed academic literature, scientific journals, and research publications
- PRIORITIZE sources from established educational institutions, government agencies, and recognized expert organizations
- DEPRIORITIZE opinion pieces, editorials, and sources that primarily express personal viewpoints rather than evidence-based information
- DEPRIORITIZE sources with clear commercial bias or promotional content
- CONSIDER the recency of information when relevant to the topic

For each result, assign a score from 0 to 1, where:
- 1.0: Highly relevant, authoritative (especially peer-reviewed), and comprehensive
- 0.8-0.9: Very relevant with high-quality information from reputable sources
- 0.6-0.7: Relevant information from credible sources
- 0.4-0.5: Moderately relevant or basic information from acceptable sources
- 0.2-0.3: Tangentially relevant or from less authoritative sources
- 0.0-0.1: Not relevant, unreliable, or primarily opinion-based content

Here are the results to analyze:

${results
  .map(
    (result, index) => `
Result ${index + 1}:
Title: ${result.title}
URL: ${result.url}
Snippet: ${result.snippet}
${result.content ? `Full Content: ${result.content}` : ''}
---`
  )
  .join('\n')}

Format your response as a JSON object with this structure:
{
  "rankings": [
    {
      "url": "result url",
      "score": 0.85,
      "reasoning": "Brief explanation of the score, including assessment of source credibility and content type"
    }
  ],
  "analysis": "Brief overall analysis of the result set, highlighting the most valuable academic and authoritative sources"
}

Focus on finding results that provide unique, high-quality information from peer-reviewed and highly reputable sources relevant to the research topic. Explicitly mention in your reasoning when a source is peer-reviewed or when it appears to be primarily opinion-based.`

    try {
      const response = await generateWithModel(systemPrompt, platformModel)

      if (!response) {
        throw new Error('No response from model')
      }

      try {
        const parsedResponse = extractAndParseJSON(response)
        return NextResponse.json(parsedResponse)
      } catch (parseError) {
        console.error('Failed to parse analysis:', parseError)
        return NextResponse.json(
          { error: 'Failed to analyze results' },
          { status: 500 }
        )
      }
    } catch (error) {
      console.error('Model generation error:', error)
      return NextResponse.json(
        { error: 'Failed to generate analysis' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Result analysis failed:', error)
    return NextResponse.json(
      { error: 'Failed to analyze results' },
      { status: 500 }
    )
  }
}
