import { useMemo } from 'react'
import { KnowledgeBaseStore } from '../stores/KnowledgeBaseStore'

let kbStore: KnowledgeBaseStore | null = null

export function useKnowledgeBaseStore() {
  return useMemo(() => {
    if (!kbStore) kbStore = new KnowledgeBaseStore()
    return kbStore
  }, [])
}

