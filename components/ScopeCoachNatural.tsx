import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ExtractedComponent {
  content: string;
  confidence: number; // 0-1
  lastUpdated: Date;
  sources: string[]; // Message IDs that contributed
}

interface ExtractedComponents {
  S: ExtractedComponent | null;
  C: ExtractedComponent | null;
  O: ExtractedComponent | null;
  P: ExtractedComponent | null;
  E: ExtractedComponent | null;
}

interface Contradiction {
  id: string;
  component: keyof ExtractedComponents;
  statement1: string;
  statement2: string;
  resolved: boolean;
  resolution?: string;
}

interface CompletenessState {
  overall: number; // 0-100
  components: {
    S: number;
    C: number;
    O: number;
    P: number;
    E: number;
  };
}

interface ScopeCoachNaturalProps {
  onComplete: (components: ExtractedComponents) => void;
  initialContext?: string;
}

// Constants
const COMPONENT_LABELS: Record<keyof ExtractedComponents, string> = {
  S: 'Situation',
  C: 'Choices',
  O: 'Outcomes',
  P: 'Purpose',
  E: 'Engagement',
};

const INITIAL_EXTRACTED: ExtractedComponents = {
  S: null,
  C: null,
  O: null,
  P: null,
  E: null,
};

const INITIAL_COMPLETENESS: CompletenessState = {
  overall: 0,
  components: { S: 0, C: 0, O: 0, P: 0, E: 0 },
};

// Component
export const ScopeCoachNatural: React.FC<ScopeCoachNaturalProps> = ({
  onComplete,
  initialContext = '',
}) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [extractedComponents, setExtractedComponents] = useState<ExtractedComponents>(INITIAL_EXTRACTED);
  const [completeness, setCompleteness] = useState<CompletenessState>(INITIAL_COMPLETENESS);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExtractionStatus, setShowExtractionStatus] = useState(false);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: initialContext
        ? `I'd love to help you develop a compelling script! You mentioned: "${initialContext}". Tell me more about what you're trying to achieve - what's the situation your audience is facing, and what do you want them to understand or do?`
        : `Hi! I'm here to help you create a powerful persuasive script. Let's have a natural conversation about your topic. What situation or challenge would you like to address? Just tell me about it in your own words, and I'll help shape it into a compelling message.`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [initialContext]);

  // Check if ready to generate script
  useEffect(() => {
    const threshold = 60; // 60% completeness required
    if (completeness.overall >= threshold && !isReadyToGenerate) {
      setIsReadyToGenerate(true);
      const readyMessage: Message = {
        id: `ready-${Date.now()}`,
        role: 'system',
        content: `Great progress! I've extracted enough content for all S.C.O.P.E. components. You can continue refining or generate your script now.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, readyMessage]);
    }
  }, [completeness.overall, isReadyToGenerate]);

  // API Integration Placeholders
  const sendMessageToAPI = async (message: string): Promise<{
    response: string;
    extractedUpdates: Partial<ExtractedComponents>;
    completenessUpdates: Partial<CompletenessState['components']>;
    newContradictions: Contradiction[];
  }> => {
    // TODO: Integrate with actual API
    // This placeholder simulates extraction and response
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Simulate extraction based on keywords
    const extractedUpdates: Partial<ExtractedComponents> = {};
    const completenessUpdates: Partial<CompletenessState['components']> = {};

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('situation') || lowerMessage.includes('challenge') || lowerMessage.includes('problem')) {
      extractedUpdates.S = {
        content: message,
        confidence: 0.7,
        lastUpdated: new Date(),
        sources: [`user-${Date.now()}`],
      };
      completenessUpdates.S = Math.min(100, (completeness.components.S || 0) + 30);
    }

    if (lowerMessage.includes('choice') || lowerMessage.includes('option') || lowerMessage.includes('decide')) {
      extractedUpdates.C = {
        content: message,
        confidence: 0.6,
        lastUpdated: new Date(),
        sources: [`user-${Date.now()}`],
      };
      completenessUpdates.C = Math.min(100, (completeness.components.C || 0) + 30);
    }

    if (lowerMessage.includes('outcome') || lowerMessage.includes('result') || lowerMessage.includes('success')) {
      extractedUpdates.O = {
        content: message,
        confidence: 0.65,
        lastUpdated: new Date(),
        sources: [`user-${Date.now()}`],
      };
      completenessUpdates.O = Math.min(100, (completeness.components.O || 0) + 30);
    }

    if (lowerMessage.includes('purpose') || lowerMessage.includes('why') || lowerMessage.includes('matter')) {
      extractedUpdates.P = {
        content: message,
        confidence: 0.7,
        lastUpdated: new Date(),
        sources: [`user-${Date.now()}`],
      };
      completenessUpdates.P = Math.min(100, (completeness.components.P || 0) + 30);
    }

    if (lowerMessage.includes('action') || lowerMessage.includes('do') || lowerMessage.includes('engage')) {
      extractedUpdates.E = {
        content: message,
        confidence: 0.75,
        lastUpdated: new Date(),
        sources: [`user-${Date.now()}`],
      };
      completenessUpdates.E = Math.min(100, (completeness.components.E || 0) + 30);
    }

    // Generate contextual response
    let response = "That's helpful! ";
    const missingComponents = Object.entries(completeness.components)
      .filter(([_, value]) => value < 40)
      .map(([key]) => COMPONENT_LABELS[key as keyof ExtractedComponents]);

    if (missingComponents.length > 0) {
      const randomMissing = missingComponents[Math.floor(Math.random() * missingComponents.length)];
      response += `I'd love to hear more about the ${randomMissing.toLowerCase()} aspect. `;

      switch (randomMissing) {
        case 'Situation':
          response += "What specific challenges or context is your audience dealing with?";
          break;
        case 'Choices':
          response += "What options or decisions are available to them?";
          break;
        case 'Outcomes':
          response += "What results could they achieve, and what happens if they don't act?";
          break;
        case 'Purpose':
          response += "Why does this matter to them on a deeper level?";
          break;
        case 'Engagement':
          response += "What specific action do you want them to take?";
          break;
      }
    } else {
      response += "We're making great progress! Is there anything you'd like to expand on or clarify?";
    }

    return {
      response,
      extractedUpdates,
      completenessUpdates,
      newContradictions: [],
    };
  };

  // Handlers
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await sendMessageToAPI(inputValue.trim());

      // Update extracted components
      setExtractedComponents((prev) => ({
        ...prev,
        ...result.extractedUpdates,
      }));

      // Update completeness
      setCompleteness((prev) => {
        const newComponents = {
          ...prev.components,
          ...result.completenessUpdates,
        };
        const overall = Object.values(newComponents).reduce((sum, val) => sum + val, 0) / 5;
        return {
          overall,
          components: newComponents,
        };
      });

      // Add any contradictions
      if (result.newContradictions.length > 0) {
        setContradictions((prev) => [...prev, ...result.newContradictions]);
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Sorry, there was an error processing your message. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateScript = () => {
    setShowExtractionStatus(true);
    // Show status for a moment before completing
    setTimeout(() => {
      onComplete(extractedComponents);
    }, 2000);
  };

  // Render helpers
  const renderProgressBar = () => (
    <div className="h-1 bg-gray-100">
      <div
        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
        style={{ width: `${completeness.overall}%` }}
        role="progressbar"
        aria-valuenow={completeness.overall}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Script completeness"
      />
    </div>
  );

  const renderExtractionStatus = () => {
    if (!showExtractionStatus) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Extracting S.C.O.P.E. Components
          </h3>

          <div className="space-y-3">
            {(Object.keys(extractedComponents) as Array<keyof ExtractedComponents>).map((key) => {
              const component = extractedComponents[key];
              const percentage = completeness.components[key];

              return (
                <div key={key} className="flex items-center">
                  <div className="w-24 flex items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {key}: {COMPONENT_LABELS[key]}
                    </span>
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          percentage >= 60 ? 'bg-green-500' :
                          percentage >= 30 ? 'bg-yellow-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    {component ? (
                      <span className={`text-xs font-medium ${
                        component.confidence >= 0.7 ? 'text-green-600' :
                        component.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {Math.round(component.confidence * 100)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">--</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {contradictions.filter(c => !c.resolved).length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-yellow-500 mr-2 mt-0.5" />
                <div className="text-xs text-yellow-700">
                  <span className="font-medium">
                    {contradictions.filter(c => !c.resolved).length} unresolved contradiction(s)
                  </span>
                  <p className="mt-1">These will be flagged in your generated script.</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
            <span className="text-sm text-gray-600">Generating your script...</span>
          </div>
        </div>
      </div>
    );
  };

  const renderMessages = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[85%] rounded-2xl px-4 py-3
              ${message.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-md'
                : message.role === 'system'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-gray-100 text-gray-900 rounded-bl-md'
              }
            `}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            <span className={`
              text-xs mt-1 block
              ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}
            `}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl px-4 py-3 rounded-bl-md">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderQuickStatus = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="bg-gray-50 border-t">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-100"
          aria-expanded={isExpanded}
        >
          <span>
            Component Status ({Math.round(completeness.overall)}% complete)
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-3 grid grid-cols-5 gap-2">
            {(Object.keys(completeness.components) as Array<keyof typeof completeness.components>).map((key) => (
              <div key={key} className="text-center">
                <div className={`
                  w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold
                  ${completeness.components[key] >= 60
                    ? 'bg-green-100 text-green-700'
                    : completeness.components[key] >= 30
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                  }
                `}>
                  {key}
                </div>
                <span className="text-xs text-gray-500 mt-1 block">
                  {completeness.components[key]}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Subtle progress bar */}
      {renderProgressBar()}

      {/* Messages */}
      {renderMessages()}

      {/* Quick status (collapsible) */}
      {renderQuickStatus()}

      {/* Input Area */}
      <div className="border-t p-4">
        {isReadyToGenerate && (
          <div className="mb-3 flex items-center justify-between bg-blue-50 rounded-lg p-3">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-blue-500 mr-2" />
              <span className="text-sm text-blue-700">Ready to generate your script!</span>
            </div>
            <button
              onClick={handleGenerateScript}
              className="px-4 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              Generate Script
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about your topic..."
              rows={2}
              className="w-full px-4 py-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              aria-label="Message input"
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-2 text-center">
          Just chat naturally - I'll extract S.C.O.P.E. components as we go
        </p>
      </div>

      {/* Extraction Status Modal */}
      {renderExtractionStatus()}
    </div>
  );
};

export default ScopeCoachNatural;
