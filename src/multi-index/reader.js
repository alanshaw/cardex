import { CID } from 'multiformats/cid'
import * as MultihashIndexSortedReader from '../mh-index-sorted/reader.js'
import { MULTI_INDEX_CODEC } from './codec.js'
import { BytesReader } from '../bytes-reader.js'
import { peekVarint, readVarint, readMultihash } from '../decoder.js'

export const codec = MULTI_INDEX_CODEC

/**
 * @param {{ state?: import('../api').ReaderState }} config
 * @returns {import('./api').MultiIndexReaderState}
 */
const init = config => ({
  started: false,
  carsCount: 0,
  carIndex: 0,
  car: null,
  index: null,
  done: false,
  bytesReader: config.state?.bytesReader ?? BytesReader.init(),
  indexReaders: new Map([[MultihashIndexSortedReader.codec, MultihashIndexSortedReader]])
})

/**
 * @param {{ reader: import('../reader/api').Reader<Uint8Array>, state?: import('../api').ReaderState }} config
 */
export const createReader = ({ reader, state }) =>
  new MultiIndexReader({ reader, state: init({ state }) })

/**
 * @template {import('../api').ReaderState} S
 * @template {import('../api').IndexItem} V
 * @template {{ state: import('./api').MultiIndexReaderState }} View
 * @param {View} view
 * @param {import('./api').IndexReaderFactory<S, V>} factory
 */
export const add = ({ state }, factory) => {
  state.indexReaders.set(factory.codec, factory)
}

/**
 * @template {{ state: import('./api').MultiIndexReaderState, reader: import('../reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @returns {Promise<import('../reader/api').ReadResult<import('./api').MultiIndexItem>>}
 */
export const read = async ({ state, reader }) => {
  if (state.done) return { done: true }

  const bytesReader = new BytesReader({ reader, state: state.bytesReader })
  if (!state.started) {
    const codec = await readVarint(bytesReader)
    if (codec !== MULTI_INDEX_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }
    state.started = true
    state.carsCount = await readVarint(bytesReader)
    state.carIndex = 0
    state.car = CID.createV1(0x0202, await readMultihash(bytesReader))
    const indexCodec = await peekVarint(bytesReader)
    const factory = state.indexReaders.get(indexCodec)
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
    const factory = state.indexReaders.get(indexCodec)
    if (!factory) throw new Error(`missing index reader: 0x${indexCodec.toString(16)}`)
    state.index = factory.createReader({ reader, state: { bytesReader: state.bytesReader } })
    return read({ state, reader })
  }

  return { done: false, value: { origin: state.car, ...result.value } }
}

/**
 * @template {{ state: import('./api').MultiIndexReaderState, reader: import('../reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 * @param {any} [reason]
 */
export const cancel = ({ state, reader }, reason) => {
  state.done = true
  return reader.cancel(reason)
}

class MultiIndexReader {
  /**
   * @param {{ reader: import('../reader/api').Reader<Uint8Array>, state: import('./api').MultiIndexReaderState }} config
   */
  constructor ({ reader, state }) {
    this.reader = reader
    this.state = state
  }

  /**
   * Add an index reader implementation.
   * @template {import('../api').ReaderState} S
   * @template {import('../api').IndexItem} V
   * @param {import('./api').IndexReaderFactory<S, V>} factory
   */
  add (factory) {
    add(this, factory)
    return this
  }

  read () {
    return read(this)
  }

  /** @param {any} [reason] */
  cancel (reason) {
    return cancel(this, reason)
  }
}
