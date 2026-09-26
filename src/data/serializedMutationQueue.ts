export type SerializedMutationQueue = <T>(
  mutation: () => Promise<T>,
) => Promise<T>;

export function createSerializedMutationQueue(): SerializedMutationQueue {
  let tail: Promise<void> = Promise.resolve();
  return <T>(mutation: () => Promise<T>) => {
    const operation = tail.then(mutation);
    tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };
}
