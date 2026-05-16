// at-risk-templates.js
// Templated save messages, one per detection rule.
// Coach reviews + edits before sending — never auto-sends.

export const SAVE_TEMPLATES = {
  no_app_open_5d:
    "Hey {{clientName}}, haven't seen you in the app in a few days — everything good? Want to swap this week for something lighter to ease back in?",
  no_workout_3d:
    "Hey {{clientName}}, noticed you haven't logged a workout in a few days. Anything I can adjust? Happy to scale things back this week.",
  skipped_2_in_7d:
    "Hey {{clientName}}, looks like a couple of sessions slipped this week. Totally normal — want me to reshuffle the rest of the week?",
  rpe_creep:
    "Hey {{clientName}}, your RPE has been creeping up — could be a sign you need a deload. Want me to swap this week to lower intensity?",
  no_chat_reply_4d:
    "Hey {{clientName}}, just checking in — everything good? Holler if you want to chat about the program."
};

const PRIORITY = ['skipped_2_in_7d','no_workout_3d','no_app_open_5d','rpe_creep','no_chat_reply_4d'];

export function draftSaveMessage(triggeredRuleIds, vars) {
  const top = PRIORITY.find(id => triggeredRuleIds.includes(id));
  const template = top
    ? SAVE_TEMPLATES[top]
    : "Hey {{clientName}}, just checking in — how are you feeling about the program?";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}
