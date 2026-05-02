/**
 * Nutrition Tracker — Client daily macro logging + coach macro target setting
 * Collections:
 *   macroTargets/{clientId}        — { protein, carbs, fats, calories, setAt }
 *   nutritionLogs/{clientId}/daily/{YYYY-MM-DD} — { meals: [], totals: {p,c,f,cal} }
 */

export class NutritionTracker {
  constructor() {
    this.targets  = null;
    this.todayLog = null;
    this.today    = new Date().toISOString().split('T')[0];
  }

  async init() {
    document.addEventListener('sessionReady', () => this._load());
  }

  async _load() {
    if (!window.session || window.session.role !== 'client') return;
    try {
      this.targets  = await window.DB.getMacroTargets(window.session.id);
      this.todayLog = await window.DB.getNutritionLog(window.session.id, this.today);
      this._render();
    } catch (err) {
      console.error('NutritionTracker load error:', err);
    }
  }

  _render() {
    const host = document.getElementById('nutrition-host');
    if (!host) return;

    const t = this.targets || { protein: 150, carbs: 200, fats: 60, calories: 2000 };
    const meals = this.todayLog?.meals || [];
    const totals = this._calcTotals(meals);

    host.innerHTML = `
      <div style="max-width:600px">

        <!-- Macro Rings -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Today's Progress</div>
          <div style="display:flex;justify-content:space-around;align-items:center;flex-wrap:wrap;gap:12px">
            ${this._ring('Protein',  totals.protein,  t.protein,  '#7850ff', 'g')}
            ${this._ring('Carbs',    totals.carbs,    t.carbs,    '#00d4aa', 'g')}
            ${this._ring('Fats',     totals.fats,     t.fats,     '#f97316', 'g')}
            ${this._ring('Calories', totals.calories, t.calories, '#3b82f6', 'kcal')}
          </div>
        </div>

        <!-- Quick Add -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Log a Meal</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div style="grid-column:1/-1">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Meal name</label>
              <input id="nutr-meal-name" type="text" placeholder="e.g. Lunch, Protein shake…"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Protein (g)</label>
              <input id="nutr-p" type="number" placeholder="0" min="0" step="1"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Carbs (g)</label>
              <input id="nutr-c" type="number" placeholder="0" min="0" step="1"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Fats (g)</label>
              <input id="nutr-f" type="number" placeholder="0" min="0" step="1"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Calories (kcal)</label>
              <input id="nutr-cal" type="number" placeholder="0" min="0" step="1"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
          </div>
          <button onclick="window.nutritionTracker.addMeal()"
            style="width:100%;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:var(--r-md);font-weight:700;font-size:14px;cursor:pointer">
            + Add Meal
          </button>
        </div>

        <!-- Today's Meals -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Today's Meals</div>
          ${!meals.length
            ? '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:14px">No meals logged yet today</div>'
            : meals.map((m, i) => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="flex:1">
                  <div style="font-weight:600;font-size:14px">${m.name || 'Meal'}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
                    ${[m.protein ? m.protein + 'g P' : '', m.carbs ? m.carbs + 'g C' : '', m.fats ? m.fats + 'g F' : '', m.calories ? m.calories + ' kcal' : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button onclick="window.nutritionTracker.removeMeal(${i})"
                  style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px;line-height:1">✕</button>
              </div>`).join('')}
        </div>

        ${!this.targets ? '<div style="margin-top:12px;padding:12px 16px;background:rgba(120,80,255,.08);border:1px solid rgba(120,80,255,.2);border-radius:var(--r-md);font-size:13px;color:var(--text-muted)">💡 Ask your coach to set your macro targets</div>' : ''}
      </div>`;

    window.nutritionTracker = this;
  }

  _ring(label, current, target, color, unit) {
    const pct = target ? Math.min(1, current / target) : 0;
    const r = 32, cx = 40, cy = 40;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;
    const statusColor = pct >= 1 ? '#10b981' : pct >= 0.8 ? color : pct >= 0.5 ? color : '#52525b';

    return `
      <div style="text-align:center;min-width:80px">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="8"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ * 0.25}"
            stroke-linecap="round" style="transition:stroke-dasharray .4s ease"/>
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="${statusColor}">${current}</text>
          <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#71717a">${unit}</text>
        </svg>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${label}</div>
        <div style="font-size:10px;color:#52525b">/ ${target}${unit}</div>
      </div>`;
  }

  _calcTotals(meals) {
    return meals.reduce((acc, m) => ({
      protein:  acc.protein  + (m.protein  || 0),
      carbs:    acc.carbs    + (m.carbs    || 0),
      fats:     acc.fats     + (m.fats     || 0),
      calories: acc.calories + (m.calories || 0),
    }), { protein: 0, carbs: 0, fats: 0, calories: 0 });
  }

  async addMeal() {
    const name     = document.getElementById('nutr-meal-name')?.value.trim() || 'Meal';
    const protein  = parseFloat(document.getElementById('nutr-p')?.value)   || 0;
    const carbs    = parseFloat(document.getElementById('nutr-c')?.value)   || 0;
    const fats     = parseFloat(document.getElementById('nutr-f')?.value)   || 0;
    const calories = parseFloat(document.getElementById('nutr-cal')?.value) || 0;

    if (!protein && !carbs && !fats && !calories) {
      window.toast?.('Enter at least one macro value', 'warning');
      return;
    }

    const meals = this.todayLog?.meals || [];
    meals.push({ name, protein, carbs, fats, calories, loggedAt: new Date().toISOString() });

    this.todayLog = await window.DB.logNutrition(window.session.id, this.today, meals);
    window.toast?.('Meal logged!', 'success');
    this._render();
  }

  async removeMeal(index) {
    const meals = (this.todayLog?.meals || []).filter((_, i) => i !== index);
    this.todayLog = await window.DB.logNutrition(window.session.id, this.today, meals);
    this._render();
  }
}

/**
 * Render the macro targets editor inside coach member detail.
 * Returns HTML string; save button calls DB.saveMacroTargets.
 */
export function renderCoachNutritionTab(clientId) {
  const host = document.createElement('div');
  host.id = 'nutrition-coach-tab';

  async function load() {
    const targets = await window.DB.getMacroTargets(clientId);
    const t = targets || { protein: 0, carbs: 0, fats: 0, calories: 0 };
    const logs = await window.DB.getNutritionLogs(clientId, 7);
    renderForm(t, logs);
  }

  function renderForm(t, logs) {
    const last7 = logs || [];
    const adherence = last7.map(l => {
      if (!t.calories) return null;
      const pct = Math.min(1, (l.totals?.calories || 0) / t.calories);
      return { date: l.date, pct };
    }).filter(Boolean);

    host.innerHTML = `
      <div style="max-width:480px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Set Daily Macro Targets</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            ${[['Protein (g)', 'cn-protein', t.protein], ['Carbs (g)', 'cn-carbs', t.carbs], ['Fats (g)', 'cn-fats', t.fats], ['Calories', 'cn-calories', t.calories]].map(([lbl, id, val]) => `
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">${lbl}</label>
                <input id="${id}" type="number" value="${val || ''}" min="0" step="1"
                  style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
              </div>`).join('')}
          </div>
          <button id="cn-save-btn" onclick="window._saveNutritionTargets('${clientId}')"
            style="width:100%;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:var(--r-md);font-weight:700;font-size:14px;cursor:pointer">
            Save Targets
          </button>
          <div id="cn-msg" style="display:none;margin-top:10px;font-size:13px;color:#10b981;text-align:center"></div>
        </div>

        ${adherence.length ? `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Last 7 Days Calorie Adherence</div>
            <div style="display:flex;align-items:flex-end;gap:6px;height:60px">
              ${adherence.map(a => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                  <div style="width:100%;background:${a.pct >= 0.9 ? '#10b981' : a.pct >= 0.7 ? '#f59e0b' : '#ef4444'};border-radius:4px 4px 0 0;height:${Math.max(4, a.pct * 50)}px;transition:height .3s"></div>
                  <div style="font-size:9px;color:#52525b">${a.date.slice(5)}</div>
                </div>`).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }

  window._saveNutritionTargets = async function(cid) {
    const btn = document.getElementById('cn-save-btn');
    const msg = document.getElementById('cn-msg');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const t = {
      protein:  parseFloat(document.getElementById('cn-protein')?.value)  || 0,
      carbs:    parseFloat(document.getElementById('cn-carbs')?.value)    || 0,
      fats:     parseFloat(document.getElementById('cn-fats')?.value)     || 0,
      calories: parseFloat(document.getElementById('cn-calories')?.value) || 0,
      setAt: new Date().toISOString(),
    };
    await window.DB.saveMacroTargets(cid, t);
    btn.disabled = false;
    btn.textContent = 'Save Targets';
    msg.style.display = 'block';
    msg.textContent = '✅ Saved!';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);
  };

  load();
  return host;
}
