import { compare } from 'uint8arrays'
import { encodeUint32LE, encodeVarint } from '../encoder.js'
import { MULTI_INDEX_CODEC } from './codec.js'

export const codec = MULTI_INDEX_CODEC

/**
 * @param {{ writer: import('../writer/api').Writer<Uint8Array> }} config
 */
export const createWriter = ({ writer }) =>
  new MultiIndexWriter({ writer })

/**
 * @template {{ state: import('./api').MultiIndexWriterState }} View
 * @param {View} view
 * @param {import('../api').CARLink} cid
 * @param {import('./api').WriterReceiver} builder
 */
export const add = ({ state }, cid, builder) =>
  state.builders.push({ cid, builder })

/**
 * @template {{ state: import('./api').MultiIndexWriterState, writer: import('../writer/api').Writer<Uint8Array> }} View
 * @param {View} view
 * @param {import('../api').CloseOptions} [options]
 */
export const close = async ({ state, writer }, options) => {
  await writer.write(encodeVarint(MULTI_INDEX_CODEC))
  await writer.write(encodeUint32LE(state.builders.length))

  state.builders.sort((a, b) => compare(a.cid.multihash.digest, b.cid.multihash.digest))

  for (const { cid, builder } of state.builders) {
    await writer.write(cid.multihash.bytes)
    await builder({ writer: new NonClosingWriter(writer) })
  }

  if (options?.closeWriter ?? true) {
    await writer.close()
  } else if (options?.releaseLock ?? true) {
    writer.releaseLock()
  }
}

class MultiIndexWriter {
  /**
   * @param {object} config
   * @param {import('../writer/api').Writer<Uint8Array>} config.writer
   */
  constructor ({ writer }) {
    this.writer = writer
    /** @type {import('./api').MultiIndexWriterState} */
    this.state = { builders: [] }
  }

  /**
   * @param {import('../api').CARLink} cid
   * @param {import('./api').WriterReceiver} builder
   */
  add = (cid, builder) => {
    add(this, cid, builder)
    return this
  }

  /** @param {import('../api').CloseOptions} [options] */
  close (options) {
    return close(this, options)
  }
}

/** A writer that doesn't close it's underlying writer when requested. */
class NonClosingWriter {
  #writer

  /** @param {import('../writer/api').Writer<Uint8Array>} writer */
  constructor (writer) {
    this.#writer = writer
  }

  get desiredSize () {
    return this.#writer.desiredSize
  }

  get ready () {
    return this.#writer.ready
  }

  /** @param {Uint8Array} data */
  write (data) {
    return this.#writer.write(data)
  }

  /** @param {Error} reason */
  abort (reason) {
    return this.#writer.abort(reason)
  }

  close () {}
  releaseLock () {}
}
