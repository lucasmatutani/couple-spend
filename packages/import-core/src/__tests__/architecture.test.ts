import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(__dirname, '../../../../../')

function collectSources(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })) return []
  const entries = readdirSync(dir)
  const result: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory() && !['node_modules', 'dist', '.turbo', '__tests__'].includes(entry)) {
      result.push(...collectSources(fullPath))
    } else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      result.push(fullPath)
    }
  }
  return result
}

function extractImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const matches = [...content.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)]
  return matches.map((m) => m[1]!)
}

type Violation = { file: string; imp: string; pattern: string }

function violations(sourceDir: string, forbidden: string[]): Violation[] {
  const files = collectSources(resolve(root, sourceDir))
  const result: Violation[] = []
  for (const file of files) {
    for (const imp of extractImports(file)) {
      for (const pattern of forbidden) {
        if (imp.includes(pattern)) {
          result.push({ file: file.replace(root, ''), imp, pattern })
        }
      }
    }
  }
  return result
}

describe('Architecture', () => {
  it('import-core does not import adapter packages or parsing libs', () => {
    const found = violations('packages/import-core/src', [
      'import-ofx',
      'import-csv',
      'import-open-finance',
      'import-pdf',
      'ofx-js',
      'papaparse',
      'xlsx',
      // node:fs and node:path are allowed in test helpers but not in src
      // We check __tests__ is excluded from collectSources above
    ])
    expect(found).toEqual([])
  })

  it('import-core does not import database clients', () => {
    const found = violations('packages/import-core/src', [
      '@supabase/supabase-js',
      'pg',
      'prisma',
    ])
    expect(found).toEqual([])
  })

  it('domain does not import any import packages or DB clients', () => {
    const found = violations('packages/domain/src', [
      'import-core',
      'import-ofx',
      'import-csv',
      '@supabase/supabase-js',
    ])
    expect(found).toEqual([])
  })

  it('import-ofx does not import domain directly', () => {
    // import-ofx may only use @splitwise/import-core; @splitwise/domain is forbidden
    const found = violations('packages/import-ofx/src', [
      '@splitwise/domain',
      'packages/domain/src',
    ])
    expect(found).toEqual([])
  })

  it('import-pdf does not import domain directly', () => {
    const found = violations('packages/import-pdf/src', [
      '@splitwise/domain',
      'packages/domain/src',
    ])
    expect(found).toEqual([])
  })
})
