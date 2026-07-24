export const idAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const idSuffixLength = 16;

export const makeTemporaryId = <Prefix extends string>(prefix: Prefix): `${Prefix}${string}` => {
  const suffix = Array.from(
    { length: idSuffixLength },
    () => idAlphabet[Math.floor(Math.random() * idAlphabet.length)],
  ).join("");

  return `${prefix}${suffix}`;
};

/**
 * Generates a stable entity ID on the client so retried create requests can be
 * made idempotent. `crypto.getRandomValues` is available in supported browsers
 * and Node; the fallback keeps local/non-secure development environments usable.
 */
export const makeClientId = <Prefix extends string>(prefix: Prefix): `${Prefix}${string}` => {
  const randomValues = globalThis.crypto?.getRandomValues(new Uint32Array(idSuffixLength));
  const suffix = Array.from(
    { length: idSuffixLength },
    (_, index) =>
      idAlphabet[
        randomValues
          ? randomValues[index]! % idAlphabet.length
          : Math.floor(Math.random() * idAlphabet.length)
      ],
  ).join("");

  return `${prefix}${suffix}`;
};
