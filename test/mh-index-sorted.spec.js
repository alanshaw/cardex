import test from 'ava'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { Buffer } from 'buffer'
import { CID } from 'multiformats'
import * as raw from 'multiformats/codecs/raw'
import { MultihashIndexSortedReader, MultihashIndexSortedWriter, MULTIHASH_INDEX_SORTED_CODEC } from '../lib/mh-index-sorted.js'
import { collect } from './helpers/collect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { writer, out } = MultihashIndexSortedWriter.create()

  const closePromise = t.notThrowsAsync(async () => {
    for await (const blockIndexData of indexer) {
      await writer.put(blockIndexData)
    }
    await writer.close()
  })

  const chunks = await collect(out)
  t.is(varint.decode(chunks[0]), MULTIHASH_INDEX_SORTED_CODEC)

  await closePromise
})

test('reads an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { writer, out } = MultihashIndexSortedWriter.create()

  /** @type {import('multiformats').CID[]} */
  const cids = []

  const closePromise = t.notThrowsAsync(async () => {
    for await (const blockIndexData of indexer) {
      cids.push(blockIndexData.cid)
      await writer.put(blockIndexData)
    }
    await writer.close()
  })

  const chunks = await collect(out)
  const reader = MultihashIndexSortedReader.fromBytes(Buffer.concat(chunks))

  for await (const { multihash, digest, offset } of reader.entries()) {
    const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${CID.createV1(raw.code, multihash)} (aka ${cids[i]}) @ ${offset}`)
    cids.splice(i, 1)
  }

  await closePromise
})
