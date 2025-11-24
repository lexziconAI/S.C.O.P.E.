import React from 'react';
import { SessionState, DIMENSION_LABELS, EvidenceItem, ContradictionAlert } from '../types';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, CheckCircle, Lightbulb, Activity, Target } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// --- Sub-components ---

// ...existing code...
const DimensionRow: React.FC<{ code: string; data: any }> = ({ code, data }) => {
  if (!data) return null;
  const rawScore = typeof data.score === 'number' ? data.score : 0;
  // Normalize score: If raw score is <= 5, assume 0-5 scale and convert to 0-100.
  // Otherwise assume it's already 0-100.
  const score = rawScore <= 5 ? (rawScore / 5) * 100 : rawScore;

  // DEBUG: Log the actual scores being displayed
  console.log(`[DimensionRow ${code}] rawScore=${rawScore}, normalized=${score}%`);

  const confidence = data.confidence || 'LOW';
  const trend = data.trend || 'stable';

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-slate-300" />;
  };

  const getConfidenceStyle = () => {
    if (confidence === 'HIGH') return 'bg-indigo-600';
    if (confidence === 'MEDIUM') return 'bg-indigo-400';
    return 'bg-indigo-200'; // LOW
  };

  // Define spectrum labels for each dimension
  const spectrums: Record<string, { left: string; right: string }> = {
    HL: { left: "Low Understanding", right: "High Understanding" },
    CM: { left: "Unaware", right: "Highly Familiar" },
    DI: { left: "Siloed", right: "Integrated" },
    DL: { left: "Tech Hesitant", right: "Tech Savvy" },
    PR: { left: "Reactive", right: "Proactive" }
  };

  const labels = spectrums[code] || { left: "Low", right: "High" };

  return (
    <div className="flex flex-col py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500">{code}</span>
          <span className="text-sm font-medium text-slate-700">{DIMENSION_LABELS[code]}</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] text-slate-400 uppercase">{confidence} Conf</span>
           {getTrendIcon()}
        </div>
      </div>
      
      {/* Spectrum Slider */}
      <div className="relative h-6 w-full flex items-center">
        {/* Track */}
        <div className="absolute w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="w-1/2 h-full border-r border-white/50 bg-gradient-to-r from-slate-200 to-slate-300"></div>
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-r from-slate-300 to-slate-200"></div>
        </div>
        
        {/* Center Marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 h-full transform -translate-x-1/2 z-0"></div>

        {/* Thumb */}
        <div 
            className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 transition-all duration-500 ${getConfidenceStyle()}`}
            style={{ left: `${score}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Spectrum Labels */}
      <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1 px-1">
        <span>{labels.left}</span>
        <span>{labels.right}</span>
      </div>
    </div>
  );
};
// ...existing code...

const EvidenceLog: React.FC<{ evidence: EvidenceItem[] }> = ({ evidence }) => {
  const sorted = [...evidence].reverse(); // Newest first

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
      {sorted.length === 0 && <p className="text-xs text-slate-400 italic">Listening for evidence...</p>}
      {sorted.map((item, i) => (
        <div key={i} className="flex gap-3 text-sm p-2 rounded bg-slate-50 border border-slate-100 animate-fade-in-down">
            <div className={`w-1 self-stretch rounded-full ${
                item.type === 'positive' ? 'bg-green-400' : 
                item.type === 'negative' ? 'bg-amber-400' : 'bg-blue-300'
            }`} />
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs text-slate-600">{item.dimension}</span>
                    <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                </div>
                <p className="text-slate-700 leading-tight">{item.summary}</p>
            </div>
        </div>
      ))}
    </div>
  );
};

const ContradictionPanel: React.FC<{ alerts: ContradictionAlert[] }> = ({ alerts }) => {
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm animate-fade-in-down">
          <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Contradiction Detected: {alert.dimension}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="p-2 bg-white rounded border border-amber-100 text-slate-600">
              <span className="block font-bold text-amber-600/70 mb-1">Earlier:</span>
              {alert.earlyStatement}
            </div>
            <div className="p-2 bg-white rounded border border-amber-100 text-slate-600">
               <span className="block font-bold text-amber-600/70 mb-1">Latest:</span>
              {alert.lateStatement}
            </div>
          </div>
          <p className="text-xs text-amber-800 italic">Resolution: {alert.resolution}</p>
        </div>
      ))}
    </div>
  );
};

const ScoreEvolutionChart: React.FC<{ history: SessionState['scoreHistory'] }> = ({ history }) => {
  // For single data point, duplicate it to create a visible baseline
  const displayHistory = history.length === 1
    ? [history[0], { ...history[0], time: history[0].time + 1 }]
    : history;

  const labels = displayHistory.map(h => {
    const mins = Math.floor(h.time / 60);
    const secs = h.time % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  // Helper to normalize history points (0-5 scale to 0-100%)
  // Handles undefined/null/NaN edge cases
  const normalize = (val: number): number => {
    if (val === undefined || val === null || typeof val !== 'number' || Number.isNaN(val)) {
      return 50; // Default to middle of range
    }
    const normalized = val <= 5 ? (val / 5) * 100 : val;
    return Math.max(0, Math.min(100, normalized)); // Clamp to 0-100
  };

  const data = {
    labels,
    datasets: [
      { label: 'Health Literacy (HL)', data: displayHistory.map(h => normalize(h.HL)), borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.4, pointRadius: 4, borderWidth: 2.5 },
      { label: 'Clinical Markers (CM)', data: displayHistory.map(h => normalize(h.CM)), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.4, pointRadius: 4, borderWidth: 2.5 },
      { label: 'Data Integration (DI)', data: displayHistory.map(h => normalize(h.DI)), borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.4, pointRadius: 4, borderWidth: 2.5 },
      { label: 'Digital Literacy (DL)', data: displayHistory.map(h => normalize(h.DL)), borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.4, pointRadius: 4, borderWidth: 2.5 },
      { label: 'Preventive Readiness (PR)', data: displayHistory.map(h => normalize(h.PR)), borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.4, pointRadius: 4, borderWidth: 2.5 },
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { 
        min: 0, 
        max: 100,
        title: { display: true, text: 'Score (0-100%)', font: { size: 11, weight: 'bold' } },
        ticks: { stepSize: 20 },
        grid: { color: '#e2e8f0' } 
      },
      x: { 
        title: { display: true, text: 'Session Time (mm:ss)', font: { size: 11, weight: 'bold' } },
        grid: { display: false }, 
        ticks: { maxTicksLimit: 8 } 
      }
    },
    plugins: {
      legend: { 
        position: 'bottom' as const, 
        labels: { 
          boxWidth: 12, 
          padding: 12,
          font: { size: 11 },
          usePointStyle: true
        } 
      },
      tooltip: { 
        mode: 'index', 
        intersect: false,
        callbacks: {
          title: (items) => `Time: ${items[0].label}`,
          label: (context) => {
            const label = context.dataset.label || '';
            const value = Math.round(context.parsed.y);
            return `${label}: ${value}%`;
          }
        }
      }
    },
    animation: { duration: 300 }
  };

  return (
    <div className="h-48 w-full mt-4" key={history.length}>
      <Line data={data} options={options} />
    </div>
  );
};

// --- Main Dashboard Component ---

export const LiveTracker: React.FC<{ state: SessionState }> = ({ state }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Main Analysis Area (Left 2 Columns) */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Top Row: Scores List (Full Width) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                Metabolic Health Readiness
              </h3>
              <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500 font-medium">
                 {state.conversationPhase}
              </span>
            </div>
            <div className="space-y-1">
                {['HL', 'CM', 'DI', 'DL', 'PR'].map(key => (
                    state.dimensions[key as keyof typeof state.dimensions] && 
                    <DimensionRow key={key} code={key} data={state.dimensions[key as keyof typeof state.dimensions]} />
                ))}
            </div>
        </div>

        {/* Bottom Row: Trajectory Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> Score Trajectory
            </h3>
            <ScoreEvolutionChart history={state.scoreHistory} />
        </div>
      </div>

      {/* Right Column: Evidence Log (Sticky) */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-full sticky top-6">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Inference Log
          </h3>
          <div className="flex-1 overflow-hidden">
             <EvidenceLog evidence={state.evidenceLog} />
          </div>
          {state.contradictions.length > 0 && (
             <div className="mt-4 pt-4 border-t border-slate-100">
                <ContradictionPanel alerts={state.contradictions} />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FinalReport: React.FC<{ state: SessionState }> = ({ state }) => {
  return (
    <div className="space-y-8 animate-fade-in-down">
       {/* Radar & Summary */}
       <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-indigo-600 p-6 text-white">
             <h2 className="text-2xl font-bold mb-2">Assessment Complete</h2>
             <p className="opacity-90">{state.summary || "Assessment analysis complete."}</p>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
             <div className="w-full space-y-2">
                <h4 className="font-bold text-slate-700 mb-4">Dimension Scores</h4>
                {['HL', 'CM', 'DI', 'DL', 'PR'].map(key => (
                    state.dimensions[key as keyof typeof state.dimensions] && 
                    <DimensionRow key={key} code={key} data={state.dimensions[key as keyof typeof state.dimensions]} />
                ))}
             </div>
             <div className="space-y-6">
                <div>
                   <h4 className="flex items-center gap-2 font-bold text-green-700 mb-2">
                      <CheckCircle className="w-5 h-5" /> Key Strengths
                   </h4>
                   <div className="flex flex-wrap gap-2">
                      {state.strengths.map(s => (
                         <span key={s} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                            {DIMENSION_LABELS[s]}
                         </span>
                      ))}
                      {state.strengths.length === 0 && <span className="text-slate-400 text-sm">No specific strengths highlighted.</span>}
                   </div>
                </div>

                <div>
                   <h4 className="flex items-center gap-2 font-bold text-amber-600 mb-2">
                      <Lightbulb className="w-5 h-5" /> Development Priorities
                   </h4>
                    <div className="flex flex-wrap gap-2">
                      {state.developmentPriorities.map(s => (
                         <span key={s} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">
                            {DIMENSION_LABELS[s]}
                         </span>
                      ))}
                      {state.developmentPriorities.length === 0 && <span className="text-slate-400 text-sm">No specific priorities highlighted.</span>}
                   </div>
                </div>
             </div>
          </div>
       </div>

       {/* Full Report Section */}
       {state.fullReport && (
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                Comprehensive Analysis
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {state.fullReport}
            </div>
         </div>
       )}

       {/* Detailed Evidence Review */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Session Evidence Log</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {state.evidenceLog.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                   <div className="flex justify-between mb-2">
                      <span className="font-bold text-indigo-600">{item.dimension}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                         item.type === 'positive' ? 'bg-green-100 text-green-700' : 
                         item.type === 'negative' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                         {item.type}
                      </span>
                   </div>
                   <p className="text-slate-600">{item.summary}</p>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};