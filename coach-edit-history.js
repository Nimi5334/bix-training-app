/**
 * Coach Edit History — Phase A
 * Records coach edits to AI drafts for style learning.
 * Flush to Firestore when the coach publishes or saves.
 */

export class CoachEditHistory {
  constructor() {
    this._pendingEdits = [];
  }

  recordEdit(original, edited, context = {}) {
    this._pendingEdits.push({ original, edited, context, timestamp: new Date().toISOString() });
  }

  async flush(coachId) {
    if (!this._pendingEdits.length) return;
    const edits = [...this._pendingEdits];
    this._pendingEdits = [];
    await Promise.all(edits.map(edit =>
      window.DB.recordCoachEdit(coachId, edit.original, edit.edited, edit.context)
    ));
  }

  async getConfidence(coachId) {
    const fingerprint = await window.DB.getCoachStyleFingerprint(coachId);
    return fingerprint.confidence;
  }
}
