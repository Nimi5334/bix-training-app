/**
 * Group Class Scheduling
 * Coaches create recurring or one-off class slots.
 * Clients browse upcoming classes and book/cancel spots.
 *
 * Firestore: classes/{classId}
 *   { coachId, title, description, startTime (ISO), durationMinutes,
 *     capacity, recurrence: 'none'|'weekly', bookings: [userId], status: 'open'|'full'|'cancelled' }
 */

// ════════════════════════════════
// COACH SIDE
// ════════════════════════════════
export class CoachClasses {
  constructor() {}

  async init() {
    document.addEventListener('sessionReady', () => this.render());
  }

  async render() {
    const host = document.getElementById('classes-coach-host');
    if (!host || !window.session) return;
    try {
      const classes = await window.DB.getClassesByCoach(window.session.id);
      this._render(host, classes);
    } catch (err) {
      console.error('CoachClasses render error:', err);
    }
  }

  _render(host, classes) {
    const now = new Date();
    const upcoming = classes
      .filter(c => c.status !== 'cancelled' && new Date(c.startTime) >= now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const past = classes
      .filter(c => c.status !== 'cancelled' && new Date(c.startTime) < now)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 5);

    host.innerHTML = `
      <div style="max-width:720px">
        <!-- Create Class Button -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button onclick="window.coachClasses._showCreateForm()"
            style="padding:10px 20px;background:var(--primary);color:#fff;border:none;border-radius:var(--r-md);font-weight:700;font-size:14px;cursor:pointer">
            + Create Class
          </button>
        </div>

        <!-- Create form (hidden) -->
        <div id="create-class-form" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:20px">
          <div style="font-size:14px;font-weight:700;margin-bottom:14px">New Class</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div style="grid-column:1/-1">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Class Title *</label>
              <input id="cc-title" type="text" placeholder="e.g. Morning HIIT, Strength & Conditioning…"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Date & Time *</label>
              <input id="cc-datetime" type="datetime-local"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Duration (min)</label>
              <input id="cc-duration" type="number" value="60" min="5" step="5"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Max Capacity</label>
              <input id="cc-capacity" type="number" value="10" min="1" step="1"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Description (optional)</label>
              <input id="cc-desc" type="text" placeholder="What to bring, focus of the class…"
                style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:14px" />
            </div>
            <div style="grid-column:1/-1;display:flex;align-items:center;gap:10px">
              <input id="cc-recurring" type="checkbox" style="width:16px;height:16px;cursor:pointer" />
              <label for="cc-recurring" style="font-size:13px;cursor:pointer">Repeat weekly (creates 8 occurrences)</label>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button onclick="window.coachClasses._saveClass()"
              style="padding:10px 24px;background:var(--primary);color:#fff;border:none;border-radius:var(--r-md);font-weight:700;font-size:14px;cursor:pointer">
              Save Class
            </button>
            <button onclick="document.getElementById('create-class-form').style.display='none'"
              style="padding:10px 20px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:var(--r-md);font-size:14px;cursor:pointer">
              Cancel
            </button>
          </div>
          <div id="cc-msg" style="display:none;margin-top:10px;font-size:13px"></div>
        </div>

        <!-- Upcoming Classes -->
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px">Upcoming Classes</div>
        ${!upcoming.length
          ? '<div style="text-align:center;padding:40px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-lg);color:var(--text-muted);font-size:14px">No upcoming classes. Create one above!</div>'
          : upcoming.map(c => this._classCard(c, true)).join('')}

        ${past.length ? `
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:24px 0 10px">Past Classes</div>
          ${past.map(c => this._classCard(c, false)).join('')}
        ` : ''}
      </div>`;

    window.coachClasses = this;
  }

  _classCard(c, upcoming) {
    const dt   = new Date(c.startTime);
    const booked = (c.bookings || []).length;
    const full   = booked >= (c.capacity || 10);
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px 18px;margin-bottom:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="background:var(--primary);color:#fff;border-radius:var(--r-md);padding:8px 12px;text-align:center;min-width:52px">
          <div style="font-size:18px;font-weight:700;line-height:1">${dt.getDate()}</div>
          <div style="font-size:10px;text-transform:uppercase">${dt.toLocaleString('en',{month:'short'})}</div>
        </div>
        <div style="flex:1;min-width:160px">
          <div style="font-weight:700;font-size:15px">${c.title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
            ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${c.durationMinutes || 60}min · ${booked}/${c.capacity || 10} booked
            ${c.recurrence === 'weekly' ? ' · 🔁 Weekly' : ''}
          </div>
          ${c.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px">${c.description}</div>` : ''}
        </div>
        ${upcoming ? `
          <button onclick="window.coachClasses._cancelClass('${c.id}')"
            style="padding:7px 14px;background:none;border:1px solid rgba(239,68,68,.4);color:#f87171;border-radius:var(--r-md);font-size:13px;cursor:pointer;font-weight:600">
            Cancel
          </button>` : '<span style="font-size:12px;color:var(--text-muted)">Past</span>'}
      </div>`;
  }

  _showCreateForm() {
    const form = document.getElementById('create-class-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    // Set min datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('cc-datetime').min = now.toISOString().slice(0, 16);
  }

  async _saveClass() {
    const title    = document.getElementById('cc-title')?.value.trim();
    const datetime = document.getElementById('cc-datetime')?.value;
    const duration = parseInt(document.getElementById('cc-duration')?.value) || 60;
    const capacity = parseInt(document.getElementById('cc-capacity')?.value) || 10;
    const desc     = document.getElementById('cc-desc')?.value.trim();
    const recurring = document.getElementById('cc-recurring')?.checked;
    const msg = document.getElementById('cc-msg');

    if (!title || !datetime) {
      msg.style.display = 'block';
      msg.style.color = '#f87171';
      msg.textContent = 'Title and date/time are required.';
      return;
    }

    const startTime = new Date(datetime).toISOString();
    const base = { coachId: window.session.id, title, description: desc, durationMinutes: duration, capacity, bookings: [], status: 'open' };

    if (recurring) {
      // Create 8 weekly occurrences
      const promises = [];
      for (let i = 0; i < 8; i++) {
        const d = new Date(startTime);
        d.setDate(d.getDate() + i * 7);
        promises.push(window.DB.createClass({ ...base, startTime: d.toISOString(), recurrence: 'weekly' }));
      }
      await Promise.all(promises);
    } else {
      await window.DB.createClass({ ...base, startTime, recurrence: 'none' });
    }

    document.getElementById('create-class-form').style.display = 'none';
    window.toast?.('Class created!', 'success');
    this.render();
  }

  async _cancelClass(classId) {
    if (!confirm('Cancel this class? Booked clients will see the class removed.')) return;
    await window.DB.cancelClass(classId);
    window.toast?.('Class cancelled', 'info');
    this.render();
  }
}

// ════════════════════════════════
// CLIENT SIDE
// ════════════════════════════════
export class ClientClasses {
  constructor() {}

  async init() {
    document.addEventListener('sessionReady', () => this.render());
  }

  async render() {
    const host = document.getElementById('classes-client-host');
    if (!host || !window.session) return;
    try {
      const classes = await window.DB.getUpcomingClassesForClient(window.session);
      this._render(host, classes);
    } catch (err) {
      console.error('ClientClasses render error:', err);
    }
  }

  _render(host, classes) {
    const now = new Date();
    const upcoming = classes.filter(c => new Date(c.startTime) >= now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    host.innerHTML = `
      <div style="max-width:600px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">Available Classes</div>
        ${!upcoming.length
          ? '<div style="text-align:center;padding:48px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-lg);color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">📅</div><p>No upcoming classes yet. Check back soon!</p></div>'
          : upcoming.map(c => this._clientCard(c)).join('')}
      </div>`;

    window.clientClasses = this;
  }

  _clientCard(c) {
    const dt     = new Date(c.startTime);
    const booked = (c.bookings || []).length;
    const isFull = booked >= (c.capacity || 10);
    const isBooked = (c.bookings || []).includes(window.session.id);

    return `
      <div style="background:var(--surface);border:1px solid ${isBooked ? 'var(--primary)' : 'var(--border)'};border-radius:var(--r-lg);padding:16px 18px;margin-bottom:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="background:${isBooked ? 'var(--primary)' : 'var(--surface2)'};color:${isBooked ? '#fff' : 'var(--text-muted)'};border-radius:var(--r-md);padding:8px 12px;text-align:center;min-width:52px">
          <div style="font-size:18px;font-weight:700;line-height:1">${dt.getDate()}</div>
          <div style="font-size:10px;text-transform:uppercase">${dt.toLocaleString('en',{month:'short'})}</div>
        </div>
        <div style="flex:1;min-width:160px">
          <div style="font-weight:700;font-size:15px">${c.title} ${isBooked ? '✓' : ''}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
            ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${c.durationMinutes || 60}min
          </div>
          <div style="font-size:12px;margin-top:3px;color:${isFull && !isBooked ? '#f87171' : 'var(--text-muted)'}">
            ${isBooked ? '✅ You\'re booked!' : isFull ? '🔴 Full' : `${(c.capacity || 10) - booked} spot${(c.capacity || 10) - booked === 1 ? '' : 's'} left`}
          </div>
          ${c.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px">${c.description}</div>` : ''}
        </div>
        ${isBooked
          ? `<button onclick="window.clientClasses._cancelBooking('${c.id}')"
              style="padding:8px 16px;background:none;border:1px solid rgba(239,68,68,.4);color:#f87171;border-radius:var(--r-md);font-size:13px;cursor:pointer;font-weight:600">
              Cancel
            </button>`
          : `<button onclick="window.clientClasses._book('${c.id}')"
              ${isFull ? 'disabled' : ''}
              style="padding:8px 20px;background:${isFull ? 'var(--surface2)' : 'var(--primary)'};color:${isFull ? 'var(--text-muted)' : '#fff'};border:none;border-radius:var(--r-md);font-weight:700;font-size:13px;cursor:${isFull ? 'default' : 'pointer'}">
              ${isFull ? 'Full' : 'Book'}
            </button>`}
      </div>`;
  }

  async _book(classId) {
    await window.DB.bookClass(classId, window.session.id);
    window.toast?.('Booked!', 'success');
    this.render();
  }

  async _cancelBooking(classId) {
    await window.DB.cancelBooking(classId, window.session.id);
    window.toast?.('Booking cancelled', 'info');
    this.render();
  }
}
