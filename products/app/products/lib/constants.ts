export const SPACE_OPTIONS = ['Corner', 'Corridor', 'Entrance', 'Staircase', 'Living Room', 'Dining Room', 'Bedroom', 'Kitchen', 'Commercial', 'Bathroom'];
export const CATEGORY_OPTIONS = ['Chandeliers', 'Pendant', 'Cascade Light', 'Floor Lamps', 'Long Chandeliers', 'Ring Chandeliers', 'Wall Light', 'Table Lamps', 'Accessories', 'Sofa & Seating', 'Table', 'Wall Decoration'];
export const COLOR_OPTIONS = ['Transparent', 'Chrome', 'White', 'Black', 'Bronze', 'Blue', 'Gold', 'Pink'];
export const MATERIAL_OPTIONS = ['Stone', 'Fabric', 'Metal', 'Glass', 'Wood'];

export const getTagColorStyles = (color: string) => {
  const c = color.toLowerCase().trim();
  switch (c) {
    case 'transparent':
      return 'border-zinc-200 bg-zinc-50/50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60';
    case 'chrome':
      return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
    case 'white':
      return 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900';
    case 'black':
      return 'border-zinc-800 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-black dark:text-zinc-400';
    case 'bronze':
      return 'border-[#964B00]/20 bg-[#964B00]/10 text-[#964B00] dark:border-[#CD7F32]/20 dark:bg-[#CD7F32]/10 dark:text-[#CD7F32]';
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/20 dark:bg-blue-900/30 dark:text-blue-300';
    case 'gold':
      return 'border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-800/20 dark:bg-amber-900/30 dark:text-amber-300';
    case 'pink':
      return 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800/20 dark:bg-pink-900/30 dark:text-pink-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60';
  }
};

export const getTagMaterialStyles = (material: string) => {
  const m = material.toLowerCase().trim();
  switch (m) {
    case 'stone':
      return 'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300';
    case 'fabric':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/20 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'metal':
      return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'glass':
      return 'border-cyan-200/50 bg-cyan-50/50 text-cyan-700 dark:border-cyan-800/20 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'wood':
      return 'border-orange-200 bg-orange-50 text-orange-900/80 dark:border-orange-800/20 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-900/25 dark:text-amber-300';
  }
};
