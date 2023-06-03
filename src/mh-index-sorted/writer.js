import { compare } from 'uint8arrays/compare'
import { writeUint32LE, writeUint64LE, writeVarint } from '../encoder.js'
import { MULTIHASH_INDEX_SORTED_CODEC } from './codec.js'

export const codec = MULTIHASH_INDEX_SORTED_CODEC

/**
 * @template {{ writer: import('../writer/api').Writer<Uint8Array> }} View
 * @param {View} view
 * @returns {import('../api').IndexWriter<import('./api').MultihashIndexSortedWriterState>}
 */
export const createWriter = ({ writer }) =>
  new MultihashIndexSortedWriter({ writer })

/**
 * @template {{ state: import('./api').MultihashIndexSortedWriterState }} View
 * @param {View} view
 * @param {import('multiformats').UnknownLink} cid
 * @param {number} offset
 */
export const add = ({ state }, cid, offset) => {
  const { code, digest } = cid.multihash
  /** @type {Map<number, import('../api').IndexItem[]>} */
  const idxs = state.mhIdxs.get(code) ?? new Map()
  const idx = idxs.get(digest.length) ?? []
  idx.push({ digest, offset })
  idxs.set(digest.length, idx)
  state.mhIdxs.set(code, idxs)
}

/**
 * @template {{ state: import('./api').MultihashIndexSortedWriterState, writer: import('../writer/api').Writer<Uint8Array> }} View
 * @param {View} view
 * @param {import('../api').CloseOptions} options
 */
export const close = async ({ state, writer }, options) => {
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
  }

  if (options?.closeWriter ?? true) {
    await writer.close()
  } else if (options?.releaseLock ?? true) {
    writer.releaseLock()
  }
}

class MultihashIndexSortedWriter {
  /**
   * @param {object} config
   * @param {import('../writer/api').Writer<Uint8Array>} config.writer
   */
  constructor ({ writer }) {
    this.writer = writer
    /** @type {import('./api').MultihashIndexSortedWriterState} */
    this.state = { mhIdxs: new Map() }
  }

  /**
   * @param {import('multiformats').UnknownLink} cid
   * @param {number} offset
   * @returns {import('../api').IndexWriter<import('./api').MultihashIndexSortedWriterState>}
   */
  add (cid, offset) {
    add(this, cid, offset)
    return this
  }

  /** @param {import('../api').CloseOptions} options */
  close (options) {
    return close(this, options)
  }
}
