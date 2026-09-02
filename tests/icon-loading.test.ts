import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeIconName, resolveIcon } from '../src/assets/icons/registry.ts'

test('normalizes PascalCase, spaces and underscores', () => {
  assert.equal(normalizeIconName('FolderOpen'), 'folder-open')
  assert.equal(normalizeIconName('clipboard_list'), 'clipboard-list')
  assert.equal(normalizeIconName('Circle Check'), 'circle-check')
})

test('resolves curated icons through normalized public names', () => {
  assert.ok(resolveIcon('FolderOpen'))
  assert.ok(resolveIcon('clipboard-list'))
  assert.equal(resolveIcon('not-in-the-starter-registry'), undefined)
})
