import { parseTimeFromStep, parseTimeFromInput } from '../timeParser';

describe('parseTimeFromStep', () => {
  it('reads a plain duration in either language', () => {
    expect(parseTimeFromStep('5 dakika boyunca masanı topla')).toEqual({ minutes: 5, seconds: 0 });
    expect(parseTimeFromStep('10 dk yürü')).toEqual({ minutes: 10, seconds: 0 });
    expect(parseTimeFromStep('Rest for 5 minutes')).toEqual({ minutes: 5, seconds: 0 });
    expect(parseTimeFromStep('2 min stretch')).toEqual({ minutes: 2, seconds: 0 });
    expect(parseTimeFromStep('30 saniye derin nefes al')).toEqual({ minutes: 0, seconds: 30 });
    expect(parseTimeFromStep('Hold for 30 seconds')).toEqual({ minutes: 0, seconds: 30 });
  });

  // Turkish puts its grammar on the end of the word. Requiring a boundary straight after the
  // unit missed most natural phrasings, and the step then counted down the model's estimate
  // instead of the number written in the instruction.
  it('reads a duration that carries a Turkish suffix', () => {
    const cases: [string, number][] = [
      ['10 dakikada bir bardak su iç', 10],
      ['20 dakikaya kadar çalış', 20],
      ['1 dakikayı geçirmeden başla', 1],
      ['15 dakikalığına telefonu başka odaya koy', 15],
      ['3 dakikalık bir molayla bitir', 3],
    ];
    for (const [text, minutes] of cases) {
      expect(parseTimeFromStep(text)).toEqual({ minutes, seconds: 0 });
    }
    expect(parseTimeFromStep('45 saniyede bir kitabı rafa koy')).toEqual({
      minutes: 0,
      seconds: 45,
    });
    expect(parseTimeFromStep('20 saniyelik bir mola ver')).toEqual({ minutes: 0, seconds: 20 });
  });

  it('combines minutes and seconds from the same step', () => {
    expect(parseTimeFromStep('2 dakika 30 saniye bekle')).toEqual({ minutes: 2, seconds: 30 });
  });

  it('carries sixty or more seconds into minutes', () => {
    expect(parseTimeFromStep('90 saniye bekle')).toEqual({ minutes: 1, seconds: 30 });
  });

  // `min` must not match the opening of `minutes` and leave the rest dangling.
  it('prefers the longest English unit', () => {
    expect(parseTimeFromStep('Read for 12 minutes')).toEqual({ minutes: 12, seconds: 0 });
    expect(parseTimeFromStep('Wait 12 seconds')).toEqual({ minutes: 0, seconds: 12 });
  });

  it('finds nothing in a step that names no duration', () => {
    expect(parseTimeFromStep('Tek bir çöpü at')).toBeNull();
    expect(parseTimeFromStep('Throw away one piece of rubbish')).toBeNull();
    expect(parseTimeFromStep('')).toBeNull();
  });

  it('ignores a zero duration rather than starting a timer at nothing', () => {
    expect(parseTimeFromStep('0 dakika bekle')).toBeNull();
  });
});

describe('parseTimeFromInput', () => {
  it('reads a suffixed Turkish duration as well as a plain one', () => {
    expect(parseTimeFromInput('25 dakikalık bir oturum')).toEqual({ minutes: 25, seconds: 0 });
    expect(parseTimeFromInput('a 25 minute session')).toEqual({ minutes: 25, seconds: 0 });
  });
});
