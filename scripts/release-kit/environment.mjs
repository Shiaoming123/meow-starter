import { spawnSync } from 'node:child_process'

function getToolVersion(command) {
  const tool = spawnSync(command, ['--version'], { encoding: 'utf8' })
  return tool.status === 0 ? tool.stdout.trim() : 'missing'
}

function getFilesystemType(root, platform) {
  if (platform !== 'darwin') return 'unavailable (requires macOS)'

  const result = spawnSync('stat', ['-f', '%T', root], { encoding: 'utf8' })
  const filesystemType = result.status === 0 ? result.stdout.trim() : ''
  if (filesystemType && filesystemType !== '/') return filesystemType

  const mounts = spawnSync('mount', [], { encoding: 'utf8' })
  if (mounts.status !== 0) return filesystemType || 'unknown'

  const mount = mounts.stdout
    .split('\n')
    .map((line) => line.match(/^.+ on (.+) \(([^,]+),/))
    .filter(Boolean)
    .map(([, path, type]) => ({ path, type }))
    .filter((mount) => root === mount.path || root.startsWith(`${mount.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0]

  return mount?.type ?? (filesystemType || 'unknown')
}

export async function inspectEnvironment(root, options = {}) {
  const platform = options.platform ?? process.platform
  const detectedFilesystemType = options.filesystemType ?? getFilesystemType(root, platform)
  const filesystemType = detectedFilesystemType.toLowerCase() === 'exfat' ? 'exfat' : detectedFilesystemType
  const warnings = []

  if (platform === 'darwin' && filesystemType.toLowerCase() === 'exfat') {
    warnings.push('exFAT volumes can create AppleDouble sidecars; rust:verify will use a native temporary target directory.')
  }

  return {
    warnings,
    summary: [
      `Node: ${getToolVersion('node')}`,
      `npm: ${getToolVersion('npm')}`,
      `Rust: ${getToolVersion('rustc')}`,
      `Cargo: ${getToolVersion('cargo')}`,
      `Filesystem: ${filesystemType}`,
    ],
  }
}
