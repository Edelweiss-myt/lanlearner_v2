import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ChatMessage, GroundingChunk } from '../../types';
import { generateChatResponse, generateChatResponseStream } from '../../services/geminiService';
import { generateId } from '../../utils/miscUtils';

interface AiChatProps {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[] | ((prevMessages: ChatMessage[]) => ChatMessage[])) => void;
}

export const AiChat: React.FC<AiChatProps> = ({ messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [useStreaming, setUseStreaming] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    let aiMessageIdForErrorHandling: string | null = null;

    try {
        if (useStreaming) {
            const aiMessageId = generateId();
            aiMessageIdForErrorHandling = aiMessageId; // Store for potential removal in catch
            const placeholderAiMessage: ChatMessage = {
                id: aiMessageId,
                text: '',
                sender: 'ai',
                timestamp: new Date(),
                sources: []
            };
            setMessages((prev: ChatMessage[]) => [...prev, placeholderAiMessage]);
            
            let currentText = '';
            let currentSources: GroundingChunk[] = [];

            for await (const chunk of generateChatResponseStream(input, messages.filter(m => m.id !== placeholderAiMessage.id))) {
                if (chunk.text === "API Key not configured. Chat streaming is unavailable." || 
                    chunk.text === "Error: Invalid API Key. AI chat stream failed." ||
                    chunk.text === "Error: AI chat stream failed.") {
                    setError(chunk.text); 
                    setMessages((prev: ChatMessage[]) => prev.filter(m => m.id !== aiMessageId)); 
                    setIsLoading(false);
                    return; 
                }
                currentText += (chunk.text ?? '');
                if (chunk.sources && chunk.sources.length > 0) {
                    const newSourceUris = new Set(currentSources.map(s => s.web.uri));
                    chunk.sources.forEach(s => {
                        if (!newSourceUris.has(s.web.uri)) {
                            currentSources.push(s);
                            newSourceUris.add(s.web.uri);
                        }
                    });
                }
                setMessages((prev: ChatMessage[]) => prev.map(m => 
                    m.id === aiMessageId ? { ...m, text: currentText, sources: [...currentSources], timestamp: new Date() } : m
                ));
            }
        } else {
            const response = await generateChatResponse(input, messages);
             if (response.text === "API Key not configured. Chat is unavailable.") {
                setError(response.text);
                setIsLoading(false);
                return;
            }
            const aiMessage: ChatMessage = {
                id: generateId(),
                text: response.text ?? '',
                sender: 'ai',
                timestamp: new Date(),
                sources: response.sources
            };
            setMessages((prev: ChatMessage[]) => [...prev, aiMessage]);
        }
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      const specificError = err.message || "抱歉，无法获取回复。请重试。";
      setError(specificError);
      if (useStreaming) {
        // If an error occurred during streaming, remove the placeholder AI message
        if (aiMessageIdForErrorHandling) {
          setMessages((prevMsgs: ChatMessage[]) => prevMsgs.filter(msg => msg.id !== aiMessageIdForErrorHandling));
        } else {
          // Fallback: remove last AI message if it's empty (less precise)
          setMessages((prevMsgs: ChatMessage[]) => {
            const lastMsg = prevMsgs[prevMsgs.length - 1];
            if (lastMsg && lastMsg.sender === 'ai' && lastMsg.text === '') {
              return prevMsgs.slice(0, -1);
            }
            return prevMsgs;
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearChat = () => {
    if (window.confirm("您确定要清空聊天记录吗？")) {
      setMessages([]);
    }
  }

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-semibold text-gray-700">AI 聊天助手</h3>
        <div className="flex items-center space-x-2">
            <label htmlFor="streaming-toggle" className="text-sm text-gray-600">流式:</label>
            <input 
                type="checkbox" 
                id="streaming-toggle"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
                className="form-checkbox h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <Button onClick={handleClearChat} variant="ghost" size="sm" className="text-red-500 hover:text-red-700">清空聊天记录</Button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto bg-gray-50 p-4 rounded-md border border-gray-200 mb-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg shadow ${
                msg.sender === 'user' ? 'bg-primary-500 text-white' : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text || (msg.sender === 'ai' && isLoading && messages[messages.length -1]?.id === msg.id ? '思考中...' : '')}</p>
              {msg.sender === 'ai' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-1 border-t border-gray-300">
                  <p className="text-xs font-semibold mb-0.5">来源:</p>
                  <ul className="list-disc list-inside text-xs">
                    {msg.sources.map((source, idx) => (
                      <li key={idx}>
                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-secondary-600 hover:underline">
                          {source.web.title || source.web.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-200' : 'text-gray-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {isLoading && messages.length > 0 && messages[messages.length -1]?.sender === 'user' &&  ( 
            <div className="flex justify-start">
                 <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg shadow bg-white text-gray-800 border border-gray-200">
                    <LoadingSpinner size="sm" text="AI 思考中..." />
                 </div>
            </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500 mb-2 text-center">{error}</p>}
      <div className="flex items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          placeholder="询问任何关于语言学习的问题..."
          className="flex-grow border border-gray-300 rounded-l-md p-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          disabled={isLoading}
        />
        <Button onClick={handleSendMessage} isLoading={isLoading} disabled={isLoading || !input.trim()} className="rounded-l-none p-3">
          发送
        </Button>
      </div>
    </div>
  );
};