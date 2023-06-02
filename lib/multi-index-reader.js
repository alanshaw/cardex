import { CID } from 'multiformats/cid'
import { MULTI_INDEX_CODEC } from './codecs.js'
import { BytesReader } from './reader/bytes-reader.js'
import { readVarint, readUint32LE, readMultihash, peekVarint } from './decoder.js'

/**
 * @typedef {{
 *   started: boolean
 *   carsCount: number
 *   carIndex: number
 *   car: import('./api').CARLink|null
 *   index: import('./api').IndexReader|null
 *   done: boolean
 * } & import('./api').ReaderState} MultiIndexReaderState
 * @typedef {import('./api').IndexItem & { origin: import('./api').CARLink }} MultiIndexItem
 */

/** @returns {MultiIndexReaderState} */
const init = () => ({
  started: false,
  carsCount: 0,
  carIndex: 0,
  car: null,
  index: null,
  done: false,
  bytesReader: BytesReader.init()
})

/**
 * @param {{ readable: import('./reader/api').Readable<Uint8Array>, indexReaders: import('./api').IndexReaderFactory[] }} config
 */
export const createReader = ({ readable, indexReaders }) =>
  new MultiIndexReader({ reader: readable.getReader(), state: init(), indexReaders })

/**
 * @template {{ state: MultiIndexReaderState, reader: import('./reader/api').Reader<Uint8Array>, indexReaders: import('./api').IndexReaderFactory[] }} View
 * @param {View} view
 * @returns {Promise<import('./reader/api').ReadResult<MultiIndexItem>>}
 */
export const read = async ({ state, reader, indexReaders }) => {
  if (state.done) return { done: true }

  const bytesReader = new BytesReader({ reader, state: state.bytesReader })
  if (!state.started) {
    const codec = await readVarint(bytesReader)
    if (codec !== MULTI_INDEX_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }
    state.started = true
    state.carsCount = await readUint32LE(bytesReader)
    state.carIndex = 0
    state.car = CID.createV1(0x0202, await readMultihash(bytesReader))
    const indexCodec = await peekVarint(bytesReader)
    const factory = indexReaders.find(r => r.codec === indexCodec)
    if (!factory) throw new Error(`missing index reader: 0x${indexCodec.toString(16)}`)
    state.index = factory.createReader({ reader, state: { bytesReader: state.bytesReader } })
  }

  if (!state.car || !state.index) {
    throw new Error('invalid state')
  }

  const result = await state.index.read()
  if (result.done) {
    state.carIndex++
    if (state.carIndex >= state.carsCount) {
      return { done: true }
    }
    state.car = CID.createV1(0x0202, await readMultihash(bytesReader))
    const indexCodec = await peekVarint(bytesReader)
    const factory = indexReaders.find(r => r.codec === indexCodec)
    if (!factory) throw new Error(`missing index reader: 0x${indexCodec.toString(16)}`)
    state.index = factory.createReader({ reader, state: { bytesReader: state.bytesReader } })
    return read({ state, reader, indexReaders })
  }

  return { done: false, value: { origin: state.car, ...result.value } }
}

/**
 * @template {{ state: MultiIndexReaderState, reader: import('./reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} reason
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class MultiIndexReader {
  /**
   * @param {{ reader: import('./reader/api').Reader<Uint8Array>, state: MultiIndexReaderState, indexReaders: import('./api').IndexReaderFactory<any, any>[] }} config
   */
  constructor ({ reader, state, indexReaders }) {
    this.reader = reader
    this.state = state
    this.indexReaders = indexReaders
  }

  read () {
    return read(this)
  }

  /** @param {any} reason */
  cancel (reason) {
    return cancel(this, reason)
  }
}
