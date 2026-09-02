import { lstat, readdir, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'

async function findAtPath(path) {
  const entry = await lstat(path)

  if (entry.isSymbolicLink()) return []
  if (entry.isFile() && basename(path).startsWith('._')) return [path]
  if (!entry.isDirectory()) return []

  const entries = await readdir(path, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => findAtPath(join(path, entry.name))))
  return files.flat()
}

export async function findAppleDoubleFiles(root) {
  return (await findAtPath(root)).sort()
}

export async function removeAppleDoubleFiles(root) {
  const candidates = await findAppleDoubleFiles(root)
  const removed = []

  for (const path of candidates) {
    const entry = await lstat(path)
    if (!entry.isSymbolicLink() && entry.isFile() && basename(path).startsWith('._')) {
      await unlink(path)
      removed.push(path)
    }
  }

  return removed
}
