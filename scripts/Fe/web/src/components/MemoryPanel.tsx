import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useMemoryStore } from '../hooks/useMemoryStory';

export const MemoryPanel: React.FC<{ userId: string; onClose: () => void }> = observer(({ userId, onClose }) => {
  const store = useMemoryStore(userId);
  const [newFactKey, setNewFactKey] = useState('');
  const [newFactValue, setNewFactValue] = useState('');

  const handleAddFact = async () => {
    if (newFactKey.trim()) {
      await store.addFact(newFactKey.trim(), newFactValue.trim());
      setNewFactKey('');
      setNewFactValue('');
    }
  };

  const handleDeleteFact = async (key: string) => {
    if (confirm(`确定删除记忆 "${key}" 吗？`)) {
      await store.deleteFact(key);
    }
  };

  // 直接使用 store 中的 observable 数据，变化时自动更新
  return (
    <div className="memory-panel">
      <div className="memory-panel-header">
        <h2>🧠 AI 记忆管理</h2>
        <button onClick={onClose}>关闭</button>
      </div>

      {/* 偏好设置 */}
      <section>
        <h3>⚙️ 偏好设置</h3>
        <select
          value={store.preferences.defaultModel}
          onChange={(e) => store.updatePreferences({ defaultModel: e.target.value as any })}
        >
          <option value="gpt-4">GPT-4</option>
          <option value="claude">Claude</option>
        </select>
      </section>

      {/* 事实记忆 */}
      <section>
        <h3>📝 AI 知道关于你的事</h3>
        {store.facts.map(fact => (
          <div key={fact.id}>
            <span>{fact.key}: {String(fact.value)}</span>
            <button onClick={() => handleDeleteFact(fact.key)}>删除</button>
          </div>
        ))}
        <div>
          <input
            placeholder="名称"
            value={newFactKey}
            onChange={(e) => setNewFactKey(e.target.value)}
          />
          <input
            placeholder="值"
            value={newFactValue}
            onChange={(e) => setNewFactValue(e.target.value)}
          />
          <button onClick={handleAddFact}>添加</button>
        </div>
      </section>

      {/* 历史会话 */}
      <section>
        <h3>💬 历史会话</h3>
        {store.recentConversations.map(conv => (
          <div key={conv.id}>
            <span>{conv.title}</span>
            <button onClick={() => store.restoreConversation(conv.id)}>恢复</button>
            <button onClick={() => store.deleteConversation(conv.id)}>删除</button>
          </div>
        ))}
      </section>
    </div>
  );
});
