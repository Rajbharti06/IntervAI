import React from 'react';

function formatTime(timestamp) {
  try {
    const date = new Date(timestamp || Date.now());
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
}

function getScoreColor(score) {
  if (typeof score !== 'number') return 'text-gray-600 bg-gray-100';
  if (score >= 80) return 'text-green-600 bg-green-100';
  if (score >= 60) return 'text-yellow-600 bg-yellow-100';
  if (score >= 40) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
}

function getMessageIcon(type) {
  switch (type) {
    case 'question':
      return (
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case 'answer':
      return (
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      );
    case 'feedback':
      return (
        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7-4L5 20l4-1a8.014 8.014 0 01-2-7c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
          </svg>
        </div>
      );
  }
}

function getMessageLabel(type) {
  switch (type) {
    case 'question':
      return 'Question';
    case 'answer':
      return 'Your Answer';
    case 'feedback':
      return 'AI Feedback';
    default:
      return 'Message';
  }
}

function renderContent(content, type) {
  if (!content) return null;

  // Split content into paragraphs
  const paragraphs = String(content).split(/\n\s*\n/);
  
  return paragraphs.map((paragraph, idx) => {
    // Handle different formatting based on message type
    if (type === 'feedback') {
      // Enhanced formatting for feedback
      const formatted = paragraph
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>');
      
      return (
        <p 
          key={idx} 
          className="whitespace-pre-wrap leading-relaxed" 
          dangerouslySetInnerHTML={{ __html: formatted }} 
        />
      );
    }
    
    // Default formatting for questions and answers
    return (
      <p key={idx} className="whitespace-pre-wrap leading-relaxed">
        {paragraph}
      </p>
    );
  });
}

export default function MessageBubble({ message }) {
  const { type, content, score, timestamp } = message;
  const isUser = type === 'answer';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className="flex items-start space-x-3 max-w-[85%]">
        {!isUser && getMessageIcon(type)}
        
        <div className={`message-bubble ${isUser ? 'message-user' : 'message-assistant'}`}>
          {/* Message Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getMessageLabel(type)}
            </span>
            <span className="text-xs text-gray-400">
              {formatTime(timestamp)}
            </span>
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            {renderContent(content, type)}
          </div>

          {/* Score Display for Feedback */}
          {type === 'feedback' && typeof score === 'number' && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Score:</span>
                <div className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(score)}`}>
                  {score}/100
                </div>
              </div>
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}