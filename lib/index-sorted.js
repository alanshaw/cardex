import { compare } from 'uint8arrays/compare'
import { writeUint32LE, writeUint64LE, writeVarint } from './encoder.js'
import { bytesReader, asyncIterableReader, readUint32LE, readUint64LE, readVarint } from './decoder.js'
import { create as iteratorChannel } from './iterator-channel.js'
import { IndexWriterOut } from './index-writer-common.js'

/**
 * @typedef {import('../types').IndexReader} IndexReader
 * @typedef {import('../types').IndexWriter} IndexWriter
 * @typedef {import('../types').IndexEntry} IndexEntry
 * @typedef {import('../types').IteratorChannel<Uint8Array>} IteratorChannel
 * @typedef {number} DigestLength
 */

/**
 * Codec for the IndexSorted format.
 * https://ipld.io/specs/transport/car/carv2/#format-0x0400-indexsorted
 */
export const INDEX_SORTED_CODEC = 0x0400

/**
 * @class
 * @implements {IndexWriter}
 */
export class IndexSortedWriter {
  /**
   * @param {import('../types').BytesWriter} writer
   */
  constructor (writer) {
    /** @private */
    this._writer = writer
    /**
     * @private
     * @type {Map<DigestLength, IndexEntry[]>}
     */
    this._idxs = new Map()
  }

  /**
   * @param {import('../types').BlockIndexData} blockIndexData
   */
  async put (blockIndexData) {
    const { digest } = blockIndexData.cid.multihash
    const idx = this._idxs.get(digest.length) || []
    idx.push({ digest, offset: blockIndexData.offset })
    this._idxs.set(digest.length, idx)
  }

  async close () {
    /** @type {Array<{ width: number, index: Uint8Array }>} */
    const compactedIdxs = []
    for (const [width, idx] of this._idxs.entries()) {
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

    await writeVarint(this._writer, INDEX_SORTED_CODEC)
    await writeUint32LE(this._writer, compactedIdxs.length)
    for (const { width, index } of compactedIdxs) {
      await writeUint32LE(this._writer, width)
      await writeUint64LE(this._writer, index.length)
      await this._writer.write(index)
    }
    await this._writer.end()
  }

  /**
   * @returns {{ writer: IndexWriter, out: AsyncIterable<Uint8Array> }}
   */
  static create () {
    /** @type {IteratorChannel} */
    const { writer, iterator } = iteratorChannel()
    return { writer: new IndexSortedWriter(writer), out: new IndexWriterOut(iterator) }
  }
}

/**
 * @class
 * @implements {IndexReader}
 */
export class IndexSortedReader {
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
    if (codec !== INDEX_SORTED_CODEC) {
      throw new Error(`unexpected index codec: 0x${codec.toString(16)}`)
    }

    const buckets = await readUint32LE(this._reader)
    for (let i = 0; i < buckets; i++) {
      const width = await readUint32LE(this._reader)
      const length = await readUint64LE(this._reader)

      for (let j = 0; j < length; j += width) {
        const digest = await this._reader.exactly(width - 8)
        this._reader.seek(width - 8)
        const offset = await readUint64LE(this._reader)
        yield { digest, offset }
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
    return new IndexSortedReader(asyncIterableReader(iterable))
  }

  /**
   * @param {Uint8Array} bytes
   */
  static fromBytes (bytes) {
    return new IndexSortedReader(bytesReader(bytes))
  }
}
