import { create as createMultihash } from 'multiformats/hashes/digest'
import { readUint32LE, readUint64LE, readVarint } from '../decoder.js'
import { BytesReader } from '../bytes-reader.js'
import { RANGE_INDEX_SORTED_CODEC } from './codec.js'

export const codec = RANGE_INDEX_SORTED_CODEC

/**
 * @param {{ state?: import('../api.js').ReaderState }} config
 * @returns {import('./api.js').RangeIndexSortedReaderState}
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
 * @param {{ reader: import('../reader/api.js').Reader<Uint8Array>, state?: import('../api.js').ReaderState }} config
 * @returns {import('../api.js').IndexReader<import('./api.js').RangeIndexSortedReaderState, import('./api.js').RangeIndexItem>}
 */
export const createReader = ({ reader, state }) =>
  new RangeIndexSortedReader({ reader, state: init({ state }) })

/**
 * @template {{ state: import('./api.js').RangeIndexSortedReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 * @returns {Promise<import('../reader/api.js').ReadResult<import('./api.js').RangeIndexItem>>}
 */
export const read = async ({ reader, state }) => {
  if (state.done) return { done: true }

  const bytesReader = new BytesReader({ reader, state: state.bytesReader })
  if (!state.started) {
    const codec = await readVarint(bytesReader)
    if (codec !== RANGE_INDEX_SORTED_CODEC) {
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
  const digest = await bytesReader.exactly(state.width - 24)
  bytesReader.seek(state.width - 24)
  const offset = await readUint64LE(bytesReader)
  const bytesOffset = await readUint64LE(bytesReader)
  const bytesLength = await readUint64LE(bytesReader)
  const multihash = createMultihash(state.code, digest)
  const item = { multihash, offset, bytesOffset, bytesLength }

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
 * @template {{ state: import('./api.js').RangeIndexSortedReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} [reason]
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class RangeIndexSortedReader {
  /** @param {{ reader: import('../reader/api.js').Reader<Uint8Array>, state: import('./api.js').RangeIndexSortedReaderState }} config */
  constructor ({ reader, state }) {
    this.reader = reader
    this.state = state
  }

  read () {
    return read(this)
  }

  /** @param {any} [reason] */
  cancel (reason) {
    return cancel(this, reason)
  }
}
