import { encodeUint32LE, encodeVarint } from './encoder.js'
import { MULTI_INDEX_CODEC } from './codecs.js'

/**
 * @typedef {{ capacityUsed: number }} MultiIndexWriterState
 */

/**
 * @param {{ writable: import('./writer/api').Writable<Uint8Array>, capacity: number }} config
 */
export const createWriter = ({ writable, capacity }) =>
  new MultiIndexWriter({ writer: writable.getWriter(), capacity })

/**
 * @template S
 * @template {{ state: MultiIndexWriterState, writer: import('./writer/api').Writer<Uint8Array>, capacity: number }} View
 * @param {View} view
 * @param {import('./api').CARLink} car
 * @param {import('./api').IndexWriterFactory<S>} factory
 */
export const createIndexWriter = ({ state, writer, capacity }, car, factory) => {
  state.capacityUsed++
  if (state.capacityUsed > capacity) throw new Error('over capacity')
  writer.write(car.multihash.bytes)
  return factory.createWriter({ writer })
}

/**
 * @template {{ state: MultiIndexWriterState, writer: import('./writer/api').Writer<Uint8Array>, capacity: number }} View
 * @param {View} view
 * @param {import('./api').CloseOptions} [options]
 */
export const close = async ({ state, writer, capacity }, options) => {
  if (state.capacityUsed < capacity) throw new Error('under capacity')
  if (options?.closeWriter ?? true) {
    await writer.close()
  } else if (options?.releaseLock ?? true) {
    writer.releaseLock()
  }
}

class MultiIndexWriter {
  /**
   * @param {object} config
   * @param {import('./writer/api').Writer<Uint8Array>} config.writer
   * @param {number} config.capacity
   */
  constructor ({ writer, capacity }) {
    // this.writer = prefixWriter(prefixWriter(writer, encodeUint32LE(capacity)), encodeVarint(MULTI_INDEX_CODEC))
    writer.write(encodeVarint(MULTI_INDEX_CODEC))
    writer.write(encodeUint32LE(capacity))
    this.writer = writer
    this.capacity = capacity
    /** @type {MultiIndexWriterState} */
    this.state = { capacityUsed: 0 }
  }

  /**
   * @template S
   * @param {import('./api').CARLink} car
   * @param {import('./api').IndexWriterFactory<S>} factory
   */
  createIndexWriter = (car, factory) => createIndexWriter(this, car, factory)

  /** @param {import('./api').CloseOptions} [options] */
  close (options) {
    return close(this, options)
  }
}

/**
 * @param {import('./writer/api').Writer<Uint8Array>} writer
 * @param {Uint8Array} prefix
 */
// const prefixWriter = (writer, prefix) => {
//   const write = writer.write.bind(writer)
//   let written = false
//   writer.write = bytes => {
//     if (!written) {
//       written = true
//       write(prefix)
//     }
//     return write(bytes)
//   }
//   return writer
// }
