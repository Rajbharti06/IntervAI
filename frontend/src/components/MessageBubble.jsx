import React, { useState } from 'react';
import SpeechAnalysisCard from './SpeechAnalysisCard';

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
  // Normalize to 1–10 scale
  const s = score <= 10 ? score : Math.round(score / 10);
  if (s >= 9) return 'text-green-600 bg-green-100';
  if (s >= 7) return 'text-yellow-600 bg-yellow-100';
  if (s >= 5) return 'text-orange-600 bg-orange-100';
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
  const { type, content, score, timestamp, analysis,
          short_verdict, improvement_tip, topic_tag } = message;
  const isUser = type === 'answer';
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const normalizedScore = typeof score === 'number'
    ? (score <= 10 ? score : Math.round(score / 10))
    : null;

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fadeIn`}>
      <div className="flex items-start space-x-3 max-w-[85%]">
        {!isUser && getMessageIcon(type)}

        <div className={`message-bubble ${isUser ? 'message-user' : 'message-assistant'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {getMessageLabel(type)}
              </span>
              {type === 'feedback' && topic_tag && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {topic_tag}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">{formatTime(timestamp)}</span>
          </div>

          {/* Verdict one-liner — surfaces the key takeaway immediately */}
          {type === 'feedback' && short_verdict && (
            <p className="text-sm font-medium text-gray-800 mb-2 italic">
              {short_verdict}
            </p>
          )}

          {/* Main content */}
          <div className="space-y-2">
            {renderContent(content, type)}
          </div>

          {/* Score + improvement tip */}
          {type === 'feedback' && normalizedScore !== null && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Score:</span>
                <div className={`px-2 py-1 rounded-full text-sm font-semibold ${getScoreColor(normalizedScore)}`}>
                  {normalizedScore}/10
                </div>
              </div>
              {improvement_tip && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span><strong>Tip:</strong> {improvement_tip}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>

      {isUser && analysis && (
        <div className="max-w-[85%] mt-1">
          <SpeechAnalysisCard
            analysis={analysis}
            isOpen={analysisOpen}
            onToggle={() => setAnalysisOpen(v => !v)}
          />
        </div>
      )}
    </div>
  );
}