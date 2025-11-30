export type TokenSource = 'GH_TOKEN' | 'GITHUB_TOKEN';

export function createGhEnvironment(
  token: string,
  tokenSource: TokenSource,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const tokenEnv = { GH_TOKEN: token, GITHUB_TOKEN: token };

  return { ...baseEnv, ...tokenEnv };
}
