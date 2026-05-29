/**
 * AI Program Draft Generator — Phase A
 * Callable Cloud Function. Fetches client intake, calls Anthropic Claude,
 * stores draft in Firestore, notifies coach.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

const STARTER_TEMPLATES = {
  'Beginner Strength':     { days: 3, focus: 'full-body compound lifts', rep_range: '3x8-10', intensity: 'RPE 6-7' },
  'Hypertrophy PPL':       { days: 6, focus: 'push/pull/legs split',     rep_range: '4x8-12', intensity: 'RPE 7-8' },
  'Fat Loss':              { days: 4, focus: 'circuits + compound lifts', rep_range: '3x12-15', intensity: 'RPE 7' },
  'Powerlifting Beginner': { days: 3, focus: 'squat/bench/deadlift',     rep_range: '5x5',    intensity: 'RPE 7-8' },
  'Athletic Performance':  { days: 4, focus: 'power + strength',          rep_range: '4x4-6',  intensity: 'RPE 7-8' },
};

async function getCoachStyleHints(coachId) {
  const historySnap = await db.collection('coachEditHistory')
    .where('coachId', '==', coachId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const history = historySnap.docs.map(d => d.data());
  if (history.length < 5) return '';

  const subs = {};
  history.forEach(edit => {
    if (edit.original?.exercise !== edit.edited?.exercise && edit.original?.exercise) {
      const key = `${edit.original.exercise} → ${edit.edited.exercise}`;
      subs[key] = (subs[key] || 0) + 1;
    }
  });

  const topSubs = Object.entries(subs).filter(([, n]) => n >= 2).map(([k]) => k).slice(0, 5);
  return topSubs.length ? `Coach style preferences: ${topSubs.join(', ')}.` : '';
}

function buildPrompt(intake, template, styleHints) {
  return `You are a professional strength coach writing a 5-week progressive program.

CLIENT PROFILE:
- Goal: ${intake.goal || 'general fitness'}
- Experience: ${intake.experience || 'beginner'}
- Equipment: ${intake.equipment || 'full gym'}
- Current weight: ${intake.weight || 'unknown'} kg
- Health notes: ${intake.parq?.anyYes ? 'Has PAR-Q concerns — keep intensity conservative' : 'No health concerns'}

PROGRAM TEMPLATE: ${template.name}
- Training days per week: ${template.days}
- Focus: ${template.focus}
- Rep ranges: ${template.rep_range}
- Target intensity: ${template.intensity}
${styleHints ? `\nCOACH PREFERENCES:\n${styleHints}` : ''}

Write a Week 1 program. Return ONLY valid JSON in this exact shape:
{
  "template": "<template name>",
  "weeks": 5,
  "week1": [
    {
      "day": 1,
      "label": "Day 1 — Push",
      "exercises": [
        { "name": "Barbell Back Squat", "sets": 3, "reps": "8-10", "rpe": 7, "notes": "Focus on depth" }
      ]
    }
  ],
  "reasoning": "One sentence explaining the structure choice",
  "progressionNotes": "How to progress week over week"
}
Include 4-6 exercises per day. Do not include any text outside the JSON.`;
}

exports.generateProgramDraft = onCall(
  { region: 'us-central1', timeoutSeconds: 60 },
  async (request) => {
    const { clientId, coachId, templateName } = request.data;
    if (!clientId || !coachId) throw new HttpsError('invalid-argument', 'clientId and coachId required');
    if (request.auth?.uid !== coachId) throw new HttpsError('permission-denied', 'Not authorized');

    // Verify Pro tier
    const coachSnap = await db.collection('users').doc(coachId).get();
    const coach = coachSnap.data() || {};
    const rawTier = coach.tier || 'free';
    const tier = rawTier === 'studio' ? 'pro' : rawTier;
    if (tier !== 'pro') throw new HttpsError('permission-denied', 'Pro tier required');

    // Verify client belongs to this coach
    const clientSnap = await db.collection('users').doc(clientId).get();
    const clientUser = clientSnap.data() || {};
    if (clientUser.coachId !== coachId) throw new HttpsError('permission-denied', 'Client does not belong to this coach');

    // Get client intake
    const intakeSnap = await db.collection('intakeForms').doc(clientId).get();
    if (!intakeSnap.exists) throw new HttpsError('not-found', 'Client intake not found');
    const intake = intakeSnap.data();

    const styleHints = await getCoachStyleHints(coachId);

    const templateKey = templateName && STARTER_TEMPLATES[templateName]
      ? templateName
      : Object.keys(STARTER_TEMPLATES)[0];
    const template = { name: templateKey, ...STARTER_TEMPLATES[templateKey] };

    // Lazy-load Anthropic SDK to keep cold-start small
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(intake, template, styleHints) }],
    });

    let programData;
    try {
      programData = JSON.parse(message.content[0].text);
    } catch {
      throw new HttpsError('internal', 'AI returned invalid JSON');
    }
    if (!Array.isArray(programData.week1) || !programData.week1.length) {
      throw new HttpsError('internal', 'AI draft missing required week1 data');
    }

    // Confidence: based on intake completeness + style edit count
    const dataPoints = [intake.goal, intake.experience, intake.equipment, intake.weight].filter(Boolean).length;
    const editCountSnap = await db.collection('coachEditHistory').where('coachId', '==', coachId).count().get();
    const editCount = editCountSnap.data().count;
    const confidence = Math.round((dataPoints / 4 * 60) + (Math.min(editCount, 20) / 20 * 40));

    const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('programDrafts').doc(draftId).set({
      id: draftId, coachId, clientId,
      status: 'pending_review',
      program: programData,
      confidence,
      templateUsed: templateKey,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection('notifications').add({
      targetUser: coachId,
      title: 'Program draft ready',
      message: `AI draft ready to review. Confidence: ${confidence}%.`,
      category: 'ai-draft',
      type: 'success',
      draftId, clientId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { draftId, confidence, template: templateKey };
  }
);
