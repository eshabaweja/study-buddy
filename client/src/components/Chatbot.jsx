import React, { useState, useRef, useEffect } from 'react';
import ProblemSolvingExample from './ProblemSolvingExample';

const Chatbot = ({ question }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const messagesEndRef = useRef(null);
  const [chatHistory, setChatHistory] = useState([]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const messagesContainer = document.querySelector('.chatbot-messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messages]);
  
  // Initialize conversation when question changes
  useEffect(() => {
    if (question && !conversationStarted) {
      const welcomeMessage = {
        id: Date.now(),
        text: `Hi! I'm Brutus, your AI tutor. What is the goal of this problem?`,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages([welcomeMessage]);
      setConversationStarted(true);
    }
  }, [question, conversationStarted]);

  const sendMessageToAPI = async (userMessage, onStreamChunk) => {
    if (!question) return;
    const updatedHistory = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(updatedHistory);

    try {
      // Prepare question data for the API
      const questionData = {
        goal: question.goal || '',
        implicitData: question.implicitData?.join(', ') || '',
        explicitData: question.explicitData?.join(', ') || '',
        solution: question.solution?.join(', ') || '',
        ...(question.figureDescription
          ? { figureDescription: question.figureDescription }
          : {}),
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/openai-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: userMessage,
          chatHistory: chatHistory,
          questionData: questionData,
          questionId: question.id,
          stream: true // Enable streaming for optimized performance
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from tutor');
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]' || data.trim() === '') continue;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.done) {
                // Update chat history with full response
                setChatHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
                return fullResponse;
              }

              if (parsed.content) {
                fullResponse += parsed.content;
                if (onStreamChunk) {
                  onStreamChunk(fullResponse);
                }
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      // Update chat history with full response
      setChatHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
      return fullResponse;
    } catch (error) {
      console.error('Error calling LiteLLM API:', error);
      return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputMessage.trim() === '' || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    const userInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    // Create placeholder bot message for streaming
    const botMessageId = Date.now() + 1;
    const botMessage = {
      id: botMessageId,
      text: '',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prevMessages => [...prevMessages, botMessage]);

    try {
      // Stream response with real-time updates
      await sendMessageToAPI(userInput, (streamedText) => {
        // Update the bot message in real-time as chunks arrive
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, text: streamedText }
              : msg
          )
        );
      });
    } catch (error) {
      const errorMessage = {
        id: botMessageId,
        text: "I'm sorry, something went wrong. Please try again.",
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === botMessageId ? errorMessage : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setChatHistory([]);
    setConversationStarted(false);
    setInputMessage('');
    setIsLoading(false);
  };

  if (!question) {
    return null;
  }

  return (
    <div className="ba-card bux-grid__cell bux-grid__cell--12 bux-mar-top-sp-16">
      <div className="bux-grid">
        <div className="bux-grid__cell bux-grid__cell--12 bux-flex bux-flex--justify-between bux-flex--align-center">
          <h3 className="bux-card__heading ba-problem-example__goal-heading">
            🤖 Brutus AI Tutor
            <ProblemSolvingExample />
          </h3>
          <button 
            onClick={resetConversation}
            className="bux-button--alt bux-button--small"
            title="Start a new conversation"
          >
            Reset
          </button>
        </div>

        <div className="bux-grid__cell bux-grid__cell--12">
          <p className="chatbot-disclaimer" role="note">
            Brutus is a built-in assistance feature and is not always correct.
            Use it as scaffolding for your own thinking.
          </p>
        </div>

        <div className="bux-grid__cell bux-grid__cell--12">
          <div className="chatbot-messages-container">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chatbot-message ${message.sender === 'user' ? 'chatbot-user-message' : 'chatbot-bot-message'}`}
              >
                <div className="chatbot-message-content">
                  <p>{message.text}</p>
                  <span className="chatbot-message-timestamp">
                    {message.timestamp}
                  </span>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chatbot-message chatbot-bot-message">
                <div className="chatbot-message-content">
                  <div className="typing-indicator">
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                  <span style={{ fontSize: '0.875rem', color: '#666', marginLeft: '8px' }}>
                    Brutus is thinking...
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bux-grid__cell bux-grid__cell--12">
          <form onSubmit={handleSendMessage} className="chatbot-input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your response here..."
              className="chatbot-message-input"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="bux-button"
              disabled={isLoading || inputMessage.trim() === ''}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
