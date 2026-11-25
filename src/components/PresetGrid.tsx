import React, { useMemo, useState } from 'react';
import { Bookmark, Check, RotateCcw, Search, Star, Trash2 } from 'lucide-react';
import { FilterPreset, PresetCategory } from '../types/editor';
import { PRESET_CATEGORIES } from '../data/presets';

interface PresetGridProps {
  presets: FilterPreset[];
  customPresets: FilterPreset[];
  activePresetId: string;
  favorites: string[];
  thumbnails: Record<string, string>;
  onSelectPreset: (preset: FilterPreset) => void;
  onResetToOriginal?: () => void;
  onToggleFavorite: (id: string) => void;
  onSaveCustomPreset: (name: string) => void;
  onDeleteCustomPreset: (id: string) => void;
}

export const PresetGrid: React.FC<PresetGridProps> = ({
  presets,
  customPresets,
  activePresetId,
  favorites,
  thumbnails,
  onSelectPreset,
  onResetToOriginal,
  onToggleFavorite,
  onSaveCustomPreset,
  onDeleteCustomPreset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | 'Favorites' | 'Custom'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const allPresets = useMemo(() => [...customPresets, ...presets], [customPresets, presets]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPresets.filter((p) => {
      const matchesCat =
        selectedCategory === 'All'
          ? true
          : selectedCategory === 'Favorites'
          ? favorites.includes(p.id)
          : selectedCategory === 'Custom'
          ? customPresets.some((cp) => cp.id === p.id)
          : p.category === selectedCategory;

      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [allPresets, customPresets, favorites, searchQuery, selectedCategory]);

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    onSaveCustomPreset(trimmed);
    setNewPresetName('');
    setIsSaving(false);
    setSelectedCategory('Custom');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search + Original + Save Row */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${allPresets.length} effects...`}
            className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-[#090B0E] border border-white/[0.1] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        {onResetToOriginal && (
          <button
            type="button"
            onClick={onResetToOriginal}
            title="Reset to Original Photo"
            className="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsSaving((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Bookmark className="w-3.5 h-3.5 text-blue-400" />
          <span>Save</span>
        </button>
      </div>

      {isSaving && (
        <form
          onSubmit={handleSaveSubmit}
          className="flex items-center gap-1.5 p-2 rounded-xl bg-[#0D1119] border border-blue-500/35"
        >
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name..."
            autoFocus
            className="flex-1 h-8 px-2.5 rounded-lg bg-[#090B0E] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsSaving(false)}
            className="px-2 h-8 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
        {[
          ...PRESET_CATEGORIES,
          'Favorites' as const,
          ...(customPresets.length > 0 ? ['Custom' as const] : []),
        ].map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#090B0E] text-slate-400 hover:text-slate-100 border border-white/[0.08]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Effect Cards Grid */}
      {filteredPresets.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-xl border border-white/[0.08] bg-[#090B0E]">
          <p className="text-xs font-medium text-slate-300">No effects match your filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
          {filteredPresets.map((preset) => {
            const isActive = preset.id === activePresetId;
            const isFav = favorites.includes(preset.id);
            const isCustom = customPresets.some((cp) => cp.id === preset.id);
            const thumbUrl = thumbnails[preset.id];

            return (
              <div
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPreset(preset);
                  }
                }}
                className={`group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-600/12 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]'
                    : 'bg-[#0C0F15] border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="relative aspect-[4/3] w-full bg-[#080A0D] overflow-hidden">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={preset.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
                  )}

                  {isActive && (
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}

                  <div className="absolute top-1 right-1 flex items-center gap-1">
                    {isCustom && (
                      <button
                        type="button"
                        aria-label={`Delete ${preset.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomPreset(preset.id);
                        }}
                        className="w-6 h-6 rounded-md bg-black/75 hover:bg-red-500/80 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={
                        isFav ? `Remove ${preset.name} from favorites` : `Favorite ${preset.name}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(preset.id);
                      }}
                      className={`w-6 h-6 rounded-md bg-black/75 flex items-center justify-center transition-colors cursor-pointer ${
                        isFav ? 'text-amber-400' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="p-2">
                  <p
                    className={`text-[11.5px] font-semibold truncate ${
                      isActive ? 'text-blue-300' : 'text-slate-100'
                    }`}
                  >
                    {preset.name}
                  </p>
                  <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{preset.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
