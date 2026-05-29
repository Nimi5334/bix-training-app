// functions/index.js
// Export all Cloud Functions

exports.recalculateAtRiskDaily = require('./at-risk-cron').recalculateAtRiskDaily;
exports.scheduleSmartPush      = require('./smart-push').scheduleSmartPush;
exports.rescueNudge            = require('./rescue-nudge').rescueNudge;
exports.weeklyRecap            = require('./weekly-recap').weeklyRecap;
exports.generateProgramDraft   = require('./ai-program-draft').generateProgramDraft;
exports.suggestProgression     = require('./ai-progression').suggestProgression;
