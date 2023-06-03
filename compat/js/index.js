/* global TransformStream */
import sade from 'sade'
import { IndexSortedWriter, MultihashIndexSortedWriter } from 'cardex'
import fs from 'node:fs'
import { Writable } from 'node:stream'
import { CarIndexer } from '@ipld/car/indexer'

sade('cardex <path>')
  .version('0.0.0')
  .option('--format, -f', 'Index format to use: "IndexSorted" or "MultihashIndexSorted"')
  .option('--output, -o', 'Output file path.')
  .action(async (carPath, opts) => {
    const outPath = opts.output || carPath + '.idx'
    const carStream = fs.createReadStream(carPath)
    const indexer = await CarIndexer.fromIterable(carStream)
    const idxFmt = opts.format === 'IndexSorted' ? opts.format : 'MultihashIndexSorted'
    const idxCodec = opts.format === 'IndexSorted' ? IndexSortedWriter.codec : MultihashIndexSortedWriter.codec
    const IndexWriter = idxCodec === IndexSortedWriter.codec ? IndexSortedWriter : MultihashIndexSortedWriter

    const { readable, writable } = new TransformStream()
    const writer = IndexWriter.createWriter({ writer: writable.getWriter() })

    console.log(`Generating index in ${idxFmt} (${idxCodec}) format...`)
    readable.pipeTo(Writable.toWeb(fs.createWriteStream(outPath)))

    for await (const { cid, offset } of indexer) {
      await writer.add(cid, offset)
    }
    await writer.close()
  })
  .parse(process.argv)
