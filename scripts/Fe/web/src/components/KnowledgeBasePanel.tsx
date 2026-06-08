import { observer } from 'mobx-react-lite'
import { useMemo, useState } from 'react'
import styles from './KnowledgeBasePanel.module.less'
import { useKnowledgeBaseStore } from '../hooks/useKnowledgeBaseStore'

export const KnowledgeBasePanel = observer(function KnowledgeBasePanel() {
  const kb = useKnowledgeBaseStore()
  const [query, setQuery] = useState('')

  const [draftTitle, setDraftTitle] = useState('')
  const [draftTags, setDraftTags] = useState('policy,refund')
  const [draftContent, setDraftContent] = useState(
    '示例：购买后 30 天内可申请无条件退款；超过 30 天需提供商品质量问题证明。',
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingTags, setEditingTags] = useState('')
  const [editingContent, setEditingContent] = useState('')

  const hits = useMemo(() => {
    const q = query.trim()
    return q ? kb.search(q, 5) : []
  }, [kb, query])

  function parseTags(text: string) {
    return text
      .split(/[,，\s]+/g)
      .map((t) => t.trim())
      .filter(Boolean)
  }

  function beginEdit(id: string) {
    const doc = kb.docs.find((d) => d.id === id)
    if (!doc) return
    setEditingId(id)
    setEditingTitle(doc.title)
    setEditingTags(doc.tags.join(','))
    setEditingContent(doc.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingTitle('')
    setEditingTags('')
    setEditingContent('')
  }

  function saveEdit() {
    if (!editingId) return
    kb.updateDoc(editingId, {
      title: editingTitle,
      tags: parseTags(editingTags),
      content: editingContent,
    })
    cancelEdit()
  }

  function addDoc() {
    kb.addDoc({
      title: draftTitle,
      tags: parseTags(draftTags),
      content: draftContent,
    })
    setDraftTitle('')
  }

  return (
    <div className={styles.panel}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>知识库</h3>
          <button className={styles.btn} type="button" onClick={() => kb.clearAll()}>
            Clear
          </button>
        </div>

        <div className={styles.row}>
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索：例如「退款超过 30 天怎么办」"
          />
        </div>

        <div style={{ height: 10 }} />

        <div className={styles.list}>
          {hits.length > 0 ? (
            hits.map((hit) => (
              <div key={hit.doc.id} className={styles.hit}>
                <div className={styles.hitHeader}>
                  <div>
                    <div className={styles.itemTitle}>{hit.doc.title}</div>
                    <div className={styles.meta}>
                      更新：{new Date(hit.doc.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className={styles.mono}>score={hit.score.toFixed(2)}</div>
                </div>
                <div className={styles.meta}>{hit.doc.content}</div>
              </div>
            ))
          ) : (
            <div className={styles.meta}>输入搜索词，会展示命中结果</div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>文档管理</h3>
          <div className={styles.meta}>本地存储（localStorage）</div>
        </div>

        {editingId ? (
          <>
            <div className={styles.row}>
              <input
                className={styles.input}
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="标题"
              />
              <input
                className={styles.input}
                value={editingTags}
                onChange={(e) => setEditingTags(e.target.value)}
                placeholder="tags：用逗号分隔"
              />
            </div>
            <div style={{ height: 10 }} />
            <textarea
              className={styles.textarea}
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="正文"
            />
            <div style={{ height: 10 }} />
            <div className={styles.row}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={saveEdit}>
                Save
              </button>
              <button className={styles.btn} type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.row}>
              <input
                className={styles.input}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="新文档标题（可空）"
              />
              <input
                className={styles.input}
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="tags：用逗号分隔"
              />
            </div>
            <div style={{ height: 10 }} />
            <textarea
              className={styles.textarea}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="新文档内容"
            />
            <div style={{ height: 10 }} />
            <div className={styles.row}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={addDoc}>
                Add
              </button>
            </div>
          </>
        )}

        <div style={{ height: 14 }} />

        <div className={styles.list}>
          {kb.docs.map((doc) => (
            <div key={doc.id} className={styles.card}>
              <div className={styles.titleRow}>
                <div>
                  <div className={styles.itemTitle}>{doc.title}</div>
                  <div className={styles.meta}>
                    更新：{new Date(doc.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className={styles.row}>
                  <button className={styles.btn} type="button" onClick={() => beginEdit(doc.id)}>
                    Edit
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    type="button"
                    onClick={() => kb.deleteDoc(doc.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className={styles.meta}>{doc.content}</div>
              {doc.tags.length > 0 ? (
                <div className={styles.pillRow}>
                  {doc.tags.map((t) => (
                    <span key={t} className={styles.pill}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

