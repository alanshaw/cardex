import { compare } from 'uint8arrays/compare'
import { writeUint32LE, writeUint64LE, writeVarint } from '../encoder.js'
import { RANGE_INDEX_SORTED_CODEC } from './codec.js'

export const codec = RANGE_INDEX_SORTED_CODEC

/**
 * @template {{ writer: import('../writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @returns {import('../api.js').IndexWriter<import('./api.js').RangeIndexSortedWriterState, import('./api.js').RangeIndexItem>}
 */
export const createWriter = ({ writer }) =>
  new RangeIndexSortedWriter({ writer })

/**
 * @template {{ state: import('./api.js').RangeIndexSortedWriterState }} View
 * @param {View} view
 * @param {import('./api.js').RangeIndexItem} item
 */
export const add = ({ state }, item) => {
  const { code, digest } = item.multihash
  /** @type {Map<number, import('./api.js').RangeIndexItem[]>} */
  const idxs = state.mhIdxs.get(code) ?? new Map()
  const idx = idxs.get(digest.length) ?? []
  idx.push(item)
  idxs.set(digest.length, idx)
  state.mhIdxs.set(code, idxs)
}

/**
 * @template {{ state: import('./api.js').RangeIndexSortedWriterState, writer: import('../writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @param {import('../api.js').CloseOptions} options
 */
export const close = async ({ state, writer }, options) => {
  await writeVarint(writer, RANGE_INDEX_SORTED_CODEC)
  await writeUint32LE(writer, state.mhIdxs.size)

  const mhIdxs = Array.from(state.mhIdxs.entries()).sort((a, b) => a[0] - b[0])

  for (const [code, idxs] of mhIdxs) {
    /** @type {Array<{ width: number, index: Uint8Array }>} */
    const compactedIdxs = []
    for (const [width, idx] of idxs.entries()) {
      const recordedWidth = width + 24
      const compact = new Uint8Array(recordedWidth * idx.length)
      const view = new DataView(compact.buffer)
      idx
        .sort((a, b) => compare(a.multihash.digest, b.multihash.digest))
        .forEach((item, i) => {
          const offset = i * recordedWidth
          compact.set(item.multihash.digest, offset)
          view.setBigUint64(offset + item.multihash.digest.length, BigInt(item.offset), true)
          view.setBigUint64(offset + item.multihash.digest.length + 8, BigInt(item.bytesOffset), true)
          view.setBigUint64(offset + item.multihash.digest.length + 16, BigInt(item.bytesLength), true)
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

class RangeIndexSortedWriter {
  /**
   * @param {object} config
   * @param {import('../writer/api.js').Writer<Uint8Array>} config.writer
   */
  constructor ({ writer }) {
    this.writer = writer
    /** @type {import('./api.js').RangeIndexSortedWriterState} */
    this.state = { mhIdxs: new Map() }
  }

  /** @param {import('./api.js').RangeIndexItem} item */
  add (item) {
    add(this, item)
    return this
  }

  /** @param {import('../api.js').CloseOptions} options */
  close (options) {
    return close(this, options)
  }
}
