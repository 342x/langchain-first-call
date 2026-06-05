import { useMemo } from 'react'
import { CounterStore } from '../stores/CounterStore'

let counterStore: CounterStore | null = null

export function useCounterStore() {
  return useMemo(() => {
    if (!counterStore) counterStore = new CounterStore()
    return counterStore
  }, [])
}

