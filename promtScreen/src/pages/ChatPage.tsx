import React, { useContext, useEffect, useState } from "react";
import { MyContext } from "../context/FrontendStructureContext";
import { Send, Code, Loader2, MessageSquare, Loader, CheckCircle, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant' | 'streaming';
  timestamp: Date;
  isStreaming?: boolean;
  streamingText?: string;
}

interface ConversationSummary {
  summary: string | null;
  summarizedMessageCount: number;
  recentMessageCount: number;
  totalMessages: number;
  hasSummary: boolean;
}

const ChatPage = () => {
  const { value, setValue } = useContext(MyContext);
  const [loadingCode, setLoadingCode] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [previewLink, setPreviewLink] = useState(
    "https://zewahrnmtqehbaduaewy.supabase.co/storage/v1/object/public/static/sites/build_1750011746798/index.html"
  );

  const API_BASE_URL = '/api'; // Use Vite proxy instead of direct localhost:3000

  // Load conversation summary
  const loadSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/current-summary`);
      const data = await response.json();
      
      if (data.success) {
        setConversationSummary(data.data);
      }
    } catch (error) {
      console.error('❌ Summary error:', error);
    }
  };

  // Load messages
  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversation-with-summary`);
      const data = await response.json();
      
      if (data.success && data.data.messages) {
        const formattedMessages: Message[] = data.data.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          type: msg.messageType,
          timestamp: new Date(msg.createdAt)
        }));
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('❌ Messages error:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadSummary();
    loadMessages();
  }, []);

  // Reload summary when messages change
  useEffect(() => {
    if (messages.length > 0) {
      loadSummary();
    }
  }, [messages.length]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: prompt,
      type: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = prompt;
    setPrompt("");
    setIsLoading(true);

    // Save user message to database
    try {
      await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageToSend,
          messageType: 'user'
        })
      });
    } catch (error) {
      console.error('Error saving user message:', error);
    }

    // Create streaming message placeholder
    const streamingMessageId = (Date.now() + 1).toString();
    const streamingMessage: Message = {
      id: streamingMessageId,
      content: '',
      type: 'streaming',
      timestamp: new Date(),
      isStreaming: true,
      streamingText: ''
    };

    setMessages(prev => [...prev, streamingMessage]);

    try {
      // Use fetch with ReadableStream for proper streaming
      const response = await fetch(`${API_BASE_URL}/modify-with-history-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: messageToSend })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('event: ')) {
              // Event type line - skip for now
              continue;
            }
            
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '') continue;
                
                const data = JSON.parse(jsonStr);
                console.log('📡 Received streaming data:', data);
                
                if (data.step && data.message) {
                  // Update streaming message with text (like ChatGPT)
                  setMessages(prev => prev.map(msg => 
                    msg.id === streamingMessageId 
                      ? {
                          ...msg,
                          streamingText: data.message
                        }
                      : msg
                  ));
                } else if (data.success !== undefined) {
                  // Final result received
                  let finalContent: string;
                  let metadata: any = {};

                  if (data.success) {
                    const responseData = data.data || data;
                    finalContent = `✅ Successfully modified ${responseData.selectedFiles?.length || 0} files using ${responseData.approach || 'unknown'} approach.`;
                    metadata = {
                      fileModifications: responseData.selectedFiles || [],
                      modificationApproach: responseData.approach || 'unknown',
                      modificationSuccess: true
                    };
                  } else {
                    finalContent = `❌ Error processing your request: ${data.error || 'Unknown error'}`;
                    metadata = { modificationSuccess: false };
                  }

                  // Replace streaming message with final message
                  setMessages(prev => prev.map(msg => 
                    msg.id === streamingMessageId 
                      ? {
                          ...msg,
                          content: finalContent,
                          type: 'assistant' as const,
                          isStreaming: false,
                          streamingText: undefined
                        }
                      : msg
                  ));

                  // Save assistant response to database
                  try {
                    await fetch(`${API_BASE_URL}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        content: finalContent,
                        messageType: 'assistant',
                        metadata
                      })
                    });
                  } catch (error) {
                    console.error('Error saving assistant message:', error);
                  }
                  
                  break; // Exit the streaming loop
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError, 'Raw line:', line);
              }
            }
          }
        }
      }

    } catch (error: any) {
      console.error('❌ Streaming error:', error);
      
      // Replace streaming message with error message
      const errorMessage = `❌ Error processing your request: ${error.message}`;
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? {
              ...msg,
              content: errorMessage,
              type: 'assistant' as const,
              isStreaming: false,
              progress: undefined
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const renderMessage = (message: Message) => {
    if (message.isStreaming && message.streamingText !== undefined) {
      return (
        <div className="flex justify-start">
          <div className="bg-slate-800/50 border border-slate-700/50 text-slate-200 px-4 py-3 rounded-lg max-w-3xl">
            <div className="flex items-center space-x-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="font-medium">AI Assistant</span>
            </div>
            
            {/* Streaming Text */}
            <div className="text-sm leading-relaxed">
              {message.streamingText}
              <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse"></span>
            </div>
            
            <div className="text-xs mt-2 opacity-70">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-3xl px-4 py-3 rounded-lg ${
            message.type === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-200'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
          <div className={`text-xs mt-2 opacity-70`}>
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-gradient-to-br from-black via-neutral-950 to-black h-screen flex">
      {/* Chat Section */}
      <div className="w-1/2 flex flex-col border-r border-slate-700/50">
        {/* Header */}
        <div className="bg-slate-black/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">Buildora</h1>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800/30 rounded-full mb-4">
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Start Building
              </h3>
              <p className="text-slate-400 max-w-sm">
                Describe what you want to build or modify in your React app
              </p>
            </div>
          ) : (
            <>
              {/* Conversation Summary as First Message */}
              {conversationSummary?.summary && conversationSummary.summary.trim() !== '' && (
                <div className="flex justify-start">
                  <div className="bg-amber-900/20 border border-amber-700/50 text-amber-200 px-4 py-3 rounded-lg max-w-4xl">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-amber-300">
                        Conversation Summary ({conversationSummary.summarizedMessageCount} previous messages)
                      </span>
                    </div>
                    <p className="text-sm text-amber-200 leading-relaxed whitespace-pre-wrap">
                      {conversationSummary.summary}
                    </p>
                    <div className="mt-2 text-xs text-amber-400">
                      Recent: {conversationSummary.recentMessageCount} | 
                      Total: {conversationSummary.totalMessages}
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Messages */}
              {messages.map((message) => (
                <div key={message.id}>
                  {renderMessage(message)}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-black/30 backdrop-blur-sm border-t border-slate-700/50">
          <div className="relative">
            <textarea
              className="w-full bg-black/50 border border-slate-600/50 rounded-xl text-white p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-all duration-200 placeholder-slate-400"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe the changes you want to make..."
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading}
              className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>{prompt.length}/1000</span>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="w-1/2 flex flex-col bg-slate-900/50">
        {/* Preview Header */}
        <div className="bg-black/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Live Preview</h2>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4">
          <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden">
            <iframe 
              src="https://zewahrnmtqehbaduaewy.supabase.co/storage/v1/object/public/static/sites/build_1750049856822/index.html"
              className="w-full h-full border-0"
              title="Live Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;