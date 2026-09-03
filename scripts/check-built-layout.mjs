import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const assets = resolve('dist/assets')
const cssFiles = (await readdir(assets)).filter((file) => file.endsWith('.css'))
const css = (
  await Promise.all(cssFiles.map((file) => readFile(resolve(assets, file), 'utf8')))
).join('\n')
const compact = css.replace(/\s+/g, '')

const mobileMedia = /@media\((?:max-width:768px|width<=768px)\)[\s\S]*?/
const hasMobileShell = new RegExp(`${mobileMedia.source}\\.shell(?:\\[[^\\]]+\\])?\\{[^}]*flex-direction:column`).test(
  compact,
)
const hasSafeArea = new RegExp(`${mobileMedia.source}\\.tabbar(?:\\[[^\\]]+\\])?\\{[^}]*padding-bottom:env\\(safe-area-inset-bottom,0px\\)`).test(
  compact,
)

if (!hasMobileShell || !hasSafeArea) {
  console.error('Built CSS is missing the mobile column shell or bottom safe-area rule.')
  process.exit(1)
}

console.log('Built mobile layout contract is valid.')
