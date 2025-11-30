export function createGhEnvironment(token, tokenSource, baseEnv = process.env) {
    const tokenEnv = { GH_TOKEN: token, GITHUB_TOKEN: token };
    return { ...baseEnv, ...tokenEnv };
}
//# sourceMappingURL=env.js.map