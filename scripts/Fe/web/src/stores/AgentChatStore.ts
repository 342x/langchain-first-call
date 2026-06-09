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

function buildBudgetedContext(params: {
  userName: string | null
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  hits: KnowledgeHit[]
  maxChars: number
  topK: number
  maxTurns: number
}) {
  const { userName, recentMessages, hits, maxChars, topK, maxTurns } = params

  const facts = userName ? `userName=${userName}` : ''
  const recent = recentMessages
    .slice(-maxTurns * 2)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')
  const retrieved = hits
    .slice(0, topK)
    .map((h, i) => `资料${i + 1}(${h.score.toFixed(2)}): ${h.doc.title}\n${h.doc.content}`)
    .join('\n\n')

  const parts: Array<{ title: string; text: string }> = [
    { title: 'Facts', text: facts },
    { title: 'Recent', text: recent },
    { title: 'Retrieved', text: retrieved },
  ].filter((p) => p.text.trim().length > 0)

  let remaining = Math.max(0, maxChars)
  const out: string[] = []

  for (const p of parts) {
    if (remaining <= 0) break
    const header = `[${p.title}]`
    const block = `${header}\n${p.text}`.trim()
    const cut = block.length > remaining ? `${block.slice(0, remaining).trimEnd()}\n…` : block
    out.push(cut)
    remaining -= cut.length + 2
  }

  const context = out.join('\n\n').trim()
  return {
    context,
    contextChars: context.length,
  }
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
  contextBudget = {
    maxChars: 1400,
    topK: 3,
    maxTurns: 4,
  }
  lastRun:
    | {
        id: string
        question: string
        startedAt: number
        finishedAt: number
        latencyMs: number
        mode: 'profile' | 'kb'
        context: string
        contextChars: number
        budget: { maxChars: number; topK: number; maxTurns: number }
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

  setBudget(patch: Partial<{ maxChars: number; topK: number; maxTurns: number }>) {
    this.contextBudget = { ...this.contextBudget, ...patch }
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
        contextChars: 0,
        budget: { ...this.contextBudget },
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
    const recentMessages = this.messages
      .filter((m): m is AgentMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))
    const budgeted = buildBudgetedContext({
      userName: this.profile.name,
      recentMessages,
      hits,
      maxChars: this.contextBudget.maxChars,
      topK: this.contextBudget.topK,
      maxTurns: this.contextBudget.maxTurns,
    })
    this.lastRun = {
      id: runId,
      question: q,
      startedAt,
      finishedAt,
      latencyMs: finishedAt - startedAt,
      mode: 'kb',
      context: budgeted.context,
      contextChars: budgeted.contextChars,
      budget: { ...this.contextBudget },
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
