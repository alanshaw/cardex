/* global TransformStream WritableStream */
import test from 'ava'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { CID } from 'multiformats'
import * as raw from 'multiformats/codecs/raw'
import { MultihashIndexSortedReader, MultihashIndexSortedWriter } from '../src/index.js'
import { MultihashIndexSortedReaderStream } from '../src/mh-index-sorted/reader.js'
import { collect } from './helpers/collect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = MultihashIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset } of indexer) {
      await writer.add(cid, offset)
    }
    await writer.close()
  })

  const chunks = await collect(readable)
  t.is(varint.decode(chunks[0]), MultihashIndexSortedWriter.codec)

  await closePromise
})

test('reads an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = MultihashIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  /** @type {import('multiformats').CID[]} */
  const cids = []

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset } of indexer) {
      cids.push(cid)
      await writer.add(cid, offset)
    }
    await writer.close()
  })

  const reader = MultihashIndexSortedReader.createReader({ reader: readable.getReader() })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const { multihash, digest, offset } = value
    const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${CID.createV1(raw.code, multihash)} (aka ${cids[i]}) @ ${offset}`)
    cids.splice(i, 1)
  }

  t.is(cids.length, 0)

  await closePromise
})

test.only('reads an index (streams)', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = MultihashIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  /** @type {import('multiformats').CID[]} */
  const cids = []

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset } of indexer) {
      cids.push(cid)
      await writer.add(cid, offset)
    }
    await writer.close()
  })

  await readable
    .pipeThrough(new MultihashIndexSortedReaderStream())
    .pipeTo(new WritableStream({
      write ({ multihash, digest, offset }) {
        const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
        t.true(i >= 0, `CID with digest ${digest} not found`)
        console.log(`${CID.createV1(raw.code, multihash)} (aka ${cids[i]}) @ ${offset}`)
        cids.splice(i, 1)
      }
    }))

  t.is(cids.length, 0)

  await closePromise
})
