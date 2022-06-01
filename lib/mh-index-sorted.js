import { compare } from 'uint8arrays/compare'
import { create as createMultihash } from 'multiformats/hashes/digest'
import { writeUint32LE, writeUint64LE, writeVarint } from './encoder.js'
import { bytesReader, asyncIterableReader, readUint32LE, readUint64LE, readVarint } from './decoder.js'
import { create as iteratorChannel } from './iterator-channel.js'
import { IndexWriterOut } from './index-writer-common.js'

/**
 * @typedef {import('../types').IndexReader} IndexReader
 * @typedef {import('../types').IndexWriter} IndexWriter
 * @typedef {import('../types').IndexEntry} IndexEntry
 * @typedef {import('../types').IteratorChannel<Uint8Array>} IteratorChannel
 */

/**
 * Codec for the MultihashIndexSorted format.
 * https://ipld.io/specs/transport/car/carv2/#format-0x0401-multihashindexsorted
 */
export const MULTIHASH_INDEX_SORTED_CODEC = 0x0401

/**
 * @class
 * @implements {IndexWriter}
 */
export class MultihashIndexSortedWriter {
  /**
   * @param {import('../types').BytesWriter} writer
   */
  constructor (writer) {
    /** @private */
    this._writer = writer
    /**
     * @private
     * @type {Map<number, Map<number, import('../types').IndexEntry[]>>}
     */
    this._mhIdxs = new Map()
  }

  /**
   * @param {import('../types').BlockIndexData} blockIndexData
   */
  async put (blockIndexData) {
    const { code, digest } = blockIndexData.cid.multihash
    /** @type {Map<number, IndexEntry[]>} */
    const idxs = this._mhIdxs.get(code) || new Map()
    const idx = idxs.get(digest.length) || []
    idx.push({ digest, offset: blockIndexData.offset })
    idxs.set(digest.length, idx)
    this._mhIdxs.set(code, idxs)
  }

  async close () {
    await writeVarint(this._writer, MULTIHASH_INDEX_SORTED_CODEC)
    await writeUint32LE(this._writer, this._mhIdxs.size)

    const mhIdxs = Array.from(this._mhIdxs.entries()).sort((a, b) => a[0] - b[0])

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

      await writeUint64LE(this._writer, code)
      await writeUint32LE(this._writer, compactedIdxs.length)
      for (const { width, index } of compactedIdxs) {
        await writeUint32LE(this._writer, width)
        await writeUint64LE(this._writer, index.length)
        await this._writer.write(index)
      }
    }
    await this._writer.end()
  }

  /**
   * @returns {{ writer: IndexWriter, out: AsyncIterable<Uint8Array> }}
   */
  static create () {
    /** @type {IteratorChannel} */
    const { writer, iterator } = iteratorChannel()
    return { writer: new MultihashIndexSortedWriter(writer), out: new IndexWriterOut(iterator) }
  }
}

/**
 * @class
 * @implements {IndexReader}
 */
export class MultihashIndexSortedReader {
  /**
   * @param {import('../types').BytesReader} reader
   */
  constructor (reader) {
    /** @private */
    this._reader = reader
  }

  /**
   * @returns {AsyncIterable<IndexEntry>}
   */
  async * [Symbol.asyncIterator] () {
    const codec = await readVarint(this._reader)
    if (codec !== MULTIHASH_INDEX_SORTED_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }

    const codes = await readUint32LE(this._reader)
    for (let k = 0; k < codes; k++) {
      const code = await readUint64LE(this._reader)
      const buckets = await readUint32LE(this._reader)
      for (let i = 0; i < buckets; i++) {
        const width = await readUint32LE(this._reader)
        const length = await readUint64LE(this._reader)

        for (let j = 0; j < length; j += width) {
          const digest = await this._reader.exactly(width - 8)
          this._reader.seek(width - 8)
          const offset = await readUint64LE(this._reader)
          yield { multihash: createMultihash(code, digest), digest, offset }
        }
      }
    }
  }

  entries () {
    return this[Symbol.asyncIterator]()
  }

  /**
   * @param {AsyncIterable<Uint8Array>} iterable
   */
  static fromIterable (iterable) {
    return new MultihashIndexSortedReader(asyncIterableReader(iterable))
  }

  /**
   * @param {Uint8Array} bytes
   */
  static fromBytes (bytes) {
    return new MultihashIndexSortedReader(bytesReader(bytes))
  }
}
