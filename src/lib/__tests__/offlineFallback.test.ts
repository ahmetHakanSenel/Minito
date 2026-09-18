import { categorizeTask, TaskCategory } from '../offlineFallback';

describe('categorizeTask', () => {
  it('recognises English tasks', () => {
    expect(categorizeTask('Clean the kitchen before Sunday')).toBe(TaskCategory.CLEANING);
    expect(categorizeTask('Study for the exam')).toBe(TaskCategory.STUDY);
    expect(categorizeTask('Finish the report for work')).toBe(TaskCategory.WORK);
    expect(categorizeTask('Start a workout routine')).toBe(TaskCategory.HEALTH);
    expect(categorizeTask('Pay the electricity bill')).toBe(TaskCategory.FINANCIAL);
  });

  // Turkish adds its grammar to the end of the word, so keywords have to be found inside one:
  // `topla` has to match `toplamam` and `toplayacağım`. Half of these used to fall through to
  // the general steps.
  it('recognises Turkish tasks whatever suffix the verb carries', () => {
    const cases: [string, TaskCategory][] = [
      ['Mutfağı toplamam lazım', TaskCategory.CLEANING],
      ['Odamı toplayacağım', TaskCategory.CLEANING],
      ['Bulaşıkları yıkamam gerekiyor', TaskCategory.CLEANING],
      ['Ödevimi bitirmem gerekiyor', TaskCategory.STUDY],
      ['Tez yazmaya oturmam gerek', TaskCategory.STUDY],
      ['Doktora gitmem gerekiyor', TaskCategory.HEALTH],
      ['Annemi aramam gerekiyor', TaskCategory.SOCIAL],
      ['Vergi beyannamesi vermem gerekiyor', TaskCategory.FINANCIAL],
      ['Sunum hazırlamam gerekiyor', TaskCategory.WORK],
    ];
    for (const [task, category] of cases) {
      expect(categorizeTask(task)).toBe(category);
    }
  });

  // JavaScript lowercases `I` to `i`, which is right for English and wrong for Turkish, where
  // the pair is `I`/`ı`. "SINAV" used to become "sinav" and stop matching "sınav".
  it('reads capitals in both alphabets', () => {
    expect(categorizeTask('SINAV için çalışmam lazım')).toBe(TaskCategory.STUDY);
    expect(categorizeTask('sınav için çalışmam lazım')).toBe(TaskCategory.STUDY);
    expect(categorizeTask('TIDY THE HOUSE')).toBe(TaskCategory.CLEANING);
    expect(categorizeTask('İŞ TOPLANTISI')).toBe(TaskCategory.WORK);
  });

  // Keywords are substrings, so a short one can hide inside an unrelated word. These are the
  // collisions worth pinning down: `anne` sits inside `planned`, `channel` and `scanned`.
  it('does not find a Turkish keyword hiding inside an English word', () => {
    expect(categorizeTask('Review everything I planned this week')).not.toBe(TaskCategory.SOCIAL);
    expect(categorizeTask('Set up the new channel')).not.toBe(TaskCategory.SOCIAL);
    expect(categorizeTask('Read the scanned documents')).not.toBe(TaskCategory.SOCIAL);
  });

  it('falls back to general steps rather than guessing', () => {
    expect(categorizeTask('kargo')).toBe(TaskCategory.GENERAL);
    expect(categorizeTask('')).toBe(TaskCategory.GENERAL);
  });
});
