export function createGhEnvironment(token, tokenSource, baseEnv = process.env) {
    const tokenEnv = tokenSource === 'GH_TOKEN'
        ? { GH_TOKEN: token }
        : { GH_TOKEN: token, GITHUB_TOKEN: token };
    return { ...baseEnv, ...tokenEnv };
}
//# sourceMappingURL=env.js.map