import { normalizeSteps } from '../breakdownSteps';

describe('normalizeSteps', () => {
  it('reads the snake_case wire format', () => {
    expect(
      normalizeSteps([
        {
          id: 'step-1',
          title: ' Carry three cups to the sink ',
          instruction: 'No washing yet.',
          estimated_minutes: 2,
          difficulty: 'easy',
        },
      ])
    ).toEqual([
      {
        id: 'step-1',
        title: 'Carry three cups to the sink',
        instruction: 'No washing yet.',
        estimatedMinutes: 2,
        difficulty: 'easy',
      },
    ]);
  });

  it('round-trips its own camelCase output', () => {
    const steps = normalizeSteps([
      { id: 'step-1', title: 'Rinse', instruction: '', estimated_minutes: 3, difficulty: 'hard' },
    ]);

    expect(normalizeSteps(JSON.parse(JSON.stringify(steps)))).toEqual(steps);
  });

  it('upgrades legacy string steps with positional ids', () => {
    expect(normalizeSteps(['Grab one cup', '  '])).toEqual([
      {
        id: 'step-1',
        title: 'Grab one cup',
        instruction: '',
        estimatedMinutes: null,
        difficulty: null,
      },
    ]);
  });

  it('drops unusable entries and ignores invalid metadata', () => {
    expect(
      normalizeSteps([
        42,
        null,
        { title: '' },
        { title: 'Stretch', estimated_minutes: -1, difficulty: 'epic' },
      ])
    ).toEqual([
      { id: 'step-4', title: 'Stretch', instruction: '', estimatedMinutes: null, difficulty: null },
    ]);
  });

  it('treats anything but an array as no steps', () => {
    expect(normalizeSteps({ steps: [] })).toEqual([]);
    expect(normalizeSteps(undefined)).toEqual([]);
  });
});
