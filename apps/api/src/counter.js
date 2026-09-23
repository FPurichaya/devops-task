// One Node process can accept overlapping clicks. The cache write has to
// follow its own increment, so clicks are serialized in-process.
export function createSerializer() {
  let tail = Promise.resolve();
  return function serialize(task) {
    const run = tail.then(task, task);
    tail = run.then(
      () => {},
      () => {},
    );
    return run;
  };
}

export async function recordClick({ increment, writeCache, readCache }) {
  const count = await increment();
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("counter returned a non-integer");
  }
  await writeCache(count);
  const cached = await readCache();
  if (cached !== count) {
    throw new Error("cached counter does not match the persisted value");
  }
  return { count, source: "valkey", persisted: true };
}
