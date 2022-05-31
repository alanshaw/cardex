import test from 'ava'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import varint from 'varint'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { Buffer } from 'buffer'
import { CID } from 'multiformats'
import { MultihashIndexSortedReader, MultihashIndexSortedWriter, MULTIHASH_INDEX_SORTED_CODEC } from '../mh-index-sorted.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const carPath = path.join(__dirname, 'fixtures', 'bafybeicpxveeln3sd4scqlacrunxhzmvslnbgxa72evmqg7r27emdek464.car')

const collect = async it => {
  const chunks = []
  for await (const chunk of it) {
    chunks.push(chunk)
  }
  return chunks
}

test('creates an index', async t => {
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
    console.log(`${CID.createV0(multihash)} @ ${offset}`)
    cids.splice(i, 1)
  }

  await closePromise
})
