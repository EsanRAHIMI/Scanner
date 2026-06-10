'use client';

type WorkflowStepsProps = {
  steps: readonly string[];
  activeStep: number;
  /** Only this step shows the loading animation (auto-running steps). */
  loadingStep?: number | null;
};

function stepHint(idx: number, activeStep: number, loadingStep: number | null | undefined): string | null {
  if (idx < activeStep) return 'Done';
  if (idx === activeStep) {
    if (loadingStep === idx) return 'Running automatically';
    if (idx === 1) return 'Check images below';
    if (idx === 2) return 'Save when ready';
    return null;
  }
  if (idx === 1 && activeStep === 0) return 'Opens automatically';
  if (idx === 2) return 'After review';
  return 'Up next';
}

export function WorkflowSteps({ steps, activeStep, loadingStep = null }: WorkflowStepsProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {steps.map((label, idx) => {
        const isComplete = idx < activeStep;
        const isActive = idx === activeStep;
        const isPending = idx > activeStep;
        const isLoading = isActive && loadingStep === idx;
        const hint = stepHint(idx, activeStep, loadingStep);

        return (
          <li
            key={label}
            className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-xs transition-all duration-500 sm:text-sm ${
              isActive
                ? isLoading
                  ? 'border-brand-burgundy/50 bg-brand-burgundy/5 text-brand-burgundy shadow-[0_0_0_1px_rgba(80,15,40,0.08)]'
                  : 'border-brand-burgundy bg-brand-burgundy text-brand-white shadow-[0_8px_24px_-14px_rgba(80,15,40,0.55)]'
                : isComplete
                  ? 'border-brand-burgundy/25 bg-brand-white text-brand-burgundy'
                  : 'border-brand-medium-gray/15 bg-brand-light-gray/35 text-brand-medium-gray'
            }`}
          >
            {isLoading ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand-burgundy to-transparent processing-step-shimmer"
              />
            ) : null}
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  isComplete
                    ? 'bg-brand-burgundy text-brand-white'
                    : isActive
                      ? isLoading
                        ? 'border border-brand-burgundy/40 bg-brand-white text-brand-burgundy'
                        : 'bg-brand-white/15 text-brand-white'
                      : 'border border-brand-medium-gray/25 bg-brand-white text-brand-medium-gray'
                }`}
              >
                {isComplete ? (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.5 6l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isPending ? (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3.25" y="5" width="5.5" height="4" rx="0.75" />
                    <path d="M4.5 5V4a1.5 1.5 0 013 0v1" strokeLinecap="round" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{label}</span>
                  {isLoading ? (
                    <span className="ml-auto flex items-center gap-1">
                      <span className="processing-dot h-1.5 w-1.5 rounded-full bg-brand-burgundy" />
                      <span className="processing-dot processing-dot-delay-1 h-1.5 w-1.5 rounded-full bg-brand-burgundy/70" />
                      <span className="processing-dot processing-dot-delay-2 h-1.5 w-1.5 rounded-full bg-brand-burgundy/40" />
                    </span>
                  ) : null}
                </div>
                {hint ? (
                  <p
                    className={`mt-0.5 text-[10px] leading-snug sm:text-[11px] ${
                      isActive && !isLoading ? 'text-brand-white/80' : 'text-brand-medium-gray'
                    }`}
                  >
                    {hint}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
