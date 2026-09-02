import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { findBrokenMarkdownLinks } from '../scripts/check-doc-links.mjs'

test('repository Markdown files have no broken relative links', async () => {
  assert.deepEqual(await findBrokenMarkdownLinks(new URL('../', import.meta.url)), [])
})

test('reports a missing relative Markdown target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'meow-doc-links-'))
  try {
    await writeFile(join(root, 'README.md'), '[missing](./missing.md)')
    assert.deepEqual(await findBrokenMarkdownLinks(root), ['README.md -> ./missing.md'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
