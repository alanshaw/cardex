import { compare } from 'uint8arrays/compare'
import { writeUint32LE, writeUint64LE, writeVarint } from './encoder.js'
import { MULTIHASH_INDEX_SORTED_CODEC } from './codecs.js'

/**
 * @typedef {import('../types.js').IndexEntry} IndexEntry
 * @typedef {number} DigestLength
 * @typedef {number} MultihashCodec
 * @typedef {{ mhIdxs: Map<MultihashCodec, Map<DigestLength, import('../types.js').IndexEntry[]>> }} State
 */

export const codec = MULTIHASH_INDEX_SORTED_CODEC

/**
 * @template {{ writer: import('./writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @returns {import('./api.js').IndexWriter<State>}
 */
export const createWriter = ({ writer }) =>
  new MultihashIndexSortedWriter({ writer })

/**
 * @template {{ state: State }} View
 * @param {View} view
 * @param {import('multiformats').UnknownLink} cid
 * @param {number} offset
 */
export const add = (view, cid, offset) => {
  const { code, digest } = cid.multihash
  /** @type {Map<number, IndexEntry[]>} */
  const idxs = view.state.mhIdxs.get(code) || new Map()
  const idx = idxs.get(digest.length) || []
  idx.push({ digest, offset })
  idxs.set(digest.length, idx)
  view.state.mhIdxs.set(code, idxs)
  return view
}

/**
 * @template {{ state: State, writer: import('./writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @param {import('./api.js').CloseOptions} options
 */
export const close = async (view, options) => {
  const { state, writer } = view
  await writeVarint(writer, MULTIHASH_INDEX_SORTED_CODEC)
  await writeUint32LE(writer, state.mhIdxs.size)

  const mhIdxs = Array.from(state.mhIdxs.entries()).sort((a, b) => a[0] - b[0])

  for (const [code, idxs] of mhIdxs) {
    /** @type {Array<{ width: number, index: Uint8Array }>} */
    const compactedIdxs = []
    for (const [width, idx] of idxs.entries()) {
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

    await writeUint64LE(writer, code)
    await writeUint32LE(writer, compactedIdxs.length)
    for (const { width, index } of compactedIdxs) {
      await writeUint32LE(writer, width)
      await writeUint64LE(writer, index.length)
      await writer.write(index)
    }

    if (options?.closeWriter) {
      await writer.close()
    } else if (options?.releaseLock) {
      writer.releaseLock()
    }
  }
}

class MultihashIndexSortedWriter {
  /**
   * @param {object} config
   * @param {import('./writer/api.js').Writer<Uint8Array>} config.writer
   */
  constructor ({ writer }) {
    this.writer = writer
    /** @type {State} */
    this.state = { mhIdxs: new Map() }
  }

  /**
   * @param {import('multiformats').UnknownLink} cid
   * @param {number} offset
   * @returns {import('./api.js').IndexWriter<State>}
   */
  add (cid, offset) {
    return add(this, cid, offset)
  }

  /**
   * @param {import('./api.js').CloseOptions} options
   */
  close (options) {
    return close(this, options)
  }
}
