export type TokenSource = 'GH_TOKEN' | 'GITHUB_TOKEN';

export function createGhEnvironment(
  token: string,
  tokenSource: TokenSource,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const tokenEnv =
    tokenSource === 'GH_TOKEN'
      ? { GH_TOKEN: token }
      : { GH_TOKEN: token, GITHUB_TOKEN: token };

  return { ...baseEnv, ...tokenEnv };
}
