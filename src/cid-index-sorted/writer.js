import { compare } from 'uint8arrays/compare'
import { writeUint8, writeUint32LE, writeUint64LE, writeVarint } from '../encoder.js'
import { CID_INDEX_SORTED_CODEC } from './codec.js'

export const codec = CID_INDEX_SORTED_CODEC

/**
 * @template {{ writer: import('../writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @returns {import('../api.js').IndexWriter<import('./api.js').CIDIndexSortedWriterState, import('./api.js').CIDIndexItem>}
 */
export const createWriter = ({ writer }) => new CIDIndexSortedWriter({ writer })

/**
 * @template {{ state: import('./api.js').CIDIndexSortedWriterState }} View
 * @param {View} view
 * @param {import('./api.js').CIDIndexItem} item
 */
export const add = ({ state }, item) => {
  const { version, code } = item.cid

  let vidxs = state.idxs.get(version)
  if (!vidxs) {
    vidxs = new Map()
    state.idxs.set(version, vidxs)
  }

  let cidxs = vidxs.get(code)
  if (!cidxs) {
    cidxs = new Map()
    vidxs.set(code, cidxs)
  }

  let mcidx = cidxs.get(item.cid.multihash.code)
  if (!mcidx) {
    mcidx = new Map()
    cidxs.set(item.cid.multihash.code, mcidx)
  }

  const idx = mcidx.get(item.cid.multihash.digest.length) ?? []
  idx.push(item)
  mcidx.set(item.cid.multihash.digest.length, idx)
}

/**
 * @template {{ state: import('./api.js').CIDIndexSortedWriterState, writer: import('../writer/api.js').Writer<Uint8Array> }} View
 * @param {View} view
 * @param {import('../api.js').CloseOptions} options
 */
export const close = async ({ state, writer }, options) => {
  await writeVarint(writer, codec)
  await writeUint8(writer, state.idxs.size)

  const vidxs = Array.from(state.idxs.entries()).sort((a, b) => b[0] - a[0])
  for (const [v, vidx] of vidxs) {
    await writeUint8(writer, v)
    await writeUint32LE(writer, vidx.size)

    const svidx = Array.from(vidx.entries()).sort((a, b) => a[0] - b[0])
    for (const [c, cidx] of svidx) {
      await writeUint64LE(writer, c)
      await writeUint32LE(writer, cidx.size)

      const mhidxs = Array.from(cidx.entries()).sort((a, b) => a[0] - b[0])
      for (const [code, idxs] of mhidxs) {
        /** @type {Array<{ width: number, index: Uint8Array }>} */
        const compactedIdxs = []
        for (const [width, idx] of idxs.entries()) {
          const recordedWidth = width + 16
          const compact = new Uint8Array(recordedWidth * idx.length)
          const view = new DataView(compact.buffer)
          idx
            .sort((a, b) => compare(a.cid.multihash.digest, b.cid.multihash.digest))
            .forEach((item, i) => {
              const offset = i * recordedWidth
              compact.set(item.cid.multihash.digest, offset)
              view.setBigUint64(offset + item.cid.multihash.digest.length, BigInt(item.offset), true)
              view.setBigUint64(offset + item.cid.multihash.digest.length + 8, BigInt(item.length), true)
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
    }
  }

  if (options?.closeWriter ?? true) {
    await writer.close()
  } else if (options?.releaseLock ?? true) {
    writer.releaseLock()
  }
}

class CIDIndexSortedWriter {
  /**
   * @param {object} config
   * @param {import('../writer/api.js').Writer<Uint8Array>} config.writer
   */
  constructor ({ writer }) {
    this.writer = writer
    /** @type {import('./api.js').CIDIndexSortedWriterState} */
    this.state = { idxs: new Map() }
  }

  /** @param {import('./api.js').CIDIndexItem} item */
  add (item) {
    add(this, item)
    return this
  }

  /** @param {import('../api.js').CloseOptions} options */
  close (options) {
    return close(this, options)
  }
}
