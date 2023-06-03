/* global TransformStream */
import test from 'ava'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { MultiIndexReader, MultiIndexWriter } from '../src/multi-index/index.js'
import { MultihashIndexSortedWriter } from '../src/index.js'
import { collect } from './helpers/collect.js'
import * as CAR from './helpers/car.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPaths = [
    path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car'),
    path.join(__dirname, 'fixtures', 'bafybeicpxveeln3sd4scqlacrunxhzmvslnbgxa72evmqg7r27emdek464.car')
  ]
  const { readable, writable } = new TransformStream()
  const writer = MultiIndexWriter.createWriter({ writer: writable.getWriter() })

  for (const carPath of carPaths) {
    const carCID = await CAR.createCID(await fs.promises.readFile(carPath))
    writer.add(carCID, async ({ writer }) => {
      const indexWriter = MultihashIndexSortedWriter.createWriter({ writer })
      const carStream = fs.createReadStream(carPath)
      const indexer = await CarIndexer.fromIterable(carStream)
      for await (const { cid, offset } of indexer) {
        await indexWriter.add(cid, offset)
      }
      await indexWriter.close()
    })
  }
  const closePromise = writer.close()

  const chunks = await collect(readable)
  t.is(varint.decode(chunks[0]), MultiIndexWriter.codec)

  await closePromise
})

test('reads an index', async t => {
  const carPaths = [
    path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car'),
    path.join(__dirname, 'fixtures', 'bafybeicpxveeln3sd4scqlacrunxhzmvslnbgxa72evmqg7r27emdek464.car')
  ]
  const { readable, writable } = new TransformStream()
  const writer = MultiIndexWriter.createWriter({ writer: writable.getWriter() })
  /** @type {Array<{ block: import('multiformats').UnknownLink, origin: import('../src/api').CARLink }>} */
  const blocks = []

  for (const carPath of carPaths) {
    const carCID = await CAR.createCID(await fs.promises.readFile(carPath))
    writer.add(carCID, async ({ writer }) => {
      const indexWriter = MultihashIndexSortedWriter.createWriter({ writer })
      const carStream = fs.createReadStream(carPath)
      const indexer = await CarIndexer.fromIterable(carStream)
      for await (const { cid, offset } of indexer) {
        blocks.push({ block: cid, origin: carCID })
        await indexWriter.add(cid, offset)
      }
      await indexWriter.close()
    })
  }
  const closePromise = writer.close()

  const reader = MultiIndexReader.createReader({ reader: readable.getReader() })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // @ts-expect-error
    const { origin, multihash, digest, offset } = value
    const i = blocks.findIndex(b => equals(b.block.multihash.digest, digest) && equals(b.origin.multihash.digest, origin.multihash.digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${CID.createV1(raw.code, multihash)} (aka ${blocks[i].block}) @ ${offset}`)
    blocks.splice(i, 1)
  }

  await closePromise
})
