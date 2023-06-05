/* global TransformStream */
import test from 'ava'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CarIndexer } from '@ipld/car/indexer'
import { equals } from 'uint8arrays'
import { CID } from 'multiformats'
import * as raw from 'multiformats/codecs/raw'
import { MultihashIndexSortedWriter } from '../src/index.js'
import { MultiIndexWriter } from '../src/multi-index/index.js'
import { UniversalReader } from '../src/universal/index.js'
import * as CAR from './helpers/car.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

  const reader = UniversalReader.createReader({ reader: readable.getReader() })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!('multihash' in value)) throw new Error('did not return a MultihashIndexSorted item')
    const { multihash, digest, offset } = value
    const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${CID.createV1(raw.code, multihash)} (aka ${cids[i]}) @ ${offset}`)
    cids.splice(i, 1)
  }

  await closePromise
})

test('reads a multi-index', async t => {
  const carPath = path.join(__dirname, 'fixtures', 'QmQRE4diFXfUjLfZREuzfMzWPJiQddaYBnoLjqUP1y7upn.car')
  const { readable, writable } = new TransformStream()
  const writer = MultiIndexWriter.createWriter({ writer: writable.getWriter() })

  /** @type {import('multiformats').CID[]} */
  const cids = []

  const carCID = await CAR.createCID(await fs.promises.readFile(carPath))
  writer.add(carCID, async ({ writer }) => {
    const carStream = fs.createReadStream(carPath)
    const indexer = await CarIndexer.fromIterable(carStream)
    const index = MultihashIndexSortedWriter.createWriter({ writer })
    await t.notThrowsAsync(async () => {
      for await (const { cid, offset } of indexer) {
        cids.push(cid)
        await index.add(cid, offset)
      }
      await index.close()
    })
  })
  const closePromise = writer.close()

  const reader = UniversalReader.createReader({ reader: readable.getReader() })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!('multihash' in value)) throw new Error('did not return a MultihashIndexSorted item')
    const { multihash, digest, offset } = value
    const i = cids.findIndex(cid => equals(cid.multihash.digest, digest))
    t.true(i >= 0, `CID with digest ${digest} not found`)
    console.log(`${CID.createV1(raw.code, multihash)} (aka ${cids[i]}) @ ${offset}`)
    cids.splice(i, 1)
  }

  await closePromise
})
