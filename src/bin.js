#!/usr/bin/env node
/* global TransformStream */
import sade from 'sade'
import fs from 'node:fs'
import { Readable, Writable } from 'node:stream'
import { CarIndexer } from '@ipld/car'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import varint from 'varint'
import { MultiIndexReader, MultiIndexWriter } from './multi-index/index.js'
import { IndexSortedReader, IndexSortedWriter, MultihashIndexSortedReader, MultihashIndexSortedWriter } from './index.js'
import { MULTIHASH_INDEX_SORTED_CODEC } from './mh-index-sorted/codec.js'
import { INDEX_SORTED_CODEC } from './index-sorted/codec.js'
import { MULTI_INDEX_CODEC } from './multi-index/codec.js'

/** CAR CID code */
const carCode = 0x0202

const prog = sade('cardex')

prog
  .version('1.0.0')

prog
  .command('build <src>')
  .describe('Build an index for the passed src CAR file. Pass multiple sources to build a multi-index.')
  .option('-f, --format', 'Index format (MultihashIndexSorted or IndexSorted)', 'MultihashIndexSorted')
  .option('-o, --output', 'Write output to this file.')
  .example('build my.car -o my.car.idx')
  .action(async (src, opts) => {
    const srcs = [src, ...opts._]

    const { readable, writable } = new TransformStream()
    readable.pipeTo(Writable.toWeb(opts.output ? fs.createWriteStream(opts.output) : process.stdout))

    const Writer = opts.format === 'IndexSorted' ? IndexSortedWriter : MultihashIndexSortedWriter

    if (srcs.length > 1) {
      const carCIDs = []
      for await (const src of srcs) {
        const bytes = await fs.promises.readFile(src)
        carCIDs.push(CID.createV1(carCode, await sha256.digest(bytes)))
      }

      const writer = MultiIndexWriter.createWriter({ writer: writable.getWriter() })

      for (let i = 0; i < srcs.length; i++) {
        const cid = carCIDs[i]
        const src = srcs[i]
        writer.add(cid, async ({ writer }) => {
          const carStream = fs.createReadStream(src)
          const indexer = await CarIndexer.fromIterable(carStream)
          const indexWriter = Writer.createWriter({ writer })
          for await (const { cid, offset } of indexer) {
            await indexWriter.add(cid, offset)
          }
          await indexWriter.close()
        })
      }

      await writer.close()
    } else {
      const writer = Writer.createWriter({ writer: writable.getWriter() })
      const carStream = fs.createReadStream(srcs[0])
      const indexer = await CarIndexer.fromIterable(carStream)
      for await (const { cid, offset } of indexer) {
        await writer.add(cid, offset)
      }
      await writer.close()
    }

    // if an output file was passed, print the CID of the generated index
    if (opts.output) {
      const bytes = await fs.promises.readFile(opts.output)
      console.warn(CID.createV1(raw.code, await sha256.digest(bytes)).toString())
    }
  })

prog
  .command('inspect <src>')
  .describe('Inspect an index and print out info.')
  .option('--verbose', 'Print some more info.', false)
  .example('inspect my.car.idx')
  .action(async (src, opts) => {
    const fd = await fs.promises.open(src)
    const codecBytes = new Uint8Array(8)
    await fd.read(codecBytes, 0, 8)
    const codec = varint.decode(codecBytes)

    const readable = Readable.toWeb(fs.createReadStream(src))
    let reader

    if (codec === MULTIHASH_INDEX_SORTED_CODEC) {
      reader = MultihashIndexSortedReader.createReader({ reader: readable.getReader() })
    } else if (codec === INDEX_SORTED_CODEC) {
      reader = IndexSortedReader.createReader({ reader: readable.getReader() })
    } else if (codec === MULTI_INDEX_CODEC) {
      reader = MultiIndexReader.createReader({ reader: readable.getReader() })
      reader.add(MultihashIndexSortedReader)
      reader.add(IndexSortedReader)
    } else {
      console.error(`unknown index codec: 0x${codec.toString(16)}`)
      process.exit(1)
    }

    let lastOrigin = null
    let count = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      count++
      // @ts-expect-error
      const { origin, multihash, digest, offset } = value
      if (origin && origin.toString() !== lastOrigin) {
        lastOrigin = origin.toString()
        console.log(origin.toString())
      }
      if (multihash) {
        console.log(`${origin ? '\t' : ''}${CID.createV1(raw.code, multihash)} @ ${offset}`)
      } else {
        console.log(`${origin ? '\t' : ''}${Buffer.from(digest).toString('hex')} @ ${offset}`)
      }
    }

    if (opts.verbose) {
      console.log('---')
      console.log(`${count} entries`)
    }
  })

prog.parse(process.argv)
