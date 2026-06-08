import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useMemory } from '../contexts/MemoryProvider';
import './MemoryPanel.less';

interface MemoryPanelProps {
  onClose: () => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = observer(({ onClose }) => {
  const store = useMemory();
  
  const [newFactKey, setNewFactKey] = useState('');
  const [newFactValue, setNewFactValue] = useState('');
  const [editingFactKey, setEditingFactKey] = useState<string | null>(null);
  const [editingFactValue, setEditingFactValue] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'facts' | 'preferences' | 'history'>('facts');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ========== 偏好设置 ==========
  const handleUpdatePreference = async (key: string, value: unknown) => {
    await store.updatePreferences({ [key]: value });
    showToast('偏好已更新', 'success');
  };

  // ========== 事实记忆 ==========
  const handleAddFact = async () => {
    if (!newFactKey.trim()) {
      showToast('请输入记忆名称', 'error');
      return;
    }
    await store.addFact(newFactKey.trim(), newFactValue.trim() || '(空)', 'user_declared');
    setNewFactKey('');
    setNewFactValue('');
    showToast('记忆已添加', 'success');
  };

  const handleEditFact = (key: string, value: unknown) => {
    setEditingFactKey(key);
    setEditingFactValue(String(value));
  };

  const handleSaveEditFact = async (key: string) => {
    await store.updateFact(key, editingFactValue);
    setEditingFactKey(null);
    setEditingFactValue('');
    showToast('记忆已更新', 'success');
  };

  const handleDeleteFact = async (key: string) => {
    if (confirm(`确定删除记忆 "${key}" 吗？`)) {
      await store.deleteFact(key);
      showToast('记忆已删除', 'success');
    }
  };

  // ========== 历史会话 ==========
  const handleRestoreConversation = async (id: string) => {
    const success = await store.restoreConversation(id);
    if (success) {
      showToast('会话已恢复', 'success');
      onClose();
    } else {
      showToast('恢复失败', 'error');
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (confirm('确定删除这个历史会话吗？')) {
      await store.deleteConversation(id);
      showToast('会话已删除', 'success');
    }
  };

  // ========== 导入/导出 ==========
  const handleExport = () => {
    const memories = store.getAllMemories();
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      preferences: memories.preferences,
      facts: memories.facts,
      savedQueries: memories.savedQueries,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功', 'success');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.preferences) {
          await store.updatePreferences(data.preferences);
        }
        if (data.facts && Array.isArray(data.facts)) {
          for (const fact of data.facts) {
            await store.addFact(fact.key, fact.value, fact.source || 'user_declared');
          }
        }
        showToast('导入成功', 'success');
      } catch {
        showToast('导入失败：文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleClearAll = async () => {
    if (confirm('⚠️ 确定清空所有记忆吗？此操作不可撤销。')) {
      await store.clearAllMemories();
      showToast('已清空所有记忆', 'success');
    }
  };

  return (
    <div className="memory-panel">
      {/* 头部 */}
      <div className="memory-panel-header">
        <h2>🧠 AI 记忆管理</h2>
        <div className="header-actions">
          <button onClick={() => setShowImportExport(!showImportExport)} className="icon-btn">
            📁
          </button>
          <button onClick={handleClearAll} className="danger-btn">
            🗑️ 清空
          </button>
          <button onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>
      </div>

      {/* 导入/导出面板 */}
      {showImportExport && (
        <div className="import-export-panel">
          <button onClick={handleExport}>📤 导出记忆</button>
          <label className="import-btn">
            📥 导入记忆
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="memory-tabs">
        <button className={activeTab === 'facts' ? 'active' : ''} onClick={() => setActiveTab('facts')}>
          📝 事实记忆
        </button>
        <button className={activeTab === 'preferences' ? 'active' : ''} onClick={() => setActiveTab('preferences')}>
          ⚙️ 偏好设置
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          💬 历史会话
        </button>
      </div>

      {/* 事实记忆 Tab */}
      {activeTab === 'facts' && (
        <div className="memory-section">
          <p className="section-hint">
            AI 会记住你告诉它的信息，你可以在这里查看、编辑或删除。
          </p>
          
          <div className="facts-list">
            {store.facts.length === 0 ? (
              <div className="empty-state">
                暂无事实记忆。告诉 AI "我叫 xxx" 或手动添加。
              </div>
            ) : (
              store.facts.map(fact => (
                <div key={fact.id} className="fact-item">
                  {editingFactKey === fact.key ? (
                    <div className="fact-edit">
                      <input
                        type="text"
                        value={editingFactValue}
                        onChange={(e) => setEditingFactValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEditFact(fact.key)}>💾</button>
                      <button onClick={() => setEditingFactKey(null)}>取消</button>
                    </div>
                  ) : (
                    <>
                      <div className="fact-content">
                        <span className="fact-key">{fact.key}</span>
                        <span className="fact-value">: {String(fact.value)}</span>
                        <span className="fact-source">({fact.source})</span>
                      </div>
                      <div className="fact-actions">
                        <button onClick={() => handleEditFact(fact.key, fact.value)}>✏️</button>
                        <button onClick={() => handleDeleteFact(fact.key)}>🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="add-fact-form">
            <input
              type="text"
              placeholder="名称 (如: userName)"
              value={newFactKey}
              onChange={(e) => setNewFactKey(e.target.value)}
            />
            <input
              type="text"
              placeholder="值"
              value={newFactValue}
              onChange={(e) => setNewFactValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
            />
            <button onClick={handleAddFact}>+ 添加</button>
          </div>
        </div>
      )}

      {/* 偏好设置 Tab */}
      {activeTab === 'preferences' && (
        <div className="memory-section">
          <div className="preferences-grid">
            <div className="pref-item">
              <label>主题</label>
              <select
                value={store.preferences.theme}
                onChange={(e) => handleUpdatePreference('theme', e.target.value)}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
            
            <div className="pref-item">
              <label>默认模型</label>
              <select
                value={store.preferences.defaultModel}
                onChange={(e) => handleUpdatePreference('defaultModel', e.target.value)}
              >
                <option value="gpt-4">GPT-4</option>
                <option value="claude">Claude</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            
            <div className="pref-item">
              <label>输出风格</label>
              <select
                value={store.preferences.outputStyle}
                onChange={(e) => handleUpdatePreference('outputStyle', e.target.value)}
              >
                <option value="concise">简洁</option>
                <option value="detailed">详细</option>
                <option value="professional">专业</option>
              </select>
            </div>
            
            <div className="pref-item">
              <label>报告模板</label>
              <input
                type="text"
                value={store.preferences.reportTemplate || ''}
                onChange={(e) => handleUpdatePreference('reportTemplate', e.target.value)}
                placeholder="默认报告模板ID"
              />
            </div>
          </div>
        </div>
      )}

      {/* 历史会话 Tab */}
      {activeTab === 'history' && (
        <div className="memory-section">
          <p className="section-hint">
            点击恢复可回到之前的对话，AI 会记住之前的上下文。
          </p>
          
          <div className="conversations-list">
            {store.recentConversations.length === 0 ? (
              <div className="empty-state">暂无历史会话</div>
            ) : (
              store.recentConversations.map(conv => (
                <div key={conv.id} className="conversation-item">
                  <div className="conv-info">
                    <span className="conv-title">{conv.title}</span>
                    <span className="conv-date">
                      {new Date(conv.lastAccessedAt).toLocaleString()}
                    </span>
                    <span className="conv-msg-count">{conv.messages.length} 条消息</span>
                  </div>
                  <div className="conv-actions">
                    <button onClick={() => handleRestoreConversation(conv.id)}>💬 恢复</button>
                    <button onClick={() => handleDeleteConversation(conv.id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 页脚 */}
      <div className="memory-panel-footer">
        <span>💡 记忆会同步到云端（联网时）</span>
      </div>
    </div>
  );
});
