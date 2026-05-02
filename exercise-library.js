/**
 * Exercise Library — static curated list of common gym exercises.
 * Watch button opens a YouTube search for the exercise form tutorial.
 */

export const EXERCISE_LIBRARY = [
  // Push
  { id: 'bench-press',      name: 'Bench Press',          muscles: ['chest','triceps','shoulders'], category: 'push' },
  { id: 'incline-bench',    name: 'Incline Bench Press',   muscles: ['chest','triceps'],             category: 'push' },
  { id: 'decline-bench',    name: 'Decline Bench Press',   muscles: ['chest','triceps'],             category: 'push' },
  { id: 'ohp',              name: 'Overhead Press',        muscles: ['shoulders','triceps'],         category: 'push' },
  { id: 'db-shoulder',      name: 'DB Shoulder Press',     muscles: ['shoulders','triceps'],         category: 'push' },
  { id: 'lateral-raise',    name: 'Lateral Raise',         muscles: ['shoulders'],                  category: 'push' },
  { id: 'front-raise',      name: 'Front Raise',           muscles: ['shoulders'],                  category: 'push' },
  { id: 'tricep-pushdown',  name: 'Tricep Pushdown',        muscles: ['triceps'],                    category: 'push' },
  { id: 'skull-crusher',    name: 'Skull Crusher',          muscles: ['triceps'],                    category: 'push' },
  { id: 'dips',             name: 'Tricep Dips',            muscles: ['triceps','chest'],            category: 'push' },
  { id: 'push-up',          name: 'Push Up',                muscles: ['chest','triceps'],            category: 'push' },
  { id: 'cable-fly',        name: 'Cable Fly',              muscles: ['chest'],                      category: 'push' },
  { id: 'pec-deck',         name: 'Pec Deck / Machine Fly', muscles: ['chest'],                      category: 'push' },

  // Pull
  { id: 'pull-up',          name: 'Pull Up',                muscles: ['lats','biceps'],              category: 'pull' },
  { id: 'chin-up',          name: 'Chin Up',                muscles: ['biceps','lats'],              category: 'pull' },
  { id: 'barbell-row',      name: 'Barbell Row',            muscles: ['back','biceps'],              category: 'pull' },
  { id: 'db-row',           name: 'Dumbbell Row',           muscles: ['back','biceps'],              category: 'pull' },
  { id: 'cable-row',        name: 'Cable Row',              muscles: ['back','biceps'],              category: 'pull' },
  { id: 'lat-pulldown',     name: 'Lat Pulldown',           muscles: ['lats','biceps'],              category: 'pull' },
  { id: 'face-pull',        name: 'Face Pull',              muscles: ['rear-delts','traps'],         category: 'pull' },
  { id: 'db-curl',          name: 'Dumbbell Curl',          muscles: ['biceps'],                     category: 'pull' },
  { id: 'barbell-curl',     name: 'Barbell Curl',           muscles: ['biceps'],                     category: 'pull' },
  { id: 'hammer-curl',      name: 'Hammer Curl',            muscles: ['biceps','brachialis'],        category: 'pull' },
  { id: 'shrug',            name: 'Barbell Shrug',          muscles: ['traps'],                      category: 'pull' },
  { id: 'hyperextension',   name: 'Back Extension',         muscles: ['lower-back','glutes'],        category: 'pull' },

  // Legs
  { id: 'squat',            name: 'Barbell Back Squat',     muscles: ['quads','glutes','hamstrings'], category: 'legs' },
  { id: 'front-squat',      name: 'Front Squat',            muscles: ['quads','glutes'],             category: 'legs' },
  { id: 'goblet-squat',     name: 'Goblet Squat',           muscles: ['quads','glutes'],             category: 'legs' },
  { id: 'deadlift',         name: 'Deadlift',               muscles: ['hamstrings','glutes','back'], category: 'legs' },
  { id: 'rdl',              name: 'Romanian Deadlift (RDL)', muscles: ['hamstrings','glutes'],        category: 'legs' },
  { id: 'sumo-dl',          name: 'Sumo Deadlift',          muscles: ['hamstrings','glutes','adductors'], category: 'legs' },
  { id: 'leg-press',        name: 'Leg Press',              muscles: ['quads','glutes'],             category: 'legs' },
  { id: 'lunge',            name: 'Lunge',                  muscles: ['quads','glutes','hamstrings'], category: 'legs' },
  { id: 'bulgarian-squat',  name: 'Bulgarian Split Squat',  muscles: ['quads','glutes'],             category: 'legs' },
  { id: 'leg-curl',         name: 'Leg Curl',               muscles: ['hamstrings'],                 category: 'legs' },
  { id: 'leg-extension',    name: 'Leg Extension',          muscles: ['quads'],                      category: 'legs' },
  { id: 'hip-thrust',       name: 'Hip Thrust',             muscles: ['glutes','hamstrings'],        category: 'legs' },
  { id: 'calf-raise',       name: 'Calf Raise',             muscles: ['calves'],                     category: 'legs' },
  { id: 'step-up',          name: 'Step Up',                muscles: ['quads','glutes'],             category: 'legs' },
  { id: 'hack-squat',       name: 'Hack Squat',             muscles: ['quads','glutes'],             category: 'legs' },
  { id: 'glute-bridge',     name: 'Glute Bridge',           muscles: ['glutes','hamstrings'],        category: 'legs' },

  // Olympic / Power
  { id: 'power-clean',      name: 'Power Clean',            muscles: ['full-body'],                  category: 'power' },
  { id: 'hang-clean',       name: 'Hang Clean',             muscles: ['full-body'],                  category: 'power' },
  { id: 'power-snatch',     name: 'Power Snatch',           muscles: ['full-body'],                  category: 'power' },

  // Core
  { id: 'plank',            name: 'Plank',                  muscles: ['core'],                       category: 'core' },
  { id: 'ab-wheel',         name: 'Ab Wheel Rollout',       muscles: ['core'],                       category: 'core' },
  { id: 'cable-crunch',     name: 'Cable Crunch',           muscles: ['core'],                       category: 'core' },
  { id: 'hanging-knee',     name: 'Hanging Knee Raise',     muscles: ['core','hip-flexors'],         category: 'core' },
  { id: 'russian-twist',    name: 'Russian Twist',          muscles: ['core','obliques'],            category: 'core' },
  { id: 'side-plank',       name: 'Side Plank',             muscles: ['obliques','core'],            category: 'core' },

  // Cardio / Conditioning
  { id: 'box-jump',         name: 'Box Jump',               muscles: ['quads','glutes'],             category: 'cardio' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing',       muscles: ['glutes','hamstrings','core'], category: 'cardio' },
  { id: 'burpee',           name: 'Burpee',                 muscles: ['full-body'],                  category: 'cardio' },
  { id: 'battle-ropes',     name: 'Battle Ropes',           muscles: ['shoulders','core'],           category: 'cardio' },
  { id: 'sled-push',        name: 'Sled Push',              muscles: ['quads','glutes'],             category: 'cardio' },
  { id: 'farmers-carry',    name: "Farmer's Carry",         muscles: ['grip','traps','core'],        category: 'cardio' },
];

/** Get YouTube search URL for an exercise tutorial */
export function getWatchUrl(exerciseName) {
  return 'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(exerciseName + ' proper form tutorial');
}

/** Show a modal for browsing the exercise library (used by coach program builder) */
export function openLibraryModal(onSelect) {
  const existing = document.getElementById('ex-lib-modal');
  if (existing) existing.remove();

  const cats = [...new Set(EXERCISE_LIBRARY.map(e => e.category))];

  const modal = document.createElement('div');
  modal.id = 'ex-lib-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:#111117;border:1px solid rgba(255,255,255,.12);border-radius:16px;width:100%;max-width:600px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:12px">
        <span style="font-size:20px">📚</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">Exercise Library</div>
          <div style="font-size:12px;color:#71717a;margin-top:2px">Search and add exercises to the program</div>
        </div>
        <button onclick="document.getElementById('ex-lib-modal').remove()"
          style="background:none;border:none;color:#71717a;font-size:20px;cursor:pointer;line-height:1;padding:4px">✕</button>
      </div>
      <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.08)">
        <input id="ex-lib-search" type="text" placeholder="Search exercises..."
          style="width:100%;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#f4f4f5;font-size:14px;outline:none"
          oninput="filterLibrary(this.value)" autocomplete="off" />
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px" id="ex-lib-cats">
          <button class="ex-cat-btn active" onclick="filterLibraryByCat('all',this)"
            style="padding:4px 12px;border-radius:20px;border:1px solid var(--primary,#7850ff);background:var(--primary,#7850ff);color:#fff;font-size:12px;font-weight:600;cursor:pointer">All</button>
          ${cats.map(c => `
            <button class="ex-cat-btn" onclick="filterLibraryByCat('${c}',this)"
              style="padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.15);background:none;color:#a1a1aa;font-size:12px;font-weight:600;cursor:pointer;text-transform:capitalize">${c}</button>
          `).join('')}
        </div>
      </div>
      <div id="ex-lib-list" style="overflow-y:auto;padding:12px 20px;flex:1;display:flex;flex-direction:column;gap:6px"></div>
    </div>`;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  window._exLibOnSelect = onSelect;
  window._exLibCurrentCat = 'all';
  renderLibraryList('');
}

function renderLibraryList(search, cat = window._exLibCurrentCat || 'all') {
  const list = document.getElementById('ex-lib-list');
  if (!list) return;
  const q = (search || '').toLowerCase().trim();
  const filtered = EXERCISE_LIBRARY.filter(e => {
    const matchCat = cat === 'all' || e.category === cat;
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.muscles.some(m => m.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:#71717a;font-size:14px">No exercises found</div>';
    return;
  }

  list.innerHTML = filtered.map(ex => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;cursor:pointer;transition:background .12s"
      onmouseover="this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.background='rgba(255,255,255,.03)'">
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px">${ex.name}</div>
        <div style="font-size:12px;color:#71717a;margin-top:2px">${ex.muscles.join(', ')}</div>
      </div>
      <a href="${getWatchUrl(ex.name)}" target="_blank" rel="noopener"
        onclick="event.stopPropagation()"
        style="font-size:12px;color:#7850ff;text-decoration:none;padding:4px 8px;border:1px solid rgba(120,80,255,.3);border-radius:6px;white-space:nowrap">▶ Watch</a>
      <button onclick="window._exLibOnSelect && window._exLibOnSelect(${JSON.stringify(ex).replace(/"/g,'&quot;')});document.getElementById('ex-lib-modal').remove()"
        style="padding:6px 14px;background:var(--primary,#7850ff);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">+ Add</button>
    </div>
  `).join('');
}

window.filterLibrary = function(q) {
  renderLibraryList(q, window._exLibCurrentCat || 'all');
};

window.filterLibraryByCat = function(cat, btn) {
  window._exLibCurrentCat = cat;
  document.querySelectorAll('.ex-cat-btn').forEach(b => {
    const isActive = b === btn;
    b.style.background = isActive ? 'var(--primary,#7850ff)' : 'none';
    b.style.color = isActive ? '#fff' : '#a1a1aa';
    b.style.borderColor = isActive ? 'var(--primary,#7850ff)' : 'rgba(255,255,255,.15)';
  });
  renderLibraryList(document.getElementById('ex-lib-search')?.value || '', cat);
};
