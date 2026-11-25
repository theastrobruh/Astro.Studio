import React, { useEffect, useState } from 'react';
import {
  Aperture,
  ArrowRight,
  Camera,
  Layers,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SAMPLE_PHOTOS } from '../data/samples';

const SKIP_WELCOME_KEY = 'astro_studio_skip_welcome_v1';

interface StudioIntroGateProps {
  forceOpen?: boolean;
  onCloseForce?: () => void;
  onReady?: () => void;
}

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: '50+ Film & Monochrome Looks',
    detail: 'Analog, monochrome, moody, portrait, and disposable looks starting at 77% balance.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Light, Curves & Sharpen',
    detail: 'Adjust brightness, contrast, colors, clarity, sharpness, and RGB curves.',
  },
  {
    icon: Camera,
    title: 'EXIF & Edit Memory',
    detail: 'Inspect camera lens settings and reload edits from any Astro.Studio export.',
  },
  {
    icon: Layers,
    title: 'Watermarks, Sizes & Batch ZIP',
    detail: 'Sign with text, badges, or logos, resize for social media, and export ZIPs.',
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export const StudioIntroGate: React.FC<StudioIntroGateProps> = ({
  forceOpen = false,
  onCloseForce,
  onReady,
}) => {
  const [phase, setPhase] = useState<'loading' | 'welcome' | 'done'>('loading');
  const [progress, setProgress] = useState(18);
  const [statusLabel, setStatusLabel] = useState('Preparing studio...');
  const [skipNextTime, setSkipNextTime] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SKIP_WELCOME_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStudioResources() {
      const startedAt = performance.now();
      setProgress(32);
      setStatusLabel('Loading fonts & studio tools...');

      if ('fonts' in document) {
        await Promise.race([document.fonts.ready, sleep(450)]);
      }
      if (cancelled) return;

      setStatusLabel('Getting sample photos ready...');
      setProgress(62);

      const total = Math.max(1, SAMPLE_PHOTOS.length);
      let loaded = 0;
      await Promise.all(
        SAMPLE_PHOTOS.map((s) =>
          preloadImage(s.src).then(() => {
            if (cancelled) return;
            loaded += 1;
            setProgress(62 + Math.round((loaded / total) * 34));
          })
        )
      );
      if (cancelled) return;

      setStatusLabel('Ready');
      setProgress(100);

      const elapsed = performance.now() - startedAt;
      if (elapsed < 480) {
        await sleep(480 - elapsed);
      }
      if (cancelled) return;

      let shouldSkip = false;
      try {
        shouldSkip = localStorage.getItem(SKIP_WELCOME_KEY) === 'true';
      } catch {
        shouldSkip = false;
      }

      if (shouldSkip) {
        setPhase('done');
        onReady?.();
      } else {
        setPhase('welcome');
      }
    }

    void loadStudioResources();
    return () => {
      cancelled = true;
    };
  }, [onReady]);

  const handleEnterStudio = () => {
    try {
      if (skipNextTime) {
        localStorage.setItem(SKIP_WELCOME_KEY, 'true');
      } else {
        localStorage.removeItem(SKIP_WELCOME_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
    setPhase('done');
    onCloseForce?.();
    onReady?.();
  };

  const isVisible = phase !== 'done' || forceOpen;
  const activeView = forceOpen && phase === 'done' ? 'welcome' : phase;

  useEffect(() => {
    if (!isVisible || activeView !== 'welcome') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleEnterStudio();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="astro-intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#090B0E]/95 backdrop-blur-md p-4 overflow-y-auto"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 38%, rgba(37,99,235,0.14), transparent 58%)',
          }}
        >
          <AnimatePresence mode="wait">
            {activeView === 'loading' ? (
              <motion.div
                key="intro-loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-xs flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#111927] border border-blue-500/35 flex items-center justify-center mb-4 shadow-lg">
                  <Aperture className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">
                  Astro<span className="font-normal text-blue-400">.Studio</span>
                </span>
                <p className="text-xs text-slate-400 mt-1.5">
                  by: theAstroBruh
                </p>

                <div className="w-full mt-6 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 truncate">{statusLabel}</span>
                    <span className="text-blue-400 tabular-nums shrink-0">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-[width] duration-200 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.section
                key="intro-welcome"
                aria-labelledby="welcome-heading"
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[560px] rounded-2xl bg-[#11141B] border border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.75)] overflow-hidden my-auto"
              >
                <div className="px-5 sm:px-7 pt-6 pb-5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-[#111927] border border-blue-500/35 flex items-center justify-center text-blue-400">
                      <Aperture className="w-4 h-4" />
                    </span>
                    <span className="text-base font-bold tracking-tight text-white">
                      Astro<span className="font-normal text-blue-400">.Studio</span>
                    </span>
                  </div>
                  <h1
                    id="welcome-heading"
                    className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-3.5 text-balance"
                  >
                    Edit your photos fast — right in your browser.
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Private, client-side color studio with zero uploads and unlimited exports.
                  </p>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CAPABILITIES.map(({ icon: Icon, title, detail }) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
                        <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-5 sm:px-7 py-4 bg-[#0D1016] border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none min-h-[40px]">
                    <input
                      type="checkbox"
                      checked={skipNextTime}
                      onChange={(e) => setSkipNextTime(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-[#161A22] accent-blue-500 cursor-pointer"
                    />
                    <span>Don&apos;t show this again</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleEnterStudio}
                    autoFocus
                    className="min-h-[44px] px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 shrink-0"
                  >
                    <span>Start Editing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
