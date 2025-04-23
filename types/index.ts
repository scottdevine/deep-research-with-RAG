export type Report = {
  title: string
  summary: string
  sections: {
    title: string
    content: string
  }[]
  sources: {
    id: string
    url: string
    name: string
  }[]
  usedSources?: number[] // Array of source indices that were actually used/cited
}
export interface Article {
  url: string
  title: string
  content: string
}

export type KnowledgeBaseReport = {
  id: string
  timestamp: number
  query: string
  report: Report
}

export type SearchResult = {
  id: string
  url: string
  name: string
  snippet: string
  isCustomUrl?: boolean
  isPubMed?: boolean
  source?: 'google' | 'pubmed' | 'custom'
  score?: number
  reasoning?: string
  content?: string
  // PubMed specific fields
  authors?: string[]
  journal?: string
  pubDate?: string
  pmid?: string
}

export type RankingResult = {
  url: string
  score: number
  reasoning: string
}

export interface PlatformModel {
  value: string
  label: string
  platform: 'google' | 'ollama' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter'
  disabled?: boolean
}

// Add specific model types for better type checking
export type OpenAIModel =
  | 'gpt-4.1-2025-04-14'
  | 'gpt-4.1-mini-2025-04-14'
  | 'o3-2025-04-16'

export type ModelVariant = `${PlatformModel['platform']}__${string}`

export interface ModelConfig {
  enabled: boolean
  label: string
}

export interface PlatformConfig {
  enabled: boolean
  models: {
    [key: string]: ModelConfig
  }
}

export interface Platforms {
  google: PlatformConfig
  ollama: PlatformConfig
  openai: PlatformConfig
  anthropic: PlatformConfig
  deepseek: PlatformConfig
  openrouter: PlatformConfig
}

export type Status = {
  loading: boolean
  generatingReport: boolean
  prioritizingResults: boolean
  agentStep: 'idle' | 'processing' | 'searching' | 'analyzing' | 'generating'
  fetchStatus: {
    total: number
    successful: number
    fallback: number
    sourceStatuses: Record<string, 'fetched' | 'preview'>
  }
  agentInsights: string[]
  searchQueries: string[]
}

export type State = {
  query: string
  timeFilter: string
  results: SearchResult[]
  selectedResults: string[]
  reportPrompt: string
  report: Report | null
  error: string | null
  newUrl: string
  isSourcesOpen: boolean
  selectedModel: string
  isAgentMode: boolean
  sidebarOpen: boolean
  activeTab: string
  includePubMed: boolean // Option to include PubMed results
  status: Status
  // Pagination related fields
  currentPage: number
  totalPages: number
  totalResults: number
  allResults: SearchResult[][] // Array of result pages
  // Prioritization flag
  resultsPrioritized: boolean
}

// Flow Component Types
export type BaseNodeData = {
  id?: string
  loading?: boolean
  error?: string
  parentId?: string
  childIds?: string[]
}

export type SearchNodeData = BaseNodeData & {
  query: string
  onFileUpload?: (file: File) => void
}

export type SelectionNodeData = BaseNodeData & {
  results: SearchResult[]
  onGenerateReport?: (
    selectedResults: SearchResult[],
    prompt: string
  ) => Promise<
    | { success: boolean; report: any; searchTerms: any; error?: undefined }
    | {
        success: boolean
        error: string
        report?: undefined
        searchTerms?: undefined
      }
    | undefined
  >
}

export type ReportNodeData = BaseNodeData & {
  report?: Report
  isSelected?: boolean
  onSelect?: (id: string) => void
  isConsolidated?: boolean
  isConsolidating?: boolean
}

export type SearchTermsNodeData = BaseNodeData & {
  searchTerms?: string[]
  onApprove?: (term: string) => void
}

// Combined interface for all node types with index signature for compatibility with xyflow
export interface FlowNodeData extends BaseNodeData {
  query?: string
  results?: SearchResult[]
  report?: Report
  searchTerms?: string[]
  question?: string
  onGenerateReport?: (
    selectedResults: SearchResult[],
    prompt: string
  ) => Promise<
    | { success: boolean; report: any; searchTerms: any; error?: undefined }
    | {
        success: boolean
        error: string
        report?: undefined
        searchTerms?: undefined
      }
    | undefined
  >
  onApprove?: (term?: string) => void
  onConsolidate?: () => void
  hasChildren?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  isConsolidated?: boolean
  isConsolidating?: boolean
  onFileUpload?: (file: File) => void
  [key: string]: any // This allows for dynamic properties required by xyflow
}

// Configuration for different node types
export interface NodeConfig {
  zIndex: number
  style?: React.CSSProperties
}
