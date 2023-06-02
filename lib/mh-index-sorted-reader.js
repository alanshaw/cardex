import { create as createMultihash } from 'multiformats/hashes/digest'
import { readUint32LE, readUint64LE, readVarint } from './decoder.js'
import { BytesReader } from './reader/bytes-reader.js'
import { MULTIHASH_INDEX_SORTED_CODEC } from './codecs.js'

/**
 * @typedef {{
 *  started: boolean
*  codesCount: number
*  codesIndex: number
*  code: number
*  bucketsCount: number
*  bucketIndex: number
*  width: number
*  itemsCount: number
*  itemIndex: number
*  done: boolean
* } & import('./api').ReaderState} MultihashIndexSortedReaderState
 * @typedef {import('./api').IndexItem & { multihash: import('multiformats').MultihashDigest }} MultihashIndexItem
 */

export const codec = MULTIHASH_INDEX_SORTED_CODEC

/**
 * @param {{ state?: import('./api').ReaderState }} config
 * @returns {MultihashIndexSortedReaderState}
 */
const init = config => {
  return {
    started: false,
    codesCount: 0,
    codesIndex: 0,
    code: 0,
    bucketsCount: 0,
    bucketIndex: 0,
    width: 0,
    itemsCount: 0,
    itemIndex: 0,
    done: false,
    bytesReader: config.state?.bytesReader ?? BytesReader.init()
  }
}

/**
 * @param {{ reader: import('./reader/api').Reader<Uint8Array>, state?: import('./api').ReaderState }} config
 * @returns {import('./api').IndexReader<MultihashIndexSortedReaderState, MultihashIndexItem>}
 */
export const createReader = ({ reader, state }) =>
  new MultihashIndexSortedReader({ reader, state: init({ state }) })

/**
 * @template {{ state: MultihashIndexSortedReaderState, reader: import('./reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @returns {Promise<import('./reader/api').ReadResult<MultihashIndexItem>>}
 */
export const read = async ({ reader, state }) => {
  if (state.done) return { done: true }

  const bytesReader = new BytesReader({ reader, state: state.bytesReader })
  if (!state.started) {
    const codec = await readVarint(bytesReader)
    if (codec !== MULTIHASH_INDEX_SORTED_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }
    state.started = true
    state.codesCount = await readUint32LE(bytesReader)
    state.codesIndex = 0
    state.code = await readUint64LE(bytesReader)
    state.bucketsCount = await readUint32LE(bytesReader)
    state.bucketIndex = 0
    state.width = await readUint32LE(bytesReader)
    const length = await readUint64LE(bytesReader)
    state.itemsCount = length / state.width
    state.itemIndex = 0
  }

  // Read next item
  const digest = await bytesReader.exactly(state.width - 8)
  bytesReader.seek(state.width - 8)
  const offset = await readUint64LE(bytesReader)
  const item = /** @type {MultihashIndexItem} */({ multihash: createMultihash(state.code, digest), digest, offset })

  state.itemIndex++
  if (state.itemIndex >= state.itemsCount) {
    state.bucketIndex++
    if (state.bucketIndex >= state.bucketsCount) {
      state.codesIndex++
      if (state.codesIndex >= state.codesCount) {
        state.done = true
        return { done: false, value: item }
      }
      state.code = await readUint64LE(bytesReader)
      state.bucketsCount = await readUint32LE(bytesReader)
      state.bucketIndex = 0
    }
    state.width = await readUint32LE(bytesReader)
    const length = await readUint64LE(bytesReader)
    state.itemsCount = length / state.width
    state.itemIndex = 0
  }

  return { done: false, value: item }
}

/**
 * @template {{ state: MultihashIndexSortedReaderState, reader: import('./reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} reason
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class MultihashIndexSortedReader {
  /** @param {{ reader: import('./reader/api').Reader<Uint8Array>, state: MultihashIndexSortedReaderState }} config */
  constructor ({ reader, state }) {
    this.reader = reader
    this.state = state
  }

  read () {
    return read(this)
  }

  /** @param {any} reason */
  cancel (reason) {
    return cancel(this, reason)
  }
}
