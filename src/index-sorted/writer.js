import { compare } from 'uint8arrays/compare'
import { writeUint32LE, writeUint64LE, writeVarint } from '../encoder.js'
import { INDEX_SORTED_CODEC } from './codec.js'

export const codec = INDEX_SORTED_CODEC

/**
 * @template {{ writer: import('../writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @returns {import('../api.js').IndexWriter<import('./api.js').IndexSortedWriterState>}
 */
export const createWriter = ({ writer }) =>
  new IndexSortedWriter({ writer })

/**
 * @template {{ state: import('./api.js').IndexSortedWriterState }} View
 * @param {View} view
 * @param {import('multiformats').UnknownLink} cid
 * @param {number} offset
 */
export const add = ({ state }, cid, offset) => {
  const { digest } = cid.multihash
  const idx = state.idxs.get(digest.length) || []
  idx.push({ digest, offset })
  state.idxs.set(digest.length, idx)
}

/**
 * @template {{ state: import('./api.js').IndexSortedWriterState, writer: import('../writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @param {import('../api.js').CloseOptions} options
 */
export const close = async ({ state, writer }, options) => {
  /** @type {Array<{ width: number, index: Uint8Array }>} */
  const compactedIdxs = []
  for (const [width, idx] of state.idxs.entries()) {
    const recordedWidth = width + 8
    const compact = new Uint8Array(recordedWidth * idx.length)
    const view = new DataView(compact.buffer)
    idx
      .sort((a, b) => compare(a.digest, b.digest))
      .forEach((item, i) => {
        const offset = i * recordedWidth
        compact.set(item.digest, offset)
        view.setBigUint64(offset + item.digest.length, BigInt(item.offset), true)
      })

    compactedIdxs.push({ width: recordedWidth, index: compact })
  }

  compactedIdxs.sort((a, b) => a.width - b.width)

  await writeVarint(writer, INDEX_SORTED_CODEC)
  await writeUint32LE(writer, compactedIdxs.length)
  for (const { width, index } of compactedIdxs) {
    await writeUint32LE(writer, width)
    await writeUint64LE(writer, index.length)
    await writer.write(index)
  }

  if (options?.closeWriter ?? true) {
    await writer.close()
  } else if (options?.releaseLock ?? true) {
    writer.releaseLock()
  }
}

class IndexSortedWriter {
  /**
   * @param {object} config
   * @param {import('../writer/api.js').Writer<Uint8Array>} config.writer
   */
  constructor ({ writer }) {
    this.writer = writer
    /** @type {import('./api.js').IndexSortedWriterState} */
    this.state = { idxs: new Map() }
  }

  /**
   * @param {import('multiformats').UnknownLink} cid
   * @param {number} offset
   * @returns {import('../api.js').IndexWriter<import('./api.js').IndexSortedWriterState>}
   */
  add (cid, offset) {
    add(this, cid, offset)
    return this
  }

  /** @param {import('../api.js').CloseOptions} options */
  close (options) {
    return close(this, options)
  }
}
