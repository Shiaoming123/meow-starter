export function createReleaseProvenance({
  packageJson,
  environment = {},
  runGit,
}) {
  const errors = []
  const version = packageJson?.version
  if (typeof version !== 'string' || version.trim() === '') {
    errors.push('package.json must contain a non-empty version.')
  }

  const commit = runGitCommand(runGit, ['rev-parse', 'HEAD'], 'resolve the source commit', errors)
  const status = runGitCommand(runGit, ['status', '--porcelain'], 'inspect the source tree', errors)
  if (status !== undefined && status !== '') {
    errors.push('Release source tree must be clean.')
  }

  const isTagBuild = environment.GITHUB_REF_TYPE === 'tag'
  const tag = isTagBuild ? environment.GITHUB_REF_NAME : undefined
  if (isTagBuild && tag !== `v${version}`) {
    errors.push(`Release tag ${tag ?? '(missing)'} must match package version v${version}.`)
  }

  return {
    errors,
    provenance: {
      version,
      commit,
      sourceTree: status === '' ? 'clean' : 'unknown',
      ...(isTagBuild ? { tag } : {}),
    },
  }
}

function runGitCommand(runGit, args, action, errors) {
  try {
    const result = runGit(args)
    if (result?.status !== 0) {
      errors.push(`Unable to ${action} with git.`)
      return undefined
    }
    return typeof result.stdout === 'string' ? result.stdout.trim() : ''
  } catch {
    errors.push(`Unable to ${action} with git.`)
    return undefined
  }
}
