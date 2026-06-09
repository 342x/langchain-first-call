import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useMemory } from '../contexts/MemoryProvider';
import { useUserProfileStore } from '../hooks/useUserProfileStore';
import './ChatInterface.less';

interface ChatInterfaceProps {
  onOpenMemoryPanel?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = observer(({ onOpenMemoryPanel }) => {
  const store = useMemory();
  const profile = useUserProfileStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxRendered = 120;

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.currentMessages]);

  const renderedMessages = showAll ? store.currentMessages : store.currentMessages.slice(-maxRendered);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    
    // 添加用户消息
    store.addMessage('user', userMessage);
    
    // 模拟 AI 思考
    setIsTyping(true);
    
    // 模拟 AI 回复（实际项目中替换为真实 API 调用）
    setTimeout(() => {
      // 检查是否是记忆相关的指令
      if (userMessage.toLowerCase().startsWith('我叫')) {
        const name = userMessage.slice(3);
        store.addFact('userName', name, 'user_declared');
        profile.setName(name);
        store.addMessage('assistant', `好的，我记住了，你叫 ${name}。`);
      } else if (userMessage.toLowerCase().includes('记住')) {
        store.addMessage('assistant', '好的，我会记住这个信息。');
      } else {
        store.addMessage('assistant', `收到: ${userMessage}`);
      }
      setIsTyping(false);
    }, 1000);
  };

  // 保存当前会话
  const handleSaveSession = async () => {
    await store.saveCurrentSession();
  };

  // 开始新会话
  const handleNewSession = () => {
    if (store.currentMessages.length > 0) {
      if (confirm('当前会话未保存，确定要开始新会话吗？')) {
        store.startNewSession();
      }
    } else {
      store.startNewSession();
    }
  };

  return (
    <div className="chat-interface">
      {/* 头部 */}
      <div className="chat-header">
        <div className="header-left">
          <h2>AI 助手</h2>
          <span className="model-badge">{store.preferences.defaultModel}</span>
        </div>
        <div className="header-right">
          <button onClick={handleNewSession} className="icon-btn" title="新会话">
            ➕
          </button>
          <button onClick={handleSaveSession} className="icon-btn" title="保存会话">
            💾
          </button>
          <button onClick={onOpenMemoryPanel} className="icon-btn" title="记忆管理">
            🧠
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="chat-messages">
        {!showAll && store.currentMessages.length > maxRendered ? (
          <div className="window-banner">
            <div>窗口化渲染：仅渲染最近 {maxRendered} 条（总计 {store.currentMessages.length} 条）</div>
            <button type="button" onClick={() => setShowAll(true)}>
              显示全部
            </button>
          </div>
        ) : null}
        {store.currentMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>开始和 AI 对话吧！</p>
            <small>AI 会记住你告诉它的信息</small>
          </div>
        ) : (
          <>
            {renderedMessages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="message assistant typing">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息... (输入「我叫 xxx」让我记住你)"
            disabled={isTyping}
          />
          <button onClick={handleSend} disabled={isTyping || !input.trim()}>
            发送
          </button>
        </div>
        <div className="input-hint">
          💡 历史会话需要手动保存：点击右上角 💾 或在记忆面板的「历史会话」里保存
        </div>
      </div>
    </div>
  );
});
