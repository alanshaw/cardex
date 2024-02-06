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
import { RangeIndexSortedReader, RangeIndexSortedWriter } from '../src/range-index-sorted/index.js'
import { collect } from './helpers/collect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('creates an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = RangeIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset, blockOffset, blockLength } of indexer) {
      await writer.add({
        multihash: cid.multihash,
        offset,
        bytesOffset: blockOffset,
        bytesLength: blockLength
      })
    }
    await writer.close()
  })

  const chunks = await collect(readable)
  t.is(varint.decode(chunks[0]), RangeIndexSortedWriter.codec)

  await closePromise
})

test('reads an index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const carStream = fs.createReadStream(carPath)
  const indexer = await CarIndexer.fromIterable(carStream)
  const { readable, writable } = new TransformStream()
  const writer = RangeIndexSortedWriter.createWriter({ writer: writable.getWriter() })

  /** @type {import('multiformats').UnknownLink[]} */
  const cids = []

  const closePromise = t.notThrowsAsync(async () => {
    for await (const { cid, offset, blockOffset, blockLength } of indexer) {
      cids.push(cid)
      await writer.add({
        multihash: cid.multihash,
        offset,
        bytesOffset: blockOffset,
        bytesLength: blockLength
      })
    }
    await writer.close()
  })

  const reader = RangeIndexSortedReader.createReader({ reader: readable.getReader() })

  const handle = await fs.promises.open(carPath)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const { multihash, offset, bytesOffset, bytesLength } = value
    const i = cids.findIndex(cid => equals(cid.multihash.digest, multihash.digest))
    t.true(i >= 0, `CID with digest ${multihash.digest} not found in: ${cids}`)
    console.log(`${cids[i]} @ ${offset} (bytes ${bytesOffset} => ${bytesOffset + bytesLength})`)
    cids.splice(i, 1)

    // check offset/length corresponds to actual block bytes
    const { buffer } = await handle.read({
      buffer: new Uint8Array(bytesLength),
      position: bytesOffset,
      length: bytesLength
    })
    const hash = await getHasher(multihash).digest(buffer)
    t.true(equals(hash.digest, multihash.digest))
  }

  await closePromise
})

/** @param {import('multiformats').MultihashDigest} multihash */
const getHasher = multihash => {
  switch (multihash.code) {
    case sha256.code: return sha256
    case sha512.code: return sha512
    case blake2b256.code: return blake2b256
  }
  throw new Error(`unknown hasher: 0x${multihash.code.toString(16)}`)
}
