/* global TransformStream */
import test from 'ava'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { IndexSortedReader, IndexSortedWriter } from '../src/index.js'
import { collect } from './helpers/collect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = IndexSortedWriter.createWriter({ writer: writable.getWriter() })

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset } of indexer) {
      await writer.add({ digest: cid.multihash.digest, offset })
    }
    await writer.close()
  })

  const chunks = await collect(readable)
  t.is(varint.decode(chunks[0]), IndexSortedReader.codec)

  await closePromise
})

test('reads an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = IndexSortedWriter.createWriter({ writer: writable.getWriter() })

  /** @type {import('multiformats').UnknownLink[]} */
  const cids = []

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset } of indexer) {
      cids.push(cid)
      await writer.add({ digest: cid.multihash.digest, offset })
    }
    await writer.close()
  })

  const reader = IndexSortedReader.createReader({ reader: readable.getReader() })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const { digest, offset } = value
    const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${cids[i]} @ ${offset}`)
    cids.splice(i, 1)
  }

  await closePromise
})
