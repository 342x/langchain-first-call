import { useMemo } from 'react'
import { AgentChatStore } from '../stores/AgentChatStore'
import { useKnowledgeBaseStore } from './useKnowledgeBaseStore'
import { useUserProfileStore } from './useUserProfileStore'

let agentStore: AgentChatStore | null = null

export function useAgentChatStore() {
  const kb = useKnowledgeBaseStore()
  const profile = useUserProfileStore()
  return useMemo(() => {
    if (!agentStore) agentStore = new AgentChatStore(kb, profile)
    return agentStore
  }, [kb, profile])
}
