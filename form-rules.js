/**
 * Form Check Rule Engine — Phase B
 * Pure functions. Input: MediaPipe pose landmarks array (33 items).
 * Output: array of flags { id, severity, message, drill? }
 *
 * Landmark indices used:
 * 11=left_shoulder, 12=right_shoulder, 13=left_elbow, 14=right_elbow,
 * 15=left_wrist, 16=right_wrist, 23=left_hip, 24=right_hip,
 * 25=left_knee, 26=right_knee, 27=left_ankle, 28=right_ankle
 */

/** Angle in degrees at joint B, given points A-B-C. */
export function jointAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function visible(lm) {
  return lm && (lm.visibility ?? 1) > 0.5;
}

export function analyzeSquat(landmarks) {
  const flags = [];
  const lHip = landmarks[23], rHip = landmarks[24];
  const lKnee = landmarks[25], rKnee = landmarks[26];
  const lAnkle = landmarks[27], rAnkle = landmarks[28];

  // Depth: hip y should be >= knee y (y increases downward in image coords)
  if (visible(lHip) && visible(lKnee)) {
    if (lHip.y < lKnee.y - 0.03) {
      flags.push({ id: 'depth', severity: 'warning', drill: 'box-squat-pause',
        message: 'Squat depth — hip crease not reaching parallel. Try box squats to build depth.' });
    }
  }

  // Knee cave: knee x-position tracking inside ankle
  if (visible(lKnee) && visible(lAnkle) && visible(rKnee) && visible(rAnkle)) {
    const lCave = lKnee.x > lAnkle.x + 0.04;
    const rCave = rKnee.x < rAnkle.x - 0.04;
    if (lCave || rCave) {
      flags.push({ id: 'knee_cave', severity: 'warning', drill: 'glute-med-clamshell',
        message: 'Knee cave detected — knees tracking inside feet. Focus on pushing knees out.' });
    }
  }

  return flags;
}

export function analyzeDeadlift(landmarks) {
  const flags = [];
  const lShoulder = landmarks[11], lHip = landmarks[23], lKnee = landmarks[25];

  if (visible(lShoulder) && visible(lHip) && visible(lKnee)) {
    const spineAngle = jointAngle(lShoulder, lHip, lKnee);
    if (spineAngle < 150) {
      flags.push({ id: 'back_angle', severity: 'warning', drill: 'rdl-hip-hinge',
        message: 'Back rounding detected — maintain neutral spine. Practice RDLs for hip hinge pattern.' });
    }
  }

  return flags;
}

export function analyzeBench(landmarks) {
  const flags = [];
  const lShoulder = landmarks[11], rShoulder = landmarks[12];
  const lElbow = landmarks[13], rElbow = landmarks[14];

  if (visible(lShoulder) && visible(lElbow) && visible(rShoulder) && visible(rElbow)) {
    const elbowWidth = Math.abs(lElbow.x - rElbow.x);
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
    if (elbowWidth > shoulderWidth * 1.3) {
      flags.push({ id: 'elbow_flare', severity: 'info',
        message: 'Elbows flaring wide — tuck them slightly toward your hips for shoulder safety.' });
    }
  }

  return flags;
}

export function analyzeRow(landmarks) {
  const flags = [];
  const lShoulder = landmarks[11], lHip = landmarks[23];

  if (visible(lShoulder) && visible(lHip)) {
    const torsoAngle = jointAngle({ x: lShoulder.x, y: 0 }, lShoulder, lHip);
    if (torsoAngle < 130) {
      flags.push({ id: 'scap_movement', severity: 'info', drill: 'lat-pulldown-scap',
        message: 'Scapular retraction could be stronger — pull shoulder blades together at the top.' });
    }
  }

  return flags;
}

export function analyzeOverheadPress(landmarks) {
  const flags = [];
  const lWrist = landmarks[15], lShoulder = landmarks[11];

  if (visible(lWrist) && visible(lShoulder)) {
    const offset = Math.abs(lWrist.x - lShoulder.x);
    if (offset > 0.08) {
      flags.push({ id: 'bar_path', severity: 'warning', drill: 'shoulder-press-bracing',
        message: 'Bar path drifting — keep the bar directly overhead at lockout.' });
    }
  }

  return flags;
}

const ANALYZERS = {
  'squat':          analyzeSquat,
  'back squat':     analyzeSquat,
  'front squat':    analyzeSquat,
  'deadlift':       analyzeDeadlift,
  'sumo deadlift':  analyzeDeadlift,
  'bench press':    analyzeBench,
  'bench':          analyzeBench,
  'row':            analyzeRow,
  'barbell row':    analyzeRow,
  'overhead press': analyzeOverheadPress,
  'ohp':            analyzeOverheadPress,
};

export function analyzeExercise(exerciseName, landmarks) {
  const key = (exerciseName || '').toLowerCase().trim();
  const analyzer = Object.entries(ANALYZERS).find(([k]) => key.includes(k))?.[1];
  return analyzer ? analyzer(landmarks) : [];
}
