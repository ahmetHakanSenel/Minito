import { current, dismiss, enqueue, type PendingDialog } from '../dialogQueue';

type Pending = PendingDialog;

function request(id: number, resolve: (confirmed: boolean) => void): Pending {
  return { id, title: `q${id}`, resolve };
}

describe('the dialog queue', () => {
  it('shows nothing when nothing has been asked', () => {
    expect(current([])).toBeNull();
  });

  it('shows the first question asked', () => {
    const queue = enqueue(
      [],
      request(1, () => {})
    );
    expect(current(queue)?.id).toBe(1);
  });

  // Replacing the dialog on screen would answer a question nobody had read yet.
  it('makes a second question wait rather than replacing the first', () => {
    const queue = enqueue(
      enqueue(
        [],
        request(1, () => {})
      ),
      request(2, () => {})
    );
    expect(current(queue)?.id).toBe(1);
  });

  it('answers the question on screen and moves on to the next', () => {
    const answers: [number, boolean][] = [];
    const queue = enqueue(
      enqueue(
        [],
        request(1, (confirmed) => answers.push([1, confirmed]))
      ),
      request(2, (confirmed) => answers.push([2, confirmed]))
    );

    const afterFirst = dismiss(queue, true);
    expect(answers).toEqual([[1, true]]);
    expect(current(afterFirst)?.id).toBe(2);

    const afterSecond = dismiss(afterFirst, false);
    expect(answers).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(current(afterSecond)).toBeNull();
  });

  // Every caller is waiting on a promise, so a dismissal that resolves nothing would leave the
  // handler that opened it waiting for ever.
  it('always answers the caller, cancelled or confirmed', () => {
    const resolved: boolean[] = [];
    const queue = enqueue(
      [],
      request(1, (confirmed) => resolved.push(confirmed))
    );
    dismiss(queue, false);
    expect(resolved).toEqual([false]);
  });

  it('does nothing, and does not throw, when there is nothing to dismiss', () => {
    expect(dismiss([], true)).toEqual([]);
  });

  it('leaves the queue it was given alone', () => {
    const queue = enqueue(
      [],
      request(1, () => {})
    );
    const snapshot = [...queue];
    dismiss(queue, true);
    enqueue(
      queue,
      request(2, () => {})
    );
    expect(queue).toEqual(snapshot);
  });
});
