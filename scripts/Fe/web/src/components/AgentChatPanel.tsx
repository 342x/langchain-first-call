import { observer } from 'mobx-react-lite'
import { useEffect, useMemo, useRef } from 'react'
import { useAgentChatStore } from '../hooks/useAgentChatStore'
import { useUserProfileStore } from '../hooks/useUserProfileStore'
import styles from './AgentChatPanel.module.less'

export const AgentChatPanel = observer(function AgentChatPanel() {
  const agent = useAgentChatStore()
  const profile = useUserProfileStore()
  const listRef = useRef<HTMLDivElement>(null)

  const hint = useMemo(() => {
    return '示例：我叫 张三 / 退款超过 30 天怎么办？ / 配送多久？ / 客服什么时候上班？'
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [agent.messages.length, agent.isThinking])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Agent（纯前端模拟）</h3>
          <div className={styles.meta}>
            流程：检索知识库 → 等待一小段时间 → 返回带时间戳的回答
            {profile.name ? `（当前记住：${profile.name}）` : ''}
          </div>
        </div>
        <button className={styles.btn} type="button" onClick={() => (agent.messages = [])}>
          Clear
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          <div className={styles.chat} ref={listRef}>
            {agent.messages.map((m) => {
              const rowClass = `${styles.msgRow} ${m.role === 'user' ? styles.msgRowUser : ''}`
              const bubbleClass = `${styles.bubble} ${
                m.role === 'user' ? styles.bubbleUser : m.role === 'system' ? styles.bubbleSystem : ''
              }`
              return (
                <div className={rowClass} key={m.id}>
                  <div className={bubbleClass}>
                    {m.content}
                    {m.sources && m.sources.length > 0 ? (
                      <div className={styles.sources}>
                        {m.sources.map((s) => (
                          <span className={styles.pill} key={s.id}>
                            {s.title} ({s.score.toFixed(2)})
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {agent.isThinking ? (
              <div className={styles.msgRow}>
                <div className={`${styles.bubble} ${styles.bubbleSystem}`}>正在检索并生成回答…</div>
              </div>
            ) : null}
          </div>

          <div className={styles.inputBar}>
            <input
              className={styles.input}
              value={agent.input}
              onChange={(e) => agent.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') agent.send()
              }}
              placeholder={hint}
              disabled={agent.isThinking}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              onClick={() => agent.send()}
              disabled={agent.isThinking || !agent.input.trim()}
            >
              Send
            </button>
          </div>
        </div>

        <div className={styles.side}>
          <div className={styles.card}>
            <h4 className={styles.cardTitle}>Agent Trace</h4>
            {agent.lastRun ? (
              <div className={styles.kv}>
                <div>mode</div>
                <div className={styles.mono}>{agent.lastRun.mode}</div>
                <div>latency</div>
                <div className={styles.mono}>{agent.lastRun.latencyMs}ms</div>
                <div>question</div>
                <div className={styles.mono}>{agent.lastRun.question}</div>
                <div>started</div>
                <div className={styles.mono}>{new Date(agent.lastRun.startedAt).toLocaleString()}</div>
                <div>finished</div>
                <div className={styles.mono}>{new Date(agent.lastRun.finishedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className={styles.meta}>发送一条消息后，会显示检索/上下文/耗时</div>
            )}
          </div>

          <div className={styles.card} style={{ overflow: 'auto' }}>
            <h4 className={styles.cardTitle}>Retriever / Context</h4>
            {agent.lastRun && agent.lastRun.mode === 'kb' ? (
              <>
                {agent.lastRun.hits.length > 0 ? (
                  agent.lastRun.hits.map((h) => (
                    <div className={styles.hit} key={h.id}>
                      <div className={styles.hitHeader}>
                        <div className={styles.mono}>{h.title}</div>
                        <div className={styles.mono}>{h.score.toFixed(2)}</div>
                      </div>
                      <div className={styles.meta}>{h.content}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.meta}>没有命中任何文档</div>
                )}
                <div style={{ height: 12 }} />
                <div className={styles.meta}>拼接给 Agent 的上下文</div>
                <div className={styles.hit}>
                  <div className={styles.mono}>{agent.lastRun.context || '(空)'}</div>
                </div>
              </>
            ) : agent.lastRun && agent.lastRun.mode === 'profile' ? (
              <div className={styles.meta}>本次是“我叫xxx”写入本地记忆，不走知识库检索。</div>
            ) : (
              <div className={styles.meta}>暂无</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
