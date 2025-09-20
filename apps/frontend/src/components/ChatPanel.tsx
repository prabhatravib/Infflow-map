import React, { useState, useEffect, useRef } from 'react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  const chatPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatPanelRef.current) {
      chatPanelRef.current.scrollTop = chatPanelRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    // Listen for voice messages from WebSocket
    const handleVoiceMessage = (event: CustomEvent) => {
      const { type, content } = event.detail
      addMessage(type, content)
    }

    window.addEventListener('voiceMessage', handleVoiceMessage as EventListener)
    
    return () => {
      window.removeEventListener('voiceMessage', handleVoiceMessage as EventListener)
    }
  }, [])

  const addMessage = (type: 'user' | 'assistant', content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, newMessage])
  }

  const clearMessages = () => {
    setMessages([])
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  if (messages.length === 0 && !isMinimized) {
    return null
  }

  return (
    <aside 
      id="chat-panel" 
      className={`chat-panel ${isMinimized ? 'minimized' : ''}`}
      ref={chatPanelRef}
      aria-live="polite"
    >
      <button 
        id="chat-minimize-btn" 
        className="chat-minimize-btn" 
        onClick={toggleMinimize}
        title={isMinimized ? "Expand chat" : "Minimize chat"}
      >
        {isMinimized ? '+' : '−'}
      </button>

      {!isMinimized && (
        <>
          {messages.map((message) => (
            <div key={message.id} className={`bubble ${message.type}`}>
              {message.content}
            </div>
          ))}
          
          {messages.length > 0 && (
            <button 
              onClick={clearMessages}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: 'rgba(0,0,0,0.1)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
        </>
      )}
    </aside>
  )
}
