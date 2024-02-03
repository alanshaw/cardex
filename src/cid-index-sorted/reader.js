import { create as createMultihash } from 'multiformats/hashes/digest'
import { create as createLink, createLegacy as createLegacyLink } from 'multiformats/link'
import { readUint32LE, readUint64LE, readUint8, readVarint } from '../decoder.js'
import { BytesReader } from '../bytes-reader.js'
import { CID_INDEX_SORTED_CODEC } from './codec.js'

export const codec = CID_INDEX_SORTED_CODEC

/**
 * @param {{ state?: import('../api.js').ReaderState }} config
 * @returns {import('./api.js').CIDIndexSortedReaderState}
 */
const init = config => {
  return {
    started: false,
    versionsCount: 0,
    versionsIndex: 0,
    version: 0,
    codesCount: 0,
    codesIndex: 0,
    code: 0,
    mhCodesCount: 0,
    mhCodesIndex: 0,
    mhCode: 0,
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
 * @returns {import('../api.js').IndexReader<import('./api.js').CIDIndexSortedReaderState, import('./api.js').CIDIndexItem>}
 */
export const createReader = ({ reader, state }) =>
  new CIDIndexSortedReader({ reader, state: init({ state }) })

/**
 * @template {{ state: import('./api.js').CIDIndexSortedReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 * @returns {Promise<import('../reader/api.js').ReadResult<import('./api.js').CIDIndexItem>>}
 */
export const read = async ({ reader, state }) => {
  if (state.done) return { done: true }

  const bytesReader = new BytesReader({ reader, state: state.bytesReader })
  if (!state.started) {
    const codec = await readVarint(bytesReader)
    if (codec !== CID_INDEX_SORTED_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }
    state.started = true
    state.versionsCount = await readUint8(bytesReader)
    state.versionsIndex = 0
    state.version = await readUint8(bytesReader)

    state.codesCount = await readUint32LE(bytesReader)
    state.codesIndex = 0
    state.code = await readUint64LE(bytesReader)

    state.mhCodesCount = await readUint32LE(bytesReader)
    state.mhCodesIndex = 0
    state.mhCode = await readUint64LE(bytesReader)

    state.bucketsCount = await readUint32LE(bytesReader)
    state.bucketIndex = 0
    state.width = await readUint32LE(bytesReader)
    const length = await readUint64LE(bytesReader)
    state.itemsCount = length / state.width
    state.itemIndex = 0
  }

  // Read next item
  const digest = await bytesReader.exactly(state.width - 16)
  bytesReader.seek(state.width - 16)
  const offset = await readUint64LE(bytesReader)
  const length = await readUint64LE(bytesReader)
  /** @type {import('./api.js').CIDIndexItem} */
  const item = {
    cid: state.version === 0
      // @ts-expect-error multihash is not necessarily sha256
      ? createLegacyLink(createMultihash(state.mhCode, digest))
      : createLink(state.code, createMultihash(state.mhCode, digest)),
    offset,
    length
  }

  state.itemIndex++
  if (state.itemIndex >= state.itemsCount) {
    state.bucketIndex++
    if (state.bucketIndex >= state.bucketsCount) {
      state.mhCodesIndex++
      if (state.mhCodesIndex >= state.mhCodesCount) {
        state.codesIndex++
        if (state.codesIndex >= state.codesCount) {
          state.versionsIndex++
          if (state.versionsIndex >= state.versionsCount) {
            state.done = true
            return { done: false, value: item }
          }
          state.version = await readUint8(bytesReader)
          state.codesCount = await readUint32LE(bytesReader)
          state.codesIndex = 0
        }
        state.code = await readUint64LE(bytesReader)
        state.mhCodesCount = await readUint32LE(bytesReader)
        state.mhCodesIndex = 0
      }
      state.mhCode = await readUint64LE(bytesReader)
      state.bucketsCount = await readUint32LE(bytesReader)
      state.bucketIndex = 0
    }
    state.width = await readUint32LE(bytesReader)
    state.itemsCount = (await readUint64LE(bytesReader)) / state.width
    state.itemIndex = 0
  }

  return { done: false, value: item }
}

/**
 * @template {{ state: import('./api.js').CIDIndexSortedReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} [reason]
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class CIDIndexSortedReader {
  /** @param {{ reader: import('../reader/api.js').Reader<Uint8Array>, state: import('./api.js').CIDIndexSortedReaderState }} config */
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
