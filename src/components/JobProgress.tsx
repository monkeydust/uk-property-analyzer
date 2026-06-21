'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, Zap, Search, Brain, BarChart3, GraduationCap, Train, Clock, FileText, MapPin } from 'lucide-react';

export interface JobProgressProps {
  status: string; // queued | scraping | enriching | analyzing | complete | error
  propertyData?: boolean;
  schoolsData?: boolean;
  marketData?: boolean;
  stationsData?: boolean;
  commuteData?: boolean;
  transactionsData?: boolean;
  plotSizeData?: boolean;
  aiAnalysis?: boolean;
  error?: string | null;
}

type StepState = 'pending' | 'active' | 'complete' | 'error';

interface StepDef {
  label: string;
  icon: React.ReactNode;
  state: StepState;
}

function getStepState(
  status: string,
  activeAt: string[],
  completeWhen: boolean | undefined,
  error?: string | null
): StepState {
  if (error && status === 'error') return 'error';
  if (completeWhen) return 'complete';
  if (activeAt.includes(status)) return 'active';
  return 'pending';
}

function StepNode({ step, isLast }: { step: StepDef; isLast: boolean }) {
  const colors: Record<StepState, string> = {
    pending: 'bg-slate-700 text-slate-500',
    active: 'bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/50',
    complete: 'bg-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/20 text-red-400',
  };

  const lineColors: Record<StepState, string> = {
    pending: 'bg-slate-700',
    active: 'bg-indigo-500/50',
    complete: 'bg-emerald-500/40',
    error: 'bg-red-500/40',
  };

  const iconSize = 'w-3.5 h-3.5';

  return (
    <div className="flex items-center gap-0 flex-1 min-w-0">
      <div className="flex flex-col items-center gap-1 min-w-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${colors[step.state]} ${
            step.state === 'active' ? 'animate-pulse' : ''
          }`}
        >
          {step.state === 'complete' ? (
            <Check className={iconSize} />
          ) : step.state === 'error' ? (
            <X className={iconSize} />
          ) : step.state === 'active' ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <span className={iconSize}>{step.icon}</span>
          )}
        </div>
        <span
          className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-300 ${
            step.state === 'complete'
              ? 'text-emerald-400'
              : step.state === 'active'
              ? 'text-indigo-300'
              : step.state === 'error'
              ? 'text-red-400'
              : 'text-slate-500'
          }`}
        >
          {step.label}
        </span>
      </div>
      {!isLast && (
        <div
          className={`h-0.5 flex-1 mx-1 rounded-full transition-all duration-700 ${
            lineColors[step.state === 'complete' ? 'complete' : 'pending']
          }`}
          style={{ minWidth: 12, marginTop: -14 }}
        />
      )}
    </div>
  );
}

function SubStep({ label, icon, done }: { label: string; icon: React.ReactNode; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 ${
          done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-500'
        }`}
      >
        {done ? <Check className="w-2.5 h-2.5" /> : <span className="w-2.5 h-2.5">{icon}</span>}
      </div>
      <span
        className={`text-[10px] transition-colors duration-300 ${
          done ? 'text-emerald-400/80' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function JobProgress(props: JobProgressProps) {
  const { status, propertyData, schoolsData, marketData, stationsData, commuteData, transactionsData, plotSizeData, aiAnalysis, error } = props;

  const [visible, setVisible] = useState(true);

  // Auto-hide after completion
  useEffect(() => {
    if (status === 'complete') {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status]);

  if (!visible || status === 'complete') return null;

  const enrichmentDone = !!(schoolsData && marketData && stationsData && commuteData && transactionsData);
  const enrichmentActive = status === 'enriching' || (!!propertyData && !enrichmentDone && status !== 'analyzing' && status !== 'complete');

  const mainSteps: StepDef[] = [
    {
      label: 'Scrape',
      icon: <Search className="w-3.5 h-3.5" />,
      state: getStepState(status, ['scraping', 'queued'], !!propertyData, error),
    },
    {
      label: 'Enrich',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      state: enrichmentDone
        ? 'complete'
        : enrichmentActive
        ? 'active'
        : error && status === 'error' && !!propertyData && !enrichmentDone
        ? 'error'
        : 'pending',
    },
    {
      label: 'AI Report',
      icon: <Brain className="w-3.5 h-3.5" />,
      state: getStepState(status, ['analyzing'], !!aiAnalysis, error),
    },
    {
      label: 'Done',
      icon: <Zap className="w-3.5 h-3.5" />,
      state: status === 'complete' ? 'complete' : status === 'error' ? 'error' : 'pending',
    },
  ];

  // Override scrape to active if queued/scraping
  if (status === 'queued' || status === 'scraping') {
    mainSteps[0].state = 'active';
  }

  const showSubSteps = enrichmentActive || (status === 'enriching');

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-3 mb-4 border border-slate-700/50 transition-all duration-500">
      {/* Main pipeline steps */}
      <div className="flex items-start justify-between gap-0">
        {mainSteps.map((step, i) => (
          <StepNode key={step.label} step={step} isLast={i === mainSteps.length - 1} />
        ))}
      </div>

      {/* Enrichment sub-steps */}
      {showSubSteps && (
        <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-slate-700/30 flex-wrap">
          <SubStep label="Schools" icon={<GraduationCap className="w-2.5 h-2.5" />} done={!!schoolsData} />
          <SubStep label="Market" icon={<BarChart3 className="w-2.5 h-2.5" />} done={!!marketData} />
          <SubStep label="Stations" icon={<Train className="w-2.5 h-2.5" />} done={!!stationsData} />
          <SubStep label="Commute" icon={<Clock className="w-2.5 h-2.5" />} done={!!commuteData} />
          <SubStep label="Sales" icon={<FileText className="w-2.5 h-2.5" />} done={!!transactionsData} />
          <SubStep label="Plot" icon={<MapPin className="w-2.5 h-2.5" />} done={!!plotSizeData} />
        </div>
      )}

      {/* Error message */}
      {error && status === 'error' && (
        <div className="mt-2 pt-2 border-t border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
