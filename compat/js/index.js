import sade from 'sade'
import { IndexSortedWriter, MultihashIndexSortedWriter, INDEX_SORTED_CODEC, MULTIHASH_INDEX_SORTED_CODEC } from 'cardex'
import fs from 'fs'
import { Readable } from 'stream'
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
    const idxCodec = opts.format === 'IndexSorted' ? INDEX_SORTED_CODEC : MULTIHASH_INDEX_SORTED_CODEC
    const IndexWriter = idxCodec === INDEX_SORTED_CODEC ? IndexSortedWriter : MultihashIndexSortedWriter
    const { writer, out } = IndexWriter.create()

    ;(async () => {
      for await (const blockIndexData of indexer) {
        await writer.put(blockIndexData)
      }
      await writer.close()
    })()

    console.log(`Generating index in ${idxFmt} (${idxCodec}) format...`)
    Readable.from(out).pipe(fs.createWriteStream(outPath))
  })
  .parse(process.argv)
