import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'target'])

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        return ignoredDirectories.has(entry.name) ? [] : markdownFiles(path)
      }
      return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
    }),
  )
  return nested.flat()
}

function relativeTargets(source) {
  const prose = source.replace(/```[\s\S]*?```/g, '')
  return [...prose.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ''))
    .filter((target) => target && !/^(?:https?:|mailto:|app:|sandbox:|#)/.test(target))
    .map((target) => target.split('#', 1)[0].split('?', 1)[0])
}

export async function findBrokenMarkdownLinks(rootInput) {
  const root = rootInput instanceof URL ? fileURLToPath(rootInput) : resolve(rootInput)
  const broken = []
  for (const file of await markdownFiles(root)) {
    const source = await readFile(file, 'utf8')
    for (const target of relativeTargets(source)) {
      const destination = resolve(dirname(file), target)
      try {
        await access(destination)
      } catch {
        broken.push(`${relative(root, file)} -> ${target}`)
      }
    }
  }
  return broken.sort()
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const broken = await findBrokenMarkdownLinks(new URL('../', import.meta.url))
  if (broken.length > 0) {
    console.error(broken.join('\n'))
    process.exit(1)
  }
  console.log('Markdown relative links are valid.')
}
