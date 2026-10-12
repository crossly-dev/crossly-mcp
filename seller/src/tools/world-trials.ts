import { apiGet } from '../api.js';
import { ToolDef } from './types.js';

/**
 * Hoverboard Time Trials in Crossly World: ring courses raced on the board,
 * timed by Crossly from where it saw you ride (through the arch, every ring in
 * order, on the board). No tool records a lap; these read the boards and your
 * bests. Prizes are pins; nothing here moves money.
 */
const EMPTY = { type: 'object', properties: {}, additionalProperties: false } as const;
const DEFAULT_COURSE = 'commons-loop';

export const worldTrialsTools: ToolDef[] = [
  {
    name: 'get_my_trial_bests',
    description:
      'Your Hoverboard Time Trials bests in Crossly World, per course: this week (best lap in ms, your place on the weekly board, laps ' +
      'finished, the split at each ring) and all time (best lap, your place, when). Weeks start Monday, UTC. Laps are timed by riding ' +
      'the course in the world.',
    inputSchema: EMPTY,
    handler: () => apiGet('/v1/world/trials/mine', {}),
  },
  {
    name: 'get_trials_leaderboard',
    description:
      'A Hoverboard Time Trials course\'s boards, as the board beside it in the Commons shows them: this week\'s ten fastest laps and the ' +
      'ten fastest ever (each person once), with rank, name, time in ms and when. A name shows only for somebody who chose to be seen ' +
      'by name in the world; everyone else is "A player". Course 1 is commons-loop (the default).',
    inputSchema: {
      type: 'object',
      properties: { course: { type: 'string', description: 'Course id, e.g. "commons-loop" (default).' } },
      additionalProperties: false,
    },
    handler: (args) => {
      const course = typeof args.course === 'string' && args.course ? args.course : DEFAULT_COURSE;
      return apiGet(`/v1/world/trials/${encodeURIComponent(course)}/leaderboard`, {});
    },
  },
];
