import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { findAppleDoubleFiles, removeAppleDoubleFiles } from '../scripts/release-kit/appledouble.mjs'
import { isRunnableTestFile } from '../scripts/run-tests.mjs'

test('ignores AppleDouble test sidecars', () => {
  assert.equal(isRunnableTestFile('agent.test.ts'), true)
  assert.equal(isRunnableTestFile('._agent.test.ts'), false)
  assert.equal(isRunnableTestFile('tests/agent.test.ts'), true)
  assert.equal(isRunnableTestFile('tests/._agent.test.ts'), false)
})

test('finds and removes only regular AppleDouble sidecars without following symlinks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'meow-appledouble-'))
  const outside = await mkdtemp(join(tmpdir(), 'meow-appledouble-outside-'))
  const sidecar = join(root, '._sidecar')
  const nestedSidecar = join(root, 'nested', '._nested-sidecar')
  const outsideSidecar = join(outside, '._outside-sidecar')

  t.after(async () => {
    await rm(root, { force: true, recursive: true })
    await rm(outside, { force: true, recursive: true })
  })

  await writeFile(sidecar, 'metadata')
  await writeFile(join(root, '.env'), 'keep')
  await mkdir(join(root, 'nested'))
  await writeFile(nestedSidecar, 'metadata')
  await writeFile(outsideSidecar, 'metadata')
  await symlink(outsideSidecar, join(root, '._linked-sidecar'))
  await symlink(outside, join(root, 'linked-directory'))

  assert.deepEqual(await findAppleDoubleFiles(root), [sidecar, nestedSidecar])
  assert.deepEqual(await removeAppleDoubleFiles(root), [sidecar, nestedSidecar])
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'keep')
  assert.equal(await readFile(outsideSidecar, 'utf8'), 'metadata')
})
