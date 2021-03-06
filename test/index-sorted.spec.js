import test from 'ava'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { Buffer } from 'buffer'
import { IndexSortedReader, IndexSortedWriter, INDEX_SORTED_CODEC } from '../lib/index-sorted.js'
import { collect } from './helpers/collect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { writer, out } = IndexSortedWriter.create()

  const closePromise = t.notThrowsAsync(async () => {
    for await (const blockIndexData of indexer) {
      await writer.put(blockIndexData)
    }
    await writer.close()
  })

  const chunks = await collect(out)
  t.is(varint.decode(chunks[0]), INDEX_SORTED_CODEC)

  await closePromise
})

test('reads an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { writer, out } = IndexSortedWriter.create()

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
  const reader = IndexSortedReader.fromBytes(Buffer.concat(chunks))

  for await (const { digest, offset } of reader.entries()) {
    const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${cids[i]} @ ${offset}`)
    cids.splice(i, 1)
  }

  await closePromise
})
