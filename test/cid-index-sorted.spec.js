/* global TransformStream */
import test from 'ava'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { blake2b256 } from '@multiformats/blake2/blake2b'
import { equals } from 'multiformats/bytes'
import { CIDIndexSortedReader, CIDIndexSortedWriter } from '../src/cid-index-sorted/index.js'
import { collect } from './helpers/collect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = CIDIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, blockOffset, blockLength } of indexer) {
      await writer.add({ cid, offset: blockOffset, length: blockLength })
    }
    await writer.close()
  })

  const chunks = await collect(readable)
  t.is(varint.decode(chunks[0]), CIDIndexSortedWriter.codec)

  await closePromise
})

test('reads an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = CIDIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  /** @type {import('multiformats').UnknownLink[]} */
  const cids = []

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, blockOffset, blockLength } of indexer) {
      cids.push(cid)
      await writer.add({ cid, offset: blockOffset, length: blockLength })
    }
    await writer.close()
  })

  const reader = CIDIndexSortedReader.createReader({ reader: readable.getReader() })

  const handle = await fs.promises.open(carPath)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const { cid, offset, length } = value
    const i = cids.findIndex(c => c.toString() === cid.toString())
    t.true(i >= 0, `CID ${cid} not found in: ${cids}`)
    console.log(`${cid} @ ${offset} => ${offset + length}`)
    cids.splice(i, 1)

    // check offset/length corresponds to actual block bytes
    const { buffer } = await handle.read({
      buffer: new Uint8Array(length),
      position: offset,
      length
    })
    const hash = await getHasher(cid).digest(buffer)
    t.true(equals(hash.digest, cid.multihash.digest))
  }

  await closePromise
})

/** @param {import('multiformats').UnknownLink} cid */
const getHasher = cid => {
  switch (cid.multihash.code) {
    case sha256.code: return sha256
    case sha512.code: return sha512
    case blake2b256.code: return blake2b256
  }
  throw new Error(`unknown hasher: 0x${cid.multihash.code.toString(16)}`)
}
