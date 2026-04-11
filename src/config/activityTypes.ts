export const ACTIVITY_TYPES = [
  "Hiking",
  "Cycling",
  "Road Trip",
  "Photography Walk",
  "Coffee Meetup",
  "Gym Partner",
  "Study Group",
  "Running",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

