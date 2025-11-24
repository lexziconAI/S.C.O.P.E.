import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  Loader2,
  Info,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-5
  feedback: string[];
  suggestions: string[];
  warnings: string[];
}

interface ComponentData {
  content: string;
  validation: ValidationResult | null;
  isComplete: boolean;
}

interface ScopeComponents {
  S: ComponentData; // Situation
  C: ComponentData; // Choices
  O: ComponentData; // Outcomes
  P: ComponentData; // Purpose
  E: ComponentData; // Engagement
}

interface ScopeCoachSequentialProps {
  onComplete: (components: ScopeComponents) => void;
  initialContext?: string;
}

// Constants
const STEPS = [
  { key: 'intro', label: 'Introduction', component: null },
  { key: 'S', label: 'Situation', component: 'S' as keyof ScopeComponents },
  { key: 'C', label: 'Choices', component: 'C' as keyof ScopeComponents },
  { key: 'O', label: 'Outcomes', component: 'O' as keyof ScopeComponents },
  { key: 'P', label: 'Purpose', component: 'P' as keyof ScopeComponents },
  { key: 'E', label: 'Engagement', component: 'E' as keyof ScopeComponents },
  { key: 'review', label: 'Review', component: null },
  { key: 'complete', label: 'Complete', component: null },
];

const INITIAL_COMPONENTS: ScopeComponents = {
  S: { content: '', validation: null, isComplete: false },
  C: { content: '', validation: null, isComplete: false },
  O: { content: '', validation: null, isComplete: false },
  P: { content: '', validation: null, isComplete: false },
  E: { content: '', validation: null, isComplete: false },
};

const COMPONENT_DESCRIPTIONS: Record<keyof ScopeComponents, string> = {
  S: 'Describe the current situation - what challenges or context does your audience face?',
  C: 'What choices or options are available? What decisions need to be made?',
  O: 'What outcomes are possible? Paint a picture of success and consequences.',
  P: 'What is the deeper purpose? Why does this matter to them personally?',
  E: 'What specific engagement or action do you want them to take?',
};

// Component
export const ScopeCoachSequential: React.FC<ScopeCoachSequentialProps> = ({
  onComplete,
  initialContext = '',
}) => {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [components, setComponents] = useState<ScopeComponents>(INITIAL_COMPONENTS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom of messages
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
        ? `Welcome! I'll help you develop your S.C.O.P.E. script. I see you've provided some context: "${initialContext}". Let's start by exploring the Situation. ${COMPONENT_DESCRIPTIONS.S}`
        : `Welcome to the S.C.O.P.E. Coach! I'll guide you through each component of your persuasive script step by step. Let's begin with the Situation. ${COMPONENT_DESCRIPTIONS.S}`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    setCurrentStep(1); // Move to Situation step
  }, [initialContext]);

  // API Integration Placeholders
  const sendMessageToAPI = async (message: string): Promise<string> => {
    // TODO: Integrate with actual API
    // This is a placeholder that simulates an API response
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const currentComponent = STEPS[currentStep]?.component;
    if (currentComponent) {
      return `Great input for the ${currentComponent} component! ${message.length > 50
        ? "You've provided good detail. Would you like to refine this further or move to the next component?"
        : "Could you elaborate a bit more to make this component stronger?"}`;
    }
    return "Let's continue developing your script.";
  };

  const validateComponent = async (
    component: keyof ScopeComponents,
    content: string
  ): Promise<ValidationResult> => {
    // TODO: Integrate with actual validation API
    // This is a placeholder that simulates validation
    await new Promise((resolve) => setTimeout(resolve, 500));

    const wordCount = content.split(/\s+/).length;
    const score = Math.min(5, Math.max(1, Math.floor(wordCount / 10)));

    return {
      isValid: score >= 3,
      score,
      feedback: score >= 3
        ? ['Good level of detail', 'Clear and specific']
        : ['Could use more detail'],
      suggestions: score < 4
        ? ['Consider adding specific examples', 'Include emotional elements']
        : [],
      warnings: wordCount < 10
        ? ['Content seems too brief']
        : [],
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
      // Update component content
      const currentComponent = STEPS[currentStep]?.component;
      if (currentComponent) {
        setComponents((prev) => ({
          ...prev,
          [currentComponent]: {
            ...prev[currentComponent],
            content: prev[currentComponent].content
              ? `${prev[currentComponent].content}\n\n${inputValue.trim()}`
              : inputValue.trim(),
          },
        }));

        // Validate the component
        const validation = await validateComponent(currentComponent, inputValue.trim());
        setValidationResults(validation);
        setComponents((prev) => ({
          ...prev,
          [currentComponent]: {
            ...prev[currentComponent],
            validation,
          },
        }));
      }

      // Get AI response
      const response = await sendMessageToAPI(inputValue.trim());

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
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

  const handleNextStep = () => {
    const currentComponent = STEPS[currentStep]?.component;
    if (currentComponent) {
      setComponents((prev) => ({
        ...prev,
        [currentComponent]: {
          ...prev[currentComponent],
          isComplete: true,
        },
      }));
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setValidationResults(null);

      const nextComponent = STEPS[currentStep + 1]?.component;
      if (nextComponent) {
        const nextMessage: Message = {
          id: `next-${Date.now()}`,
          role: 'assistant',
          content: `Excellent! Now let's work on ${STEPS[currentStep + 1].label}. ${COMPONENT_DESCRIPTIONS[nextComponent]}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, nextMessage]);
      } else if (STEPS[currentStep + 1].key === 'review') {
        const reviewMessage: Message = {
          id: `review-${Date.now()}`,
          role: 'assistant',
          content: "Great work! You've completed all five S.C.O.P.E. components. Let's review your script together before finalizing.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, reviewMessage]);
      }
    } else {
      // Complete the session
      onComplete(components);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render helpers
  const renderProgressIndicator = () => (
    <div className="flex items-center justify-between mb-6 px-4">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-500'
                }
              `}
              aria-current={index === currentStep ? 'step' : undefined}
            >
              {index < currentStep ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                index
              )}
            </div>
            <span className={`
              text-xs mt-1 hidden sm:block
              ${index === currentStep ? 'text-blue-600 font-medium' : 'text-gray-500'}
            `}>
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={`
                flex-1 h-0.5 mx-2
                ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}
              `}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderValidationPanel = () => {
    if (!validationResults) return null;

    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Quality Check</h4>
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">Score:</span>
            <span className={`
              font-bold
              ${validationResults.score >= 4 ? 'text-green-600' :
                validationResults.score >= 3 ? 'text-yellow-600' : 'text-red-600'}
            `}>
              {validationResults.score}/5
            </span>
          </div>
        </div>

        {validationResults.feedback.length > 0 && (
          <div className="mb-3">
            {validationResults.feedback.map((item, i) => (
              <div key={i} className="flex items-start text-sm text-green-700 mb-1">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {validationResults.warnings.length > 0 && (
          <div className="mb-3">
            {validationResults.warnings.map((item, i) => (
              <div key={i} className="flex items-start text-sm text-yellow-700 mb-1">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {validationResults.suggestions.length > 0 && (
          <div>
            {validationResults.suggestions.map((item, i) => (
              <div key={i} className="flex items-start text-sm text-blue-700 mb-1">
                <Lightbulb className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderComponentSummary = () => {
    const completedComponents = Object.entries(components).filter(
      ([_, data]) => data.isComplete
    );

    if (completedComponents.length === 0) return null;

    return (
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h4 className="font-medium text-gray-900 mb-3">Completed Components</h4>
        <div className="space-y-2">
          {completedComponents.map(([key, data]) => (
            <div key={key} className="flex items-start">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center mr-2 flex-shrink-0
                ${data.validation?.isValid ? 'bg-green-100' : 'bg-yellow-100'}
              `}>
                <span className="text-xs font-bold">
                  {key}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">
                  {data.content.substring(0, 50)}
                  {data.content.length > 50 && '...'}
                </p>
              </div>
              {data.validation && (
                <span className="text-xs text-gray-500 ml-2">
                  {data.validation.score}/5
                </span>
              )}
            </div>
          ))}
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
              max-w-[80%] rounded-lg p-3
              ${message.role === 'user'
                ? 'bg-blue-500 text-white'
                : message.role === 'system'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-900'
              }
            `}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            <span className="text-xs opacity-70 mt-1 block">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-lg p-3">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Progress Indicator */}
      <div className="bg-gray-50 border-b p-4">
        {renderProgressIndicator()}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {STEPS[currentStep].label}
          </h3>
          {STEPS[currentStep].component && (
            <p className="text-sm text-gray-600 mt-1">
              {COMPONENT_DESCRIPTIONS[STEPS[currentStep].component as keyof ScopeComponents]}
            </p>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {renderMessages()}

          {/* Input Area */}
          <div className="border-t p-4">
            {renderValidationPanel()}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your response..."
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                  aria-label="Message input"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
                {validationResults?.isValid && (
                  <button
                    onClick={handleNextStep}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    aria-label="Next step"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-64 border-l bg-gray-50 p-4 overflow-y-auto hidden lg:block">
          {renderComponentSummary()}

          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-start">
              <Info className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Complete each component with sufficient detail to build a compelling script.
                The quality score helps you gauge the strength of your content.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScopeCoachSequential;
