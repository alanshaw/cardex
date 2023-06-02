#!/usr/bin/env node
import sade from 'sade'
import fs from 'fs'
import { Readable, Writable } from 'stream'
import { CarIndexer } from '@ipld/car'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import * as MultiIndexWriter from './lib/multi-index-writer.js'
import * as MultihashIndexSortedWriter from './lib/mh-index-sorted-writer.js'
import * as MultihashIndexSortedReader from './lib/mh-index-sorted-reader.js'
import * as MultiIndexReader from './lib/multi-index-reader.js'

/** CAR CID code */
const carCode = 0x0202

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
    const srcs = [src, ...opts._]
    const carCIDs = []
    for await (const src of srcs) {
      const bytes = await fs.promises.readFile(src)
      carCIDs.push(CID.createV1(carCode, await sha256.digest(bytes)))
    }

    const { readable, writable } = new TransformStream()
    const writer = MultiIndexWriter.createWriter({ writable, capacity: carCIDs.length })

    readable.pipeTo(Writable.toWeb(opts.output ? fs.createWriteStream(opts.output) : process.stdout))

    for (let i = 0; i < srcs.length; i++) {
      const carStream = fs.createReadStream(srcs[i])
      const indexer = await CarIndexer.fromIterable(carStream)
      const indexWriter = writer.createIndexWriter(carCIDs[i], MultihashIndexSortedWriter)

      for await (const blockIndexData of indexer) {
        await indexWriter.add(blockIndexData.cid, blockIndexData.offset)
      }
      await indexWriter.close()
    }

    await writer.close()
  })

prog
  .command('inspect <src>')
  .describe('Inspect an index and print out info.')
  .option('--verbose', 'Print some more info.', false)
  .example('inspect my.car.idx')
  .action(async (src, opts) => {
    const readable = Readable.toWeb(fs.createReadStream(src))
    const reader = MultiIndexReader.createReader({ readable, indexReaders: [MultihashIndexSortedReader] })

    let lastOrigin = null
    let count = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      count++
      const { origin, multihash, digest, offset } = value
      if (origin.toString() !== lastOrigin) {
        lastOrigin = origin.toString()
        console.log(origin.toString())
      }
      if (multihash) {
        console.log(`\t${CID.createV1(raw.code, multihash)} @ ${offset}`)
      } else {
        console.log(`\t${Buffer.from(digest).toString('hex')} @ ${offset}`)
      }
    }

    if (opts.verbose) {
      console.log('---')
      console.log(`${count} entries`)
    }
  })

prog.parse(process.argv)
