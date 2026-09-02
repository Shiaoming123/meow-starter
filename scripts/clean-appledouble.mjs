import { fileURLToPath } from 'node:url'
import { removeAppleDoubleFiles } from './release-kit/appledouble.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const removed = await removeAppleDoubleFiles(root)

console.log(`Removed ${removed.length} AppleDouble file(s).`)
