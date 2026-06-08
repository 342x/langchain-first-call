import { makeAutoObservable } from 'mobx'
import type { KnowledgeBaseStore, KnowledgeHit } from './KnowledgeBaseStore'
import type { UserProfileStore } from './UserProfileStore'

export type AgentMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  sources?: Array<{ id: string; title: string; score: number }>
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(() => resolve(), ms))
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function buildAnswer(question: string, hits: KnowledgeHit[], userName: string | null) {
  const now = Date.now()
  const top = hits.slice(0, 3)

  if (top.length === 0 || top[0].score < 0.08) {
    return {
      timestamp: now,
      text: [
        `时间：${formatTime(now)}`,
        '',
        userName ? `我记得你叫 ${userName}。` : null,
        `我在知识库里没有找到能直接回答“${question}”的资料。`,
        '你可以：',
        '- 换一种问法（加上关键词）',
        '- 或者在「知识库」里补充相关文档',
      ].join('\n'),
      sources: [],
    }
  }

  const lines: string[] = []
  lines.push(`时间：${formatTime(now)}`)
  lines.push('')
  if (userName) {
    lines.push(`我记得你叫 ${userName}。`)
    lines.push('')
  }
  lines.push('我根据知识库检索到的资料做了回答：')
  lines.push('')

  const primary = top[0].doc
  lines.push(`结论：${primary.content}`)
  lines.push('')
  lines.push('检索命中：')
  for (const hit of top) {
    lines.push(`- 《${hit.doc.title}》 score=${hit.score.toFixed(2)}`)
  }

  return {
    timestamp: now,
    text: lines.join('\n'),
    sources: top.map((hit) => ({ id: hit.doc.id, title: hit.doc.title, score: hit.score })),
  }
}

export class AgentChatStore {
  messages: AgentMessage[] = []
  input = ''
  isThinking = false
  private kb: KnowledgeBaseStore
  private profile: UserProfileStore
  lastRun:
    | {
        id: string
        question: string
        startedAt: number
        finishedAt: number
        latencyMs: number
        mode: 'profile' | 'kb'
        context: string
        hits: Array<{ id: string; title: string; score: number; content: string }>
      }
    | null = null

  constructor(kb: KnowledgeBaseStore, profile: UserProfileStore) {
    this.kb = kb
    this.profile = profile
    makeAutoObservable(this, { kb: false, profile: false } as any)
    this.messages = [
      {
        id: `sys-${Date.now()}`,
        role: 'system',
        content: '你现在处于纯前端模拟的 Agent 模式：会先检索知识库，再给出带时间戳的回答。',
        timestamp: Date.now(),
      },
    ]
  }

  setInput(value: string) {
    this.input = value
  }

  clear() {
    this.messages = []
  }

  async send(question?: string) {
    const q = (question ?? this.input).trim()
    if (!q || this.isThinking) return

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const startedAt = Date.now()

    this.messages.push({
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: q,
      timestamp: Date.now(),
    })

    this.input = ''
    this.isThinking = true

    const matchName = q.match(/^我叫\s*(.+)\s*$/)
    if (matchName) {
      const name = matchName[1].trim()
      await sleep(350 + Math.floor(Math.random() * 450))
      this.profile.setName(name)
      const now = Date.now()
      this.lastRun = {
        id: runId,
        question: q,
        startedAt,
        finishedAt: now,
        latencyMs: now - startedAt,
        mode: 'profile',
        context: '',
        hits: [],
      }
      this.messages.push({
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: [`时间：${formatTime(now)}`, '', `好的，我记住了，你叫 ${name}。`].join('\n'),
        timestamp: now,
      })
      this.isThinking = false
      return
    }

    const hits = this.kb.search(q, 5)
    await sleep(420 + Math.floor(Math.random() * 580))
    const answer = buildAnswer(q, hits, this.profile.name)
    const finishedAt = Date.now()
    const context = hits
      .slice(0, 3)
      .map((h, i) => `资料 ${i + 1}：${h.doc.title}\n${h.doc.content}`)
      .join('\n\n')
    this.lastRun = {
      id: runId,
      question: q,
      startedAt,
      finishedAt,
      latencyMs: finishedAt - startedAt,
      mode: 'kb',
      context,
      hits: hits.slice(0, 5).map((h) => ({
        id: h.doc.id,
        title: h.doc.title,
        score: h.score,
        content: h.doc.content,
      })),
    }

    this.messages.push({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'assistant',
      content: answer.text,
      timestamp: answer.timestamp,
      sources: answer.sources,
    })

    this.isThinking = false
  }
}
