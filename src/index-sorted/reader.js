import { readUint32LE, readUint64LE, readVarint } from '../decoder.js'
import { BytesReader } from '../bytes-reader.js'
import { INDEX_SORTED_CODEC } from './codec.js'

export const codec = INDEX_SORTED_CODEC

/**
 * @param {{ state?: import('../api').ReaderState }} config
 * @returns {import('./api').IndexSortedReaderState}
 */
const init = config => {
  return {
    started: false,
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
 * @param {{ reader: import('../reader/api').Reader<Uint8Array>, state?: import('../api').ReaderState }} config
 * @returns {import('../api').IndexReader<import('./api').IndexSortedReaderState, import('../api').IndexItem>}
 */
export const createReader = ({ reader, state }) =>
  new IndexSortedReader({ reader, state: init({ state }) })

/**
 * @template {{ state: import('./api').IndexSortedReaderState, reader: import('../reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @returns {Promise<import('../reader/api').ReadResult<import('../api').IndexItem>>}
 */
export const read = async ({ reader, state }) => {
  if (state.done) return { done: true }

  const bytesReader = new BytesReader({ reader, state: state.bytesReader })
  if (!state.started) {
    const codec = await readVarint(bytesReader)
    if (codec !== INDEX_SORTED_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }
    state.started = true
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
  const item = /** @type {import('../api').IndexItem} */({ digest, offset })

  state.itemIndex++
  if (state.itemIndex >= state.itemsCount) {
    state.bucketIndex++
    if (state.bucketIndex >= state.bucketsCount) {
      state.done = true
      return { done: false, value: item }
    }
    state.width = await readUint32LE(bytesReader)
    const length = await readUint64LE(bytesReader)
    state.itemsCount = length / state.width
    state.itemIndex = 0
  }

  return { done: false, value: item }
}

/**
 * @template {{ state: import('./api').IndexSortedReaderState, reader: import('../reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} [reason]
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class IndexSortedReader {
  /** @param {{ reader: import('../reader/api').Reader<Uint8Array>, state: import('./api').IndexSortedReaderState }} config */
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
