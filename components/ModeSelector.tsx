import React from 'react';
import { ListChecks, MessageSquare, Check } from 'lucide-react';

export type CoachMode = 'sequential' | 'natural';

interface ModeSelectorProps {
  selectedMode: CoachMode | null;
  onModeSelect: (mode: CoachMode) => void;
  disabled?: boolean;
}

interface ModeCardProps {
  mode: CoachMode;
  title: string;
  description: string;
  benefits: string[];
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

const ModeCard: React.FC<ModeCardProps> = ({
  mode,
  title,
  description,
  benefits,
  icon,
  isSelected,
  onSelect,
  disabled = false,
}) => {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`Select ${title} mode`}
      className={`
        relative w-full p-6 rounded-xl border-2 text-left transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}
        ${isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-4 right-4">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Icon */}
      <div className={`
        w-12 h-12 rounded-lg flex items-center justify-center mb-4
        ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}
      `}>
        {icon}
      </div>

      {/* Title */}
      <h3 className={`
        text-xl font-semibold mb-2
        ${isSelected ? 'text-blue-900' : 'text-gray-900'}
      `}>
        {title}
      </h3>

      {/* Description */}
      <p className={`
        text-sm mb-4
        ${isSelected ? 'text-blue-700' : 'text-gray-600'}
      `}>
        {description}
      </p>

      {/* Benefits */}
      <ul className="space-y-2">
        {benefits.map((benefit, index) => (
          <li
            key={index}
            className={`
              flex items-start text-sm
              ${isSelected ? 'text-blue-700' : 'text-gray-600'}
            `}
          >
            <Check className={`
              w-4 h-4 mr-2 mt-0.5 flex-shrink-0
              ${isSelected ? 'text-blue-500' : 'text-green-500'}
            `} />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </button>
  );
};

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onModeSelect,
  disabled = false,
}) => {
  const modes = {
    sequential: {
      title: 'Sequential Mode',
      description: 'Structured step-by-step coaching through each S.C.O.P.E. component with clear progress tracking.',
      benefits: [
        'Clear progress through each component',
        'Immediate validation and feedback',
        'Best for learning the framework',
      ],
      icon: <ListChecks className="w-6 h-6" />,
    },
    natural: {
      title: 'Natural Mode',
      description: 'Free-flowing conversation that naturally extracts S.C.O.P.E. components without rigid structure.',
      benefits: [
        'More natural conversation flow',
        'Flexible exploration of ideas',
        'Best for experienced users',
      ],
      icon: <MessageSquare className="w-6 h-6" />,
    },
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Your Coaching Style
        </h2>
        <p className="text-gray-600">
          Select how you'd like to develop your S.C.O.P.E. script
        </p>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        role="group"
        aria-label="Coaching mode selection"
      >
        <ModeCard
          mode="sequential"
          {...modes.sequential}
          isSelected={selectedMode === 'sequential'}
          onSelect={() => onModeSelect('sequential')}
          disabled={disabled}
        />
        <ModeCard
          mode="natural"
          {...modes.natural}
          isSelected={selectedMode === 'natural'}
          onSelect={() => onModeSelect('natural')}
          disabled={disabled}
        />
      </div>

      {selectedMode && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            You can switch modes at any time during the session
          </p>
        </div>
      )}
    </div>
  );
};

export default ModeSelector;
