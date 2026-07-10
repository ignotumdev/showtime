export const idAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const idSuffixLength = 16;

export const makeTemporaryId = <Prefix extends string>(prefix: Prefix): `${Prefix}${string}` => {
  const suffix = Array.from(
    { length: idSuffixLength },
    () => idAlphabet[Math.floor(Math.random() * idAlphabet.length)],
  ).join("");

  return `${prefix}${suffix}`;
};
