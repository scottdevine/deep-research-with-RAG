'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PlatformModel } from '@/types'
import { CONFIG } from '@/lib/config'

export const platformModels = Object.entries(CONFIG.platforms)
  .flatMap(([platform, config]) => {
    if (!config.enabled) return []

    return Object.entries(config.models).map(([modelId, modelConfig]) => {
      return {
        value: `${platform}__${modelId}`,
        label: `${platform.charAt(0).toUpperCase() + platform.slice(1)} - ${
          modelConfig.label
        }`,
        platform,
        disabled: !modelConfig.enabled,
      }
    })
  })
  .filter(Boolean) as (PlatformModel & { disabled: boolean })[]

// Export the default model that matches one of our configured models
export const DEFAULT_MODEL = 'openai__gpt-4.1-2025-04-14'

export const ModelSelect = ({ 
  value, 
  onChange 
}: { 
  value: string
  onChange: (value: string) => void 
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {platformModels.map((model) => (
          <SelectItem
            key={model.value}
            value={model.value}
            disabled={model.disabled}
          >
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}


