/* global WritableStream */
import fs from 'node:fs'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MultihashIndexSortedReaderStream } from '../../../src/mh-index-sorted/reader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = __dirname + '/../../fixtures/bafybeicpxveeln3sd4scqlacrunxhzmvslnbgxa72evmqg7r27emdek464.car.idx'

async function main () {
  console.time('stream')
  const items = []
  await Readable.toWeb(fs.createReadStream(filePath))
    // @ts-expect-error
    .pipeThrough(new MultihashIndexSortedReaderStream())
    .pipeTo(new WritableStream({
      write (value) {
        items.push(value)
      }
    }))
  console.log(items.length)
  console.timeEnd('stream')
}

main()
