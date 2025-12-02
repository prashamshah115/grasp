/**
 * Feature Flags
 * 
 * Control experimental and beta features.
 * Set to false for production MVP, true for development testing.
 */

export const FEATURE_FLAGS = {
  // Experimental features (quarantined)
  EXPERIMENTAL_KNOWLEDGE_GRAPH: false,
  EXPERIMENTAL_USER_MEMORY: false,
  EXPERIMENTAL_ADVANCED_SEARCH: false,
  EXPERIMENTAL_SPACED_REPETITION: false,
  
  // Development toggles
  DEV_SHOW_DEBUG_INFO: false,
  DEV_MOCK_LLM_RESPONSES: false,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] === true
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([flag, _]) => flag as FeatureFlag)
}

