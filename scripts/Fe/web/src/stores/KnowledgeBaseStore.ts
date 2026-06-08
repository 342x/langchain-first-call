import { makeAutoObservable } from 'mobx'

export type KnowledgeDoc = {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type KnowledgeHit = {
  doc: KnowledgeDoc
  score: number
}

function tokenize(input: string): string[] {
  const text = input.toLowerCase().trim()
  if (!text) return []

  const tokens = new Set<string>()

  const normalized = text.replace(/[^\p{L}\p{N}]+/gu, ' ')
  for (const part of normalized.split(/\s+/g)) {
    if (part) tokens.add(part)
  }

  for (const ch of text) {
    const code = ch.charCodeAt(0)
    const isCJK =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df)
    if (isCJK) tokens.add(ch)
  }

  return Array.from(tokens)
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const t of setA) if (setB.has(t)) inter += 1
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

const STORAGE_KEY = 'fe_kb_v1'

export class KnowledgeBaseStore {
  docs: KnowledgeDoc[] = []

  constructor() {
    makeAutoObservable(this)
    this.load()
    if (this.docs.length === 0) {
      this.seed()
      this.save()
    }
  }

  search(query: string, topK = 5): KnowledgeHit[] {
    const qTokens = tokenize(query)
    return this.docs
      .map((doc) => {
        const dTokens = tokenize(`${doc.title}\n${doc.content}\n${doc.tags.join(' ')}`)
        const score = jaccard(qTokens, dTokens)
        return { doc, score }
      })
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  addDoc(input: Pick<KnowledgeDoc, 'title' | 'content' | 'tags'>) {
    const now = Date.now()
    const doc: KnowledgeDoc = {
      id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
      title: input.title.trim() || '未命名',
      content: input.content.trim(),
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
    }
    this.docs.unshift(doc)
    this.save()
    return doc
  }

  updateDoc(id: string, patch: Partial<Pick<KnowledgeDoc, 'title' | 'content' | 'tags'>>) {
    const idx = this.docs.findIndex((d) => d.id === id)
    if (idx === -1) return
    const now = Date.now()
    this.docs[idx] = {
      ...this.docs[idx],
      ...patch,
      updatedAt: now,
      title: patch.title !== undefined ? patch.title.trim() : this.docs[idx].title,
      content: patch.content !== undefined ? patch.content.trim() : this.docs[idx].content,
    }
    this.save()
  }

  deleteDoc(id: string) {
    this.docs = this.docs.filter((d) => d.id !== id)
    this.save()
  }

  clearAll() {
    this.docs = []
    this.save()
  }

  private seed() {
    const now = Date.now()
    this.docs = [
      {
        id: `${now}-policy-refund`,
        title: '退款政策',
        content: '购买后 30 天内可申请无条件退款；超过 30 天需提供商品质量问题证明。',
        tags: ['policy', 'refund'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${now}-policy-shipping`,
        title: '配送说明',
        content: '标准配送 3-5 个工作日；加急配送 1-2 个工作日。',
        tags: ['policy', 'shipping'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${now}-support-hours`,
        title: '客服工作时间',
        content: '周一到周五 09:00-18:00（法定节假日除外）。',
        tags: ['support'],
        createdAt: now,
        updatedAt: now,
      },
    ]
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { docs?: KnowledgeDoc[] }
      if (parsed.docs && Array.isArray(parsed.docs)) {
        this.docs = parsed.docs
      }
    } catch {
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ docs: this.docs }))
    } catch {
    }
  }
}
