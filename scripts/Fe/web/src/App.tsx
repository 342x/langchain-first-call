import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import styles from './AppShell.module.less'
import { AgentChatPanel } from './components/AgentChatPanel'
import { ChatInterface } from './components/ChatInterface'
import { KnowledgeBasePanel } from './components/KnowledgeBasePanel'
import { MemoryPanel } from './components/MemoryPanel'
import { MemoryProvider } from './contexts/MemoryProvider'

function App() {
  const [tab, setTab] = useState<'memory' | 'agent' | 'kb'>('agent')
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false)

  return (
    <div className={styles.shell}>
      <div className={styles.topbar}>
        <div className={styles.brand}>Fe Playground</div>
        <button
          className={`${styles.tab} ${tab === 'agent' ? styles.active : ''}`}
          type="button"
          onClick={() => setTab('agent')}
        >
          Agent
        </button>
        <button
          className={`${styles.tab} ${tab === 'kb' ? styles.active : ''}`}
          type="button"
          onClick={() => setTab('kb')}
        >
          知识库
        </button>
        <button
          className={`${styles.tab} ${tab === 'memory' ? styles.active : ''}`}
          type="button"
          onClick={() => setTab('memory')}
        >
          Memory
        </button>
      </div>

      <div className={styles.content}>
        {tab === 'agent' ? <AgentChatPanel /> : null}
        {tab === 'kb' ? <KnowledgeBasePanel /> : null}
        {tab === 'memory' ? (
          <MemoryProvider userId="demo">
            <div style={{ marginBottom: 12 }}>
              <button
                className={styles.tab}
                type="button"
                onClick={() => setMemoryPanelOpen(true)}
              >
                打开记忆管理面板
              </button>
            </div>
            <ChatInterface onOpenMemoryPanel={() => setMemoryPanelOpen(true)} />
            {memoryPanelOpen ? <MemoryPanel onClose={() => setMemoryPanelOpen(false)} /> : null}
          </MemoryProvider>
        ) : null}
      </div>
    </div>
  )
}

export default observer(App)
