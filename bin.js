#!/usr/bin/env node
import sade from 'sade'
import fs from 'fs'
import { Readable } from 'stream'
import { CarIndexer } from '@ipld/car'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { IndexSortedReader, IndexSortedWriter, MultihashIndexSortedWriter, MultihashIndexSortedReader } from './lib/index.js'

const prog = sade('cardex')

prog
  .version('1.0.0')
  .option('--format, -f', 'Index format (MultihashIndexSorted or IndexSorted)', 'MultihashIndexSorted')

prog
  .command('build <src>')
  .describe('Build an index for the passed src CAR file.')
  .option('-o, --output', 'Write output to this file.')
  .example('build my.car -o my.car.idx')
  .action(async (src, opts) => {
    const Writer = opts.format === 'IndexSorted' ? IndexSortedWriter : MultihashIndexSortedWriter
    const carStream = fs.createReadStream(src)
    const indexer = await CarIndexer.fromIterable(carStream)
    const { writer, out } = Writer.create()

    ;(async () => {
      for await (const blockIndexData of indexer) {
        await writer.put(blockIndexData)
      }
      await writer.close()
    })()

    Readable.from(out).pipe(opts.output ? fs.createWriteStream(opts.output) : process.stdout)
  })

prog
  .command('inspect <src>')
  .describe('Inspect an index and print out info.')
  .option('--verbose', 'Print some more info.', false)
  .example('inspect my.car.idx')
  .action(async (src, opts) => {
    const Reader = opts.format === 'IndexSorted' ? IndexSortedReader : MultihashIndexSortedReader
    const idxStream = fs.createReadStream(src)
    const reader = Reader.fromIterable(idxStream)

    let count = 0
    for await (const { multihash, digest, offset } of reader.entries()) {
      count++
      if (multihash) {
        console.log(`${CID.createV1(raw.code, multihash)} @ ${offset}`)
      } else {
        console.log(`${Buffer.from(digest).toString('hex')} @ ${offset}`)
      }
    }

    if (opts.verbose) {
      console.log('---')
      console.log(`${count} entries`)
    }
  })

prog.parse(process.argv)
