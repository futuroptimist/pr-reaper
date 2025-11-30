export function createGhEnvironment(
  token: string,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const tokenEnv = { GH_TOKEN: token, GITHUB_TOKEN: token };

  return { ...baseEnv, ...tokenEnv };
}
