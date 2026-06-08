import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { MemoryPanel } from './components/MemoryPanel'
import { MemoryProvider } from './contexts/MemoryProvider'
import { useCounterStore } from './hooks/useCounterStore'

function App() {
  const counterStore = useCounterStore()
  const [memoryOpen, setMemoryOpen] = useState(true)

  return (
    <>
      <div>Count: {counterStore.count}</div>
      <button type="button" onClick={() => counterStore.inc()}>
        +1
      </button>
      <button type="button" onClick={() => setMemoryOpen(true)}>
        记忆管理
      </button>
      <MemoryProvider userId="demo">
        {memoryOpen ? <MemoryPanel onClose={() => setMemoryOpen(false)} /> : null}
      </MemoryProvider>
    </>
  )
}

export default observer(App)
