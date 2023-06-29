import fs from 'node:fs'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MultihashIndexSortedReader } from '../../../src/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = __dirname + '/../../fixtures/bafybeicpxveeln3sd4scqlacrunxhzmvslnbgxa72evmqg7r27emdek464.car.idx'

async function main () {
  console.time('iterator')
  const reader = MultihashIndexSortedReader.createReader({ reader: Readable.toWeb(fs.createReadStream(filePath)).getReader() })

  const items = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    items.push(value)
  }
  console.log(items.length)
  console.timeEnd('iterator')
}

main()
