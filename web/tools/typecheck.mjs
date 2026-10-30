// Type-check tanpa memanggil binari tsc (dipakai bila ./node_modules/.bin/tsc diblokir guard).
import ts from 'typescript'

const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(cfg.config ?? {}, ts.sys, '.')
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true })
const diags = ts.getPreEmitDiagnostics(program)

if (diags.length === 0) {
  console.log('TYPE OK — 0 error')
} else {
  for (const d of diags.slice(0, 40)) {
    const pos = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null
    const where = d.file && pos ? `${d.file.fileName}:${pos.line + 1}:${pos.character + 1}` : ''
    console.log(`${where} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
  }
  console.log(`TOTAL ${diags.length} error`)
  process.exitCode = 1
}
