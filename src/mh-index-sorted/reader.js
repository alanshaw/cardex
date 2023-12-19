/* global TransformStream */
import { create as createMultihash } from 'multiformats/hashes/digest'
import { Uint8ArrayList } from 'uint8arraylist'
import { readUint32LE, readUint64LE, readVarint } from '../decoder.js'
import { BytesReader } from '../bytes-reader.js'
import { MULTIHASH_INDEX_SORTED_CODEC } from './codec.js'
import { decode as decodeVarint } from '../lib/varint.js'

export const codec = MULTIHASH_INDEX_SORTED_CODEC

/**
 * @param {{ state?: import('../api.js').ReaderState }} config
 * @returns {import('./api.js').MultihashIndexSortedReaderState}
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
 * @returns {import('../api.js').IndexReader<import('./api.js').MultihashIndexSortedReaderState, import('./api.js').MultihashIndexItem>}
 */
export const createReader = ({ reader, state }) =>
  new MultihashIndexSortedReader({ reader, state: init({ state }) })

/**
 * @template {{ state: import('./api.js').MultihashIndexSortedReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 * @returns {Promise<import('../reader/api.js').ReadResult<import('./api.js').MultihashIndexItem>>}
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
  const item = /** @type {import('./api.js').MultihashIndexItem} */({ multihash: createMultihash(state.code, digest), digest, offset })

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
 * @template {{ state: import('./api.js').MultihashIndexSortedReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} [reason]
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class MultihashIndexSortedReader {
  /** @param {{ reader: import('../reader/api.js').Reader<Uint8Array>, state: import('./api.js').MultihashIndexSortedReaderState }} config */
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

const State = {
  ReadIndexCodec: 0,
  ReadCodesCount: 1,
  ReadCode: 2,
  ReadBucketsCount: 3,
  ReadItemsWidth: 4,
  ReadItemsLength: 5,
  ReadItemDigest: 6,
  ReadItemOffset: 7,
  EndItem: 8,
  EndBucket: 9,
  EndCode: 10,
  End: 11
}

/** @extends {TransformStream<Uint8Array, import('./api').MultihashIndexItem>} */
export class MultihashIndexSortedReaderStream extends TransformStream {
  /**
   * @param {QueuingStrategy<Uint8Array>} [writableStrategy]
   * @param {QueuingStrategy<import('./api').MultihashIndexItem>} [readableStrategy]
   */
  constructor (writableStrategy, readableStrategy) {
    const buffer = new Uint8ArrayList()
    let state = State.ReadIndexCodec
    let wanted = 8

    let codeCount = 0
    let codeIndex = 0
    /** @type {number?} */
    let code = null
    let bucketCount = 0
    let bucketIndex = 0
    let itemWidth = 0
    let itemCount = 0
    let itemIndex = 0
    /** @type {import('multiformats/hashes/digest').Digest<number, number>?} */
    let digest = null

    super({
      transform (chunk, controller) {
        if (state === State.End) throw new Error('write after end')
        buffer.append(chunk)
        while (true) {
          if (buffer.length < wanted) break
          if (state === State.ReadIndexCodec) {
            const [codec, length] = decodeVarint(buffer)
            if (codec !== MULTIHASH_INDEX_SORTED_CODEC) {
              throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
            }
            buffer.consume(length)
            state = State.ReadCodesCount
            wanted = 4
          } else if (state === State.ReadCodesCount) {
            codeCount = buffer.getUint32(0, true)
            codeIndex = 0
            buffer.consume(4)
            if (codeCount === 0) {
              state = State.EndCode
              wanted = 0
            } else {
              state = State.ReadCode
              wanted = 8
            }
          } else if (state === State.ReadCode) {
            code = Number(buffer.getBigUint64(0, true))
            buffer.consume(8)
            state = State.ReadBucketsCount
            wanted = 4
          } else if (state === State.ReadBucketsCount) {
            bucketCount = buffer.getUint32(0, true)
            bucketIndex = 0
            buffer.consume(4)
            if (bucketCount === 0) {
              state = State.EndBucket
              wanted = 0
            } else {
              state = State.ReadItemsWidth
              wanted = 4
            }
          } else if (state === State.ReadItemsWidth) {
            itemWidth = buffer.getUint32(0, true)
            buffer.consume(4)
            state = State.ReadItemsLength
            wanted = 8
          } else if (state === State.ReadItemsLength) {
            itemCount = Number(buffer.getBigUint64(0, true) / BigInt(itemWidth))
            itemIndex = 0
            buffer.consume(8)
            if (itemCount === 0) {
              state = State.EndItem
              wanted = 0
            } else {
              state = State.ReadItemDigest
              wanted = itemWidth - 8
            }
          } else if (state === State.ReadItemDigest) {
            // @ts-expect-error code will be non-null
            digest = createMultihash(code, buffer.subarray(0, itemWidth - 8))
            buffer.consume(itemWidth - 8)
            state = State.ReadItemOffset
            wanted = 8
          } else if (state === State.ReadItemOffset) {
            // TODO: this is fine
            const offset = Number(buffer.getBigUint64(0, true))
            // @ts-expect-error digest will be non-null
            controller.enqueue({ multihash: digest, digest: digest.digest, offset })
            buffer.consume(8)
            state = State.EndItem
            wanted = 0
          } else if (state === State.EndItem) {
            itemIndex++
            if (itemIndex < itemCount) {
              state = State.ReadItemDigest
              wanted = itemWidth - 8
            } else {
              state = State.EndBucket
              wanted = 0
            }
          } else if (state === State.EndBucket) {
            bucketIndex++
            if (bucketIndex < bucketCount) {
              state = State.ReadItemsWidth
              wanted = 4
            } else {
              state = State.EndCode
              wanted = 0
            }
          } else if (state === State.EndCode) {
            codeIndex++
            if (codeIndex < codeCount) {
              state = State.ReadCode
              wanted = 8
            } else {
              state = State.End
              wanted = 0
            }
          } else if (state === State.End) {
            break
          } else {
            throw new Error(`unknown state: ${state}`)
          }
        }
      }
    }, writableStrategy, readableStrategy)
  }
}
