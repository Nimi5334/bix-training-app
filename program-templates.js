// program-templates.js
// 5 starter programs offered during onboarding. Coach picks one,
// it gets attached to the new client as their week-1 program.
// Each program is 1 week (5 workouts) — coach extends from there.

export const STARTER_PROGRAMS = [
  {
    id: 'beginner-strength',
    name: 'Beginner Strength',
    description: '3x/week full body. Perfect for new lifters.',
    weeks: [{
      week: 1,
      workouts: [
        { day: 'Mon', name: 'Full Body A', exercises: [
          { name: 'Squat', sets: 3, reps: 5, rpe: 7 },
          { name: 'Bench Press', sets: 3, reps: 5, rpe: 7 },
          { name: 'Bent Row', sets: 3, reps: 8, rpe: 7 }
        ]},
        { day: 'Wed', name: 'Full Body B', exercises: [
          { name: 'Deadlift', sets: 3, reps: 5, rpe: 7 },
          { name: 'Overhead Press', sets: 3, reps: 5, rpe: 7 },
          { name: 'Pull-up', sets: 3, reps: 6, rpe: 7 }
        ]},
        { day: 'Fri', name: 'Full Body A', exercises: [
          { name: 'Squat', sets: 3, reps: 5, rpe: 7 },
          { name: 'Bench Press', sets: 3, reps: 5, rpe: 7 },
          { name: 'Bent Row', sets: 3, reps: 8, rpe: 7 }
        ]}
      ]
    }]
  },
  {
    id: 'hypertrophy-ppl',
    name: 'Hypertrophy PPL',
    description: 'Push/Pull/Legs split, 6 days/week.',
    weeks: [{ week: 1, workouts: [
      { day: 'Mon', name: 'Push', exercises: [
        { name: 'Bench Press', sets: 4, reps: 8, rpe: 7 },
        { name: 'Overhead Press', sets: 3, reps: 10, rpe: 7 },
        { name: 'Tricep Pushdown', sets: 3, reps: 12, rpe: 7 }
      ]},
      { day: 'Tue', name: 'Pull', exercises: [
        { name: 'Deadlift', sets: 3, reps: 5, rpe: 7 },
        { name: 'Pull-up', sets: 4, reps: 8, rpe: 8 },
        { name: 'Bicep Curl', sets: 3, reps: 12, rpe: 7 }
      ]},
      { day: 'Wed', name: 'Legs', exercises: [
        { name: 'Squat', sets: 4, reps: 8, rpe: 7 },
        { name: 'Romanian Deadlift', sets: 3, reps: 10, rpe: 7 },
        { name: 'Leg Press', sets: 3, reps: 12, rpe: 8 }
      ]}
      // Coach can extend with Thu/Fri/Sat repeats
    ]}]
  },
  {
    id: 'fat-loss',
    name: 'Fat Loss + Cardio',
    description: 'Full body strength 3x + cardio 2x.',
    weeks: [{ week: 1, workouts: [
      { day: 'Mon', name: 'Strength A', exercises: [
        { name: 'Goblet Squat', sets: 3, reps: 12, rpe: 7 },
        { name: 'Push-up', sets: 3, reps: 12, rpe: 7 },
        { name: 'Dumbbell Row', sets: 3, reps: 12, rpe: 7 }
      ]},
      { day: 'Tue', name: 'Cardio', exercises: [
        { name: 'Incline Walk', sets: 1, reps: 30, rpe: 6, note: '30 min' }
      ]},
      { day: 'Thu', name: 'Strength B', exercises: [
        { name: 'Romanian Deadlift', sets: 3, reps: 12, rpe: 7 },
        { name: 'Overhead Press', sets: 3, reps: 12, rpe: 7 },
        { name: 'Lat Pulldown', sets: 3, reps: 12, rpe: 7 }
      ]}
    ]}]
  },
  {
    id: 'powerlifting-beginner',
    name: 'Powerlifting Beginner',
    description: 'Squat/Bench/Deadlift focus, 4 days/week.',
    weeks: [{ week: 1, workouts: [
      { day: 'Mon', name: 'Squat focus', exercises: [
        { name: 'Squat', sets: 4, reps: 5, rpe: 7 },
        { name: 'Bench Press', sets: 3, reps: 5, rpe: 7 },
        { name: 'Bent Row', sets: 3, reps: 8, rpe: 7 }
      ]},
      { day: 'Wed', name: 'Bench focus', exercises: [
        { name: 'Bench Press', sets: 4, reps: 5, rpe: 7 },
        { name: 'Squat', sets: 3, reps: 5, rpe: 7 },
        { name: 'Pull-up', sets: 3, reps: 6, rpe: 7 }
      ]},
      { day: 'Fri', name: 'Deadlift focus', exercises: [
        { name: 'Deadlift', sets: 4, reps: 5, rpe: 7 },
        { name: 'Overhead Press', sets: 3, reps: 5, rpe: 7 }
      ]}
    ]}]
  },
  {
    id: 'athletic',
    name: 'Athletic Performance',
    description: 'Power + strength + conditioning.',
    weeks: [{ week: 1, workouts: [
      { day: 'Mon', name: 'Power', exercises: [
        { name: 'Box Jump', sets: 4, reps: 5, rpe: 7 },
        { name: 'Squat', sets: 4, reps: 5, rpe: 7 },
        { name: 'Med Ball Throw', sets: 3, reps: 8, rpe: 7 }
      ]},
      { day: 'Wed', name: 'Strength', exercises: [
        { name: 'Deadlift', sets: 4, reps: 5, rpe: 7 },
        { name: 'Bench Press', sets: 4, reps: 5, rpe: 7 },
        { name: 'Pull-up', sets: 3, reps: 6, rpe: 7 }
      ]},
      { day: 'Fri', name: 'Conditioning', exercises: [
        { name: 'Sled Push', sets: 5, reps: 1, rpe: 8, note: '40m' },
        { name: 'Sprints', sets: 6, reps: 1, rpe: 8, note: '20m' }
      ]}
    ]}]
  }
];

export function getStarterProgram(id) {
  return STARTER_PROGRAMS.find(p => p.id === id) || null;
}
