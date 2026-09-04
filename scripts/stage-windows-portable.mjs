import { createHash } from 'node:crypto'
import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deliveryFileName,
  hasWindowsBinaryHeader,
  readWindowsBuildMetadata,
  resolveCargoTargetRoot,
} from './package-windows.mjs'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

export async function stageWindowsPortable({ source, outputDirectory, prefix, version, architecture }) {
  const sourceContents = await readFile(source)
  if (!hasWindowsBinaryHeader(sourceContents, 'portable')) {
    throw new Error(`Portable source is not a valid PE executable: ${source}`)
  }

  await mkdir(outputDirectory, { recursive: true })
  const fileName = deliveryFileName(prefix, 'portable', version, architecture)
  const destination = resolve(outputDirectory, fileName)
  await copyFile(source, destination)
  const digest = createHash('sha256').update(await readFile(destination)).digest('hex')
  const checksumPath = resolve(outputDirectory, `${fileName}.sha256`)
  await writeFile(checksumPath, `${digest}  ${fileName}\n`)
  return { path: destination, fileName, checksumPath, sha256: digest }
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Portable Windows staging only runs on Windows.')
  const config = await readWindowsBuildMetadata()
  const architecture = process.arch === 'x64' ? 'x64' : process.arch
  const result = await stageWindowsPortable({
    source: resolve(resolveCargoTargetRoot(), 'release', `${config.binaryName}.exe`),
    outputDirectory: resolve(projectRoot, 'release-artifacts', 'github-release', 'windows', config.version),
    prefix: config.prefix,
    version: config.version,
    architecture,
  })

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, [
      `tag=v${config.version}`,
      `portable_path=${result.path}`,
      `portable_name=${result.fileName}`,
      `checksum_path=${result.checksumPath}`,
      `checksum_name=${result.fileName}.sha256`,
      `sha256=${result.sha256}`,
      '',
    ].join('\n'))
  }
  console.log(`Portable Windows release staged: ${result.path}`)
  console.log(`SHA-256: ${result.sha256}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
