import assert from 'node:assert/strict'
import test from 'node:test'
import { sortModules } from '../src/modules/topology.ts'

const module = (id: string, dependencies: string[] = []) => ({
  id,
  name: id,
  dependencies,
})

test('sortModules places dependencies before consumers', () => {
  const result = sortModules([
    module('updater', ['tray']),
    module('tray'),
    module('core'),
  ])
  assert.deepEqual(result.map(({ id }) => id), ['tray', 'updater', 'core'])
})

test('sortModules rejects a missing enabled dependency', () => {
  assert.throws(
    () => sortModules([module('agent', ['sqlite'])]),
    /Module "agent" requires disabled or missing module "sqlite"/,
  )
})

test('sortModules rejects dependency cycles', () => {
  assert.throws(
    () => sortModules([module('a', ['b']), module('b', ['a'])]),
    /Circular module dependency: a -> b -> a/,
  )
})
