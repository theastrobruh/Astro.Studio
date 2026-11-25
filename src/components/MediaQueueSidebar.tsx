import React, { useRef } from 'react';
import { Camera, ImagePlus, Plus, Sparkles } from 'lucide-react';
import { EmbeddedEditRecipe, ParsedExifInfo, SamplePhoto } from '../types/editor';
import { ExifInspector } from './ExifInspector';

export interface QueuePhotoItem {
  id: string;
  label: string;
  src: string;
  aspectLabel?: string;
  isUploaded?: boolean;
}

interface MediaQueueSidebarProps {
  uploadedItem: QueuePhotoItem | null;
  samples: SamplePhoto[];
  activePhotoSrc: string;
  onSelectPhoto: (item: { id: string; src: string; isUploaded: boolean }) => void;
  onUploadFile: (file: File) => void;
  exif: ParsedExifInfo | null;
  isParsingExif: boolean;
  dimensions: { width: number; height: number } | null;
  onLoadRecipe: (recipe: EmbeddedEditRecipe) => void;
  onOpenMobileExif: () => void;
  onOpenWelcomeGuide: () => void;
}

export const MediaQueueSidebar: React.FC<MediaQueueSidebarProps> = ({
  uploadedItem,
  samples,
  activePhotoSrc,
  onSelectPhoto,
  onUploadFile,
  exif,
  isParsingExif,
  dimensions,
  onLoadRecipe,
  onOpenMobileExif,
  onOpenWelcomeGuide,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allItems: QueuePhotoItem[] = [
    ...(uploadedItem ? [uploadedItem] : []),
    ...samples.map((s) => ({
      id: s.id,
      label: s.label,
      src: s.src,
      aspectLabel: s.aspectLabel,
      isUploaded: false,
    })),
  ];

  const hasRecipe = Boolean(exif?.recipe);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadFile(f);
          e.target.value = '';
        }}
      />

      {/* MOBILE & TABLET (< lg): Sleek Horizontal Filmstrip matching Pressmark */}
      <div className="lg:hidden shrink-0 border-b border-white/[0.08] bg-[#12151B] px-3 py-2 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload photo"
          className="w-12 h-12 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 text-blue-300 flex flex-col items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] font-semibold mt-0.5">Add</span>
        </button>

        <button
          type="button"
          onClick={onOpenMobileExif}
          className={`h-12 px-3 rounded-xl border flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform ${
            hasRecipe
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-200'
          }`}
        >
          {hasRecipe ? (
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Camera className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span className="text-[11px] font-medium whitespace-nowrap">
            {hasRecipe ? 'Edit Found' : 'EXIF'}
          </span>
        </button>

        <div className="h-8 w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-2 shrink-0">
          {allItems.map((item) => {
            const isSelected = item.src === activePhotoSrc;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onSelectPhoto({
                    id: item.id,
                    src: item.src,
                    isUploaded: Boolean(item.isUploaded),
                  })
                }
                aria-label={`Select ${item.label}`}
                className={`w-12 h-12 rounded-xl overflow-hidden bg-[#0B0D10] block cursor-pointer transition-all shrink-0 ${
                  isSelected
                    ? 'ring-2 ring-blue-500 scale-[1.03]'
                    : 'ring-1 ring-white/[0.1] opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={item.src}
                  alt={item.label}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP (lg+): Fixed Left Queue + EXIF Sidebar matching Pressmark */}
      <aside className="hidden lg:flex w-[268px] shrink-0 bg-[#11141B] border-r border-white/[0.08] flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-white tracking-tight">Photos</h2>
            <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
              {allItems.length} ready
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/35 text-xs font-medium text-blue-300 transition-colors cursor-pointer"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Upload
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 studio-scroll">
          {allItems.map((item) => {
            const isSelected = item.src === activePhotoSrc;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onSelectPhoto({
                    id: item.id,
                    src: item.src,
                    isUploaded: Boolean(item.isUploaded),
                  })
                }
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600/12 border-blue-500/50 text-white'
                    : 'bg-[#0C0F15] border-white/[0.06] hover:border-white/[0.14] text-slate-300'
                }`}
              >
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                  <img
                    src={item.src}
                    alt={item.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{item.label}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {item.isUploaded ? 'Uploaded Photo' : `Studio Sample · ${item.aspectLabel}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Docked Photo Info & Edit History + Guide link */}
        <div className="border-t border-white/[0.08] bg-[#0D1016] shrink-0">
          <ExifInspector
            exif={exif}
            isLoading={isParsingExif}
            dimensions={dimensions}
            onLoadRecipe={onLoadRecipe}
            compact={true}
          />
          <div className="px-3.5 py-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
            <span>Client-side · Zero upload</span>
            <button
              type="button"
              onClick={onOpenWelcomeGuide}
              className="text-slate-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              Guide
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
