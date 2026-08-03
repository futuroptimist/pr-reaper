import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runReaper } from '../dist/reap.js';

const summaryFile = join(tmpdir(), 'pr-reaper-summary.md');
const outputFile = join(tmpdir(), 'pr-reaper-output.txt');
writeFileSync(summaryFile, '');
writeFileSync(outputFile, '');
process.env.GITHUB_STEP_SUMMARY = summaryFile;
process.env.GITHUB_OUTPUT = outputFile;

class FakeGh {
  constructor(options = {}) {
    this.scopes = options.scopes ?? ['repo', 'read:org'];
    this.login = Object.prototype.hasOwnProperty.call(options, 'login') ? options.login : 'octocat';
    this.prs = options.prs ?? [];
    this.closed = [];
    this.permissions = options.permissions ?? {};
    this.permissionError = options.permissionError ?? null;
    this.permissionLookups = [];
    this.versionInfo = options.version ?? 'gh version 2.0.0';
    this.statusInfo = options.status ?? 'Logged in to github.com as octocat';
  }

  async version() {
    return this.versionInfo;
  }

  async authStatus() {
    return this.statusInfo;
  }

  async getLogin() {
    return this.login;
  }

  async getTokenScopes() {
    return new Set(this.scopes);
  }

  async searchPullRequests() {
    return this.prs;
  }

  async getRepositoryPermissions(repo) {
    this.permissionLookups.push(repo);
    if (this.permissionError) {
      throw this.permissionError;
    }
    return this.permissions[repo] ?? { push: true, maintain: false, admin: false };
  }

  async closePullRequest(repo, number, comment, deleteBranch) {
    this.closed.push({ repo, number, comment, deleteBranch });
  }
}

const artifactStub = {
  async uploadArtifact() {
    return {};
  }
};

const baseConfig = {
  dryRun: false,
  includeExternalContributions: false,
  author: 'octocat',
  org: null,
  titleFilter: null,
  deleteBranch: true,
  limit: 1000,
  comment: 'Closing as superseded by a newer Codex run.',
  exclude: [],
  token: 'token',
  tokenSource: 'GH_TOKEN',
  actor: 'octocat'
};

function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'pr-reaper-'));
  writeFileSync(summaryFile, '');
  writeFileSync(outputFile, '');
  return dir;
}

test('runReaper fails when repo scope is missing', async () => {
  const gh = new FakeGh({ scopes: [] });
  const workspace = createWorkspace();
  await assert.rejects(
    () => runReaper({ inputs: baseConfig, gh, workspace, artifactClient: artifactStub }),
    /repo scope/
  );
});

test('runReaper fails when read:org is missing for org searches', async () => {
  const gh = new FakeGh({ scopes: ['repo'] });
  const workspace = createWorkspace();
  await assert.rejects(
    () => runReaper({ inputs: { ...baseConfig, org: 'democratizedspace' }, gh, workspace, artifactClient: artifactStub }),
    /read:org/
  );
});

test('runReaper fails when gh is unauthenticated', async () => {
  const gh = new FakeGh({
    login: null,
    scopes: ['repo', 'read:org'],
    status: 'You are not logged into any GitHub hosts.'
  });
  const workspace = createWorkspace();
  await assert.rejects(
    () => runReaper({ inputs: baseConfig, gh, workspace, artifactClient: artifactStub }),
    /unauthenticated/
  );
});

test('runReaper logs auth status failures for diagnostics', async () => {
  const gh = new FakeGh({ login: null });
  gh.authStatus = async () => {
    throw new Error('auth status is unavailable');
  };

  const workspace = createWorkspace();
  const logs = [];
  const consoleStub = {
    log: (message) => logs.push(`log:${message}`),
    warn: (message) => logs.push(`warn:${message}`),
    error: (message) => logs.push(`error:${message}`)
  };

  await assert.rejects(
    () =>
      runReaper({
        inputs: baseConfig,
        gh,
        workspace,
        artifactClient: artifactStub,
        console: consoleStub
      }),
    /unauthenticated/
  );

  assert(logs.some((line) => line.includes('gh auth status failed: auth status is unavailable')));
});

test('runReaper derives login from auth status when user API fails', async () => {
  const gh = new FakeGh({
    login: null,
    status: 'github.com: Logged in as actions-user (GITHUB_TOKEN)'
  });
  const workspace = createWorkspace();

  await assert.doesNotReject(() =>
    runReaper({ inputs: baseConfig, gh, workspace, artifactClient: artifactStub })
  );
});

test('runReaper uploads dry-run artifacts and never closes PRs', async () => {
  const prs = [
    {
      number: 42,
      permalink: 'https://github.com/octo/repo/pull/42',
      repository: { nameWithOwner: 'octo/repo' },
      title: 'Cleanup automation test',
      url: 'https://github.com/octo/repo/pull/42'
    }
  ];
  const gh = new FakeGh({ prs });
  const workspace = createWorkspace();
  const uploads = [];
  const artifactClient = {
    async uploadArtifact(name, files, rootDirectory) {
      uploads.push({ name, files, rootDirectory });
      return {};
    }
  };

  await runReaper({
    inputs: { ...baseConfig, dryRun: true },
    gh,
    workspace,
    artifactClient,
    env: {
      ACTIONS_RUNTIME_TOKEN: 'token',
      ACTIONS_RUNTIME_URL: 'https://example.com'
    }
  });

  assert.deepStrictEqual(gh.closed, []);
  assert.strictEqual(uploads.length, 1);
  const upload = uploads[0];
  assert.strictEqual(upload.name, 'dry-run-prs');
  assert.ok(
    upload.files.every((file) => file.startsWith(upload.rootDirectory)),
    'files are rooted'
  );

  const expectedFiles = ['prs.json', 'summary.md', 'prs.csv'];
  assert.strictEqual(upload.files.length, expectedFiles.length);
  for (const filename of expectedFiles) {
    const filePath = join(upload.rootDirectory, filename);
    assert.ok(existsSync(filePath), `expected artifact file ${filename}`);
  }

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  assert.ok(summaryFile, 'GITHUB_STEP_SUMMARY should be set');
  const summaryContents = readFileSync(summaryFile, 'utf8');
  assert.match(summaryContents, /Found \*\*1\*\* open pull request/);
});

test('runReaper skips artifact upload when runtime env is missing', async () => {
  const prs = [
    {
      number: 101,
      permalink: 'https://github.com/octo/repo/pull/101',
      repository: { nameWithOwner: 'octo/repo' },
      title: 'Tokenless run',
      url: 'https://github.com/octo/repo/pull/101'
    }
  ];
  const gh = new FakeGh({ prs });
  const workspace = createWorkspace();
  const uploads = [];
  const artifactClient = {
    async uploadArtifact(name, files, rootDirectory) {
      uploads.push({ name, files, rootDirectory });
      return {};
    }
  };

  await runReaper({
    inputs: { ...baseConfig, dryRun: true },
    gh,
    workspace,
    artifactClient,
    env: {}
  });

  assert.deepStrictEqual(uploads, []);
});

test('runReaper closes PRs when not in dry run', async () => {
  const prs = [
    {
      number: 7,
      permalink: 'https://github.com/octo/repo/pull/7',
      repository: { nameWithOwner: 'octo/repo' },
      title: 'Ready to merge',
      url: 'https://github.com/octo/repo/pull/7'
    }
  ];
  const gh = new FakeGh({ prs });
  const workspace = createWorkspace();

  await runReaper({
    inputs: { ...baseConfig, dryRun: false },
    gh,
    workspace,
    artifactClient: artifactStub
  });

  assert.strictEqual(gh.closed.length, 1);
  assert.deepStrictEqual(gh.closed[0], {
    repo: 'octo/repo',
    number: 7,
    comment: baseConfig.comment,
    deleteBranch: baseConfig.deleteBranch
  });
});

test('runReaper respects HTML PR URL exclusions', async () => {
  const excludedUrl = 'https://github.com/democratizedspace/dspace/pull/2180';

  const prs = [
    {
      number: 2180,
      permalink: excludedUrl,
      repository: { nameWithOwner: 'democratizedspace/dspace' },
      title: 'Do not close me',
      url: excludedUrl
    },
    {
      number: 42,
      permalink: 'https://github.com/octo/repo/pull/42',
      repository: { nameWithOwner: 'octo/repo' },
      title: 'Safe to close',
      url: 'https://github.com/octo/repo/pull/42'
    }
  ];

  const gh = new FakeGh({ prs });
  const workspace = createWorkspace();

  await runReaper({
    inputs: { ...baseConfig, dryRun: false, exclude: [excludedUrl] },
    gh,
    workspace,
    artifactClient: artifactStub
  });

  assert.strictEqual(gh.closed.length, 1);
  assert.deepStrictEqual(gh.closed[0], {
    repo: 'octo/repo',
    number: 42,
    comment: baseConfig.comment,
    deleteBranch: baseConfig.deleteBranch
  });
});

test('runReaper keeps repositories with maintain or admin permission eligible by default', async () => {
  const prs = [
    {
      number: 8,
      repository: { nameWithOwner: 'org/maintained' },
      title: 'Maintained organization PR',
      url: 'https://github.com/org/maintained/pull/8'
    },
    {
      number: 9,
      repository: { nameWithOwner: 'org/administered' },
      title: 'Administered organization PR',
      url: 'https://github.com/org/administered/pull/9'
    }
  ];
  const gh = new FakeGh({
    prs,
    permissions: {
      'org/maintained': { push: false, maintain: true, admin: false },
      'org/administered': { push: false, maintain: false, admin: true }
    }
  });

  await runReaper({ inputs: baseConfig, gh, workspace: createWorkspace(), artifactClient: artifactStub });

  assert.deepStrictEqual(gh.closed.map(({ repo }) => repo), ['org/maintained', 'org/administered']);
});

test('runReaper protects external contributions by default and deduplicates repository lookups', async () => {
  const prs = [1, 2].map((number) => ({
    number,
    repository: { nameWithOwner: 'external/project' },
    title: `External PR ${number}`,
    url: `https://github.com/external/project/pull/${number}`
  }));
  const gh = new FakeGh({
    prs,
    permissions: { 'external/project': { push: false, maintain: false, admin: false } }
  });
  const workspace = createWorkspace();

  await runReaper({ inputs: baseConfig, gh, workspace, artifactClient: artifactStub });

  assert.deepStrictEqual(gh.closed, []);
  assert.deepStrictEqual(gh.permissionLookups, ['external/project']);
  assert.deepStrictEqual(JSON.parse(readFileSync(join(workspace, 'prs.json'), 'utf8')), []);
  assert.match(readFileSync(outputFile, 'utf8'), /\n0\n/);
});

test('runReaper includes external contributions only when explicitly enabled', async () => {
  const pr = {
    number: 10,
    repository: { nameWithOwner: 'external/project' },
    title: 'Opted-in external PR',
    url: 'https://github.com/external/project/pull/10'
  };
  const gh = new FakeGh({ prs: [pr] });

  await runReaper({
    inputs: { ...baseConfig, includeExternalContributions: true },
    gh,
    workspace: createWorkspace(),
    artifactClient: artifactStub
  });

  assert.strictEqual(gh.closed.length, 1);
  assert.deepStrictEqual(gh.permissionLookups, []);
});

test('runReaper applies explicit exclusions before the external contribution opt-in', async () => {
  const url = 'https://github.com/external/project/pull/11';
  const gh = new FakeGh({
    prs: [{ number: 11, repository: { nameWithOwner: 'external/project' }, title: 'Excluded', url }]
  });

  await runReaper({
    inputs: { ...baseConfig, includeExternalContributions: true, exclude: [url] },
    gh,
    workspace: createWorkspace(),
    artifactClient: artifactStub
  });

  assert.deepStrictEqual(gh.closed, []);
  assert.deepStrictEqual(gh.permissionLookups, []);
});

test('runReaper fails closed when repository permission lookup fails', async () => {
  const gh = new FakeGh({
    prs: [{
      number: 12,
      repository: { nameWithOwner: 'unknown/project' },
      title: 'Unknown permissions',
      url: 'https://github.com/unknown/project/pull/12'
    }],
    permissionError: new Error('API unavailable')
  });
  const warnings = [];
  const consoleStub = {
    log() {},
    warn: (message) => warnings.push(message),
    error() {}
  };

  await runReaper({
    inputs: baseConfig,
    gh,
    workspace: createWorkspace(),
    artifactClient: artifactStub,
    console: consoleStub
  });

  assert.deepStrictEqual(gh.closed, []);
  assert(warnings.some((message) => message.includes('protecting its PRs: API unavailable')));
});
