/**
 * Quantum Story Dashboard
 * Visualizes living narrative streams using David Boje's framework
 * PARADIGM SHIFT: From static dimension bars to dynamic story flows
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waves, 
  Sparkles, 
  GitBranch, 
  Clock, 
  Users, 
  Heart,
  Shield,
  Eye,
  Compass,
  Zap
} from 'lucide-react';
import type { 
  NarrativeStream, 
  AntenarativeFragment, 
  QuantumState,
  QuantumStorySession 
} from '../src/types/narrative-streams';

// =============================================================================
// QUANTUM STATE VISUALIZATION: Multiple Simultaneous Truths
// =============================================================================

const QuantumStateBubbles: React.FC<{ states: QuantumState[] }> = ({ states }) => {
  return (
    <div className="flex flex-wrap gap-2 my-3">
      {states.map((state, idx) => (
        <motion.div
          key={state.state}
          className="relative inline-block"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 0.4 + (state.probability * 0.6),
          }}
          transition={{ 
            delay: idx * 0.1,
            repeat: Infinity,
            repeatType: "reverse",
            duration: 2 + (state.probability * 2)
          }}
        >
          <div 
            className="px-4 py-2 rounded-full border-2 border-indigo-300 bg-indigo-50"
            style={{
              width: `${80 + (state.probability * 120)}px`,
              boxShadow: `0 0 ${10 + state.probability * 20}px rgba(99, 102, 241, ${state.probability * 0.4})`
            }}
          >
            <div className="text-xs font-semibold text-indigo-700 text-center">
              {state.state}
            </div>
            <div className="text-[10px] text-indigo-500 text-center font-medium">
              {(state.probability * 100).toFixed(0)}%
            </div>
          </div>
          
          {/* Entanglement Lines (if conflicting states) */}
          {state.conflictsWith && state.conflictsWith.length > 0 && (
            <motion.div 
              className="absolute top-1/2 right-0 w-8 h-0.5 bg-red-300"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};

// =============================================================================
// ANTENARRATIVE FRAGMENT CARD: Story Bits
// =============================================================================

const FragmentCard: React.FC<{ fragment: AntenarativeFragment; index: number }> = ({ fragment, index }) => {
  const typeColors = {
    memory: 'bg-blue-50 border-blue-200 text-blue-700',
    speculation: 'bg-purple-50 border-purple-200 text-purple-700',
    contradiction: 'bg-orange-50 border-orange-200 text-orange-700',
    desire: 'bg-green-50 border-green-200 text-green-700',
    fear: 'bg-red-50 border-red-200 text-red-700',
    bet: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    turning_point: 'bg-pink-50 border-pink-200 text-pink-700'
  };

  const yamaIcons = {
    Ahimsa: Heart,
    Satya: Eye,
    Asteya: Shield,
    Brahmacharya: Compass,
    Aparigraha: Zap
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`p-3 rounded-lg border-2 mb-3 ${typeColors[fragment.type]}`}
    >
      {/* Fragment Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide">
          {fragment.type}
        </span>
        <span className="text-[10px] text-slate-400">
          Turn {fragment.turn}
        </span>
      </div>

      {/* User's Exact Words */}
      <blockquote className="text-sm italic mb-2 border-l-2 border-current pl-2">
        "{fragment.text}"
      </blockquote>

      {/* Interpreted Meaning */}
      {fragment.interpretedMeaning && (
        <p className="text-xs text-slate-600 mb-2">
          → {fragment.interpretedMeaning}
        </p>
      )}

      {/* Tensions (Unresolved Conflicts) */}
      {fragment.tensions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {fragment.tensions.map((tension, idx) => (
            <span 
              key={idx} 
              className="text-[10px] px-2 py-0.5 bg-white/50 rounded border border-current"
            >
              ⚡ {tension}
            </span>
          ))}
        </div>
      )}

      {/* Possible Endings */}
      {fragment.possibleEndings.length > 0 && (
        <div className="mt-2 pt-2 border-t border-current/20">
          <div className="text-[10px] font-semibold mb-1">Possible futures:</div>
          <div className="space-y-0.5">
            {fragment.possibleEndings.slice(0, 3).map((ending, idx) => (
              <div key={idx} className="text-xs text-slate-600 flex items-start">
                <GitBranch className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                <span>{ending}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yama Resonance */}
      {fragment.yamaAlignment && fragment.yamaAlignment.length > 0 && (
        <div className="mt-2 pt-2 border-t border-current/20">
          {fragment.yamaAlignment.map((yama, idx) => {
            const Icon = yamaIcons[yama.principle];
            const resonanceColor = {
              harmony: 'text-green-600',
              tension: 'text-red-600',
              exploration: 'text-blue-600'
            }[yama.resonance];

            return (
              <div key={idx} className="flex items-start gap-1 text-xs">
                <Icon className={`w-3 h-3 ${resonanceColor} flex-shrink-0 mt-0.5`} />
                <span className="text-[10px]">
                  <strong>{yama.principle}</strong> ({yama.resonance}): {yama.insight}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// TEMPORAL ENTANGLEMENT VISUAL: Past-Present-Future Collapse
// =============================================================================

const TemporalLayersViz: React.FC<{ stream: NarrativeStream }> = ({ stream }) => {
  const { pastStories, presentMoments, futureProjections } = stream.temporalLayers;

  return (
    <div className="grid grid-cols-3 gap-2 my-3">
      {/* PAST */}
      <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
        <div className="flex items-center gap-1 mb-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">Past</span>
        </div>
        {pastStories.slice(0, 2).map((past, idx) => (
          <div key={idx} className="text-xs text-slate-600 mb-1">
            {past.story}
          </div>
        ))}
      </div>

      {/* PRESENT */}
      <div className="bg-indigo-100 p-2 rounded-lg border border-indigo-200">
        <div className="flex items-center gap-1 mb-1">
          <Sparkles className="w-3 h-3 text-indigo-600" />
          <span className="text-[10px] font-bold text-indigo-700 uppercase">Present</span>
        </div>
        {presentMoments.slice(0, 2).map((present, idx) => (
          <div key={idx} className="text-xs text-indigo-700 mb-1 font-medium">
            {present.moment}
          </div>
        ))}
      </div>

      {/* FUTURE */}
      <div className="bg-purple-100 p-2 rounded-lg border border-purple-200">
        <div className="flex items-center gap-1 mb-1">
          <Waves className="w-3 h-3 text-purple-600" />
          <span className="text-[10px] font-bold text-purple-700 uppercase">Future</span>
        </div>
        {futureProjections.slice(0, 2).map((future, idx) => (
          <div key={idx} className="text-xs text-purple-700 mb-1 italic">
            {future.projection}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// GRAND NARRATIVE INDICATORS: Cultural/Medical Discourses
// =============================================================================

const GrandNarrativeBadges: React.FC<{ grandNarratives: NarrativeStream['grandNarratives'] }> = ({ grandNarratives }) => {
  const stanceColors = {
    accepting: 'bg-green-100 text-green-700 border-green-300',
    resisting: 'bg-red-100 text-red-700 border-red-300',
    negotiating: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    transforming: 'bg-purple-100 text-purple-700 border-purple-300'
  };

  return (
    <div className="flex flex-wrap gap-2 my-2">
      {grandNarratives.map((gn, idx) => (
        <div 
          key={idx}
          className={`px-2 py-1 rounded text-xs border ${stanceColors[gn.userStance]}`}
        >
          <div className="font-semibold">{gn.discourse}</div>
          <div className="text-[10px]">
            {gn.influence} • {gn.userStance}
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// STORY QUALITY BARS: Coherence, Fluidity, Authenticity
// =============================================================================

const StoryQualityMeters: React.FC<{ stream: NarrativeStream }> = ({ stream }) => {
  const qualities = [
    { 
      name: 'Coherence', 
      value: stream.coherence, 
      color: 'bg-blue-500',
      description: 'How well fragments connect'
    },
    { 
      name: 'Fluidity', 
      value: stream.fluidity, 
      color: 'bg-purple-500',
      description: 'How much still becoming'
    },
    { 
      name: 'Authenticity', 
      value: stream.authenticity, 
      color: 'bg-green-500',
      description: 'Alignment with lived reality'
    }
  ];

  return (
    <div className="space-y-2 my-3">
      {qualities.map((q) => (
        <div key={q.name}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700">{q.name}</span>
            <span className="text-slate-500">{(q.value * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full ${q.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${q.value * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{q.description}</div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// NARRATIVE STREAM PANEL: Complete Stream Visualization
// =============================================================================

const NarrativeStreamPanel: React.FC<{ stream: NarrativeStream; isExpanded: boolean; onToggle: () => void }> = ({ 
  stream, 
  isExpanded,
  onToggle 
}) => {
  const streamIcons = {
    BODY_KNOWLEDGE: Users,
    BIOMARKER_MYTHOLOGY: Heart,
    DATA_SYNTHESIS: GitBranch,
    TECHNOLOGY_RELATIONSHIP: Zap,
    FUTURE_HEALTH_IMAGINARY: Waves
  };

  const Icon = streamIcons[stream.streamId];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
      {/* Stream Header (Always Visible) */}
      <div 
        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{stream.streamName}</h3>
              <p className="text-xs text-slate-500">
                {stream.fragments.length} fragments • {stream.possibleStates.length} quantum states
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>

        {/* Quantum States Preview (Always Visible) */}
        <QuantumStateBubbles states={stream.possibleStates.slice(0, 3)} />
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-slate-100"
          >
            <div className="p-4 space-y-4">
              {/* Story Quality Meters */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Living Story Qualities</h4>
                <StoryQualityMeters stream={stream} />
              </div>

              {/* Temporal Entanglement */}
              {(stream.temporalLayers.pastStories.length > 0 || 
                stream.temporalLayers.presentMoments.length > 0 || 
                stream.temporalLayers.futureProjections.length > 0) && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Temporal Entanglement</h4>
                  <TemporalLayersViz stream={stream} />
                </div>
              )}

              {/* Grand Narratives */}
              {stream.grandNarratives.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Grand Narratives at Play</h4>
                  <GrandNarrativeBadges grandNarratives={stream.grandNarratives} />
                </div>
              )}

              {/* Recent Fragments */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Story Fragments</h4>
                <div className="max-h-96 overflow-y-auto">
                  {stream.fragments.slice(-5).reverse().map((frag, idx) => (
                    <FragmentCard key={frag.id} fragment={frag} index={idx} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// MAIN QUANTUM STORY DASHBOARD
// =============================================================================

export const QuantumStoryDashboard: React.FC<{ session: QuantumStorySession }> = ({ session }) => {
  const [expandedStreams, setExpandedStreams] = React.useState<Set<string>>(
    new Set(['BODY_KNOWLEDGE']) // Start with first stream expanded
  );

  const toggleStream = (streamId: string) => {
    setExpandedStreams(prev => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  const phaseColors = {
    INVOCATION: 'bg-purple-100 text-purple-700',
    EMERGENCE: 'bg-blue-100 text-blue-700',
    ENTANGLEMENT: 'bg-green-100 text-green-700',
    CRYSTALLIZATION: 'bg-yellow-100 text-yellow-700',
    OPENING: 'bg-pink-100 text-pink-700'
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Session Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-xl mb-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Living Health Story</h1>
        <p className="text-indigo-100 text-sm mb-3">
          Your metabolic health narrative is emerging, contradicting, and becoming...
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className={`px-3 py-1 rounded-full ${phaseColors[session.phase]} font-semibold`}>
            {session.phase}
          </span>
          <span>Turn {session.turnCount}</span>
          <span>•</span>
          <span>{session.allFragments.length} story fragments</span>
        </div>
      </div>

      {/* Overall Narrative Qualities */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-2xl font-bold text-indigo-600 mb-1">
            {(session.overallCoherence * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-slate-600">Story Coherence</div>
          <div className="text-[10px] text-slate-500 mt-1">Fragments connecting</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {session.narrativeComplexity.toFixed(1)}
          </div>
          <div className="text-xs text-slate-600">Narrative Complexity</div>
          <div className="text-[10px] text-slate-500 mt-1">Entangled threads</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {(session.storyVitality * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-slate-600">Story Vitality</div>
          <div className="text-[10px] text-slate-500 mt-1">Generative potential</div>
        </div>
      </div>

      {/* Narrative Streams */}
      <div>
        {Object.values(session.narrativeStreams).map((stream) => (
          <NarrativeStreamPanel
            key={stream.streamId}
            stream={stream}
            isExpanded={expandedStreams.has(stream.streamId)}
            onToggle={() => toggleStream(stream.streamId)}
          />
        ))}
      </div>

      {/* Yama Constitutional Balance */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 mt-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Constitutional AI Balance</h3>
        <div className="grid grid-cols-5 gap-3">
          {session.yamaBalance.map((yama) => {
            const total = yama.harmonyCount + yama.tensionCount + yama.explorationCount;
            return (
              <div key={yama.principle} className="text-center">
                <div className="text-sm font-semibold mb-1">{yama.principle}</div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">Harmony</span>
                    <span>{yama.harmonyCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">Tension</span>
                    <span>{yama.tensionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600">Exploration</span>
                    <span>{yama.explorationCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuantumStoryDashboard;
