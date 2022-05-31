// copied from https://github.com/ipld/js-car/blob/master/lib/decoder.js

import varint from 'varint'

/**
 * @typedef {import('./index.d').BytesReader} BytesReader
 */

/**
 * @param {BytesReader} reader
 * @returns {Promise<number>}
 */
export async function readVarint (reader) {
  const bytes = await reader.upTo(8)
  if (!bytes.length) {
    throw new Error('Unexpected end of data')
  }
  const i = varint.decode(bytes)
  reader.seek(varint.decode.bytes)
  return i
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<number>}
 */
export async function readUint32LE (reader) {
  const arr = await reader.exactly(4)
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength)
  const n = view.getUint32(0, true)
  reader.seek(4)
  return n
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<number>}
 */
export async function readUint64LE (reader) {
  const arr = await reader.exactly(8)
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength)
  const n = view.getBigUint64(0, true)
  if (n > Number.MAX_SAFE_INTEGER) throw new Error('too big')
  reader.seek(8)
  return Number(n)
}

/**
 * Creates a `BytesReader` from a `Uint8Array`.
 *
 * @param {Uint8Array} bytes
 * @returns {BytesReader}
 */
export function bytesReader (bytes) {
  let pos = 0

  /** @type {BytesReader} */
  return {
    async upTo (length) {
      return bytes.subarray(pos, pos + Math.min(length, bytes.length - pos))
    },

    async exactly (length) {
      if (length > bytes.length - pos) {
        throw new Error('Unexpected end of data')
      }
      return bytes.subarray(pos, pos + length)
    },

    seek (length) {
      pos += length
    },

    get pos () {
      return pos
    }
  }
}

/**
 * @ignore
 * reusable reader for streams and files, we just need a way to read an
 * additional chunk (of some undetermined size) and a way to close the
 * reader when finished
 * @param {() => Promise<Uint8Array|null>} readChunk
 * @returns {BytesReader}
 */
export function chunkReader (readChunk /*, closer */) {
  let pos = 0
  let have = 0
  let offset = 0
  let currentChunk = new Uint8Array(0)

  const read = async (/** @type {number} */ length) => {
    have = currentChunk.length - offset
    const bufa = [currentChunk.subarray(offset)]
    while (have < length) {
      const chunk = await readChunk()
      if (chunk == null) {
        break
      }
      if (have < 0) { // because of a seek()
        if (chunk.length > have) {
          bufa.push(chunk.subarray(-have))
        } // else discard
      } else {
        bufa.push(chunk)
      }
      have += chunk.length
    }
    currentChunk = new Uint8Array(bufa.reduce((p, c) => p + c.length, 0))
    let off = 0
    for (const b of bufa) {
      currentChunk.set(b, off)
      off += b.length
    }
    offset = 0
  }

  /** @type {BytesReader} */
  return {
    async upTo (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      return currentChunk.subarray(offset, offset + Math.min(currentChunk.length - offset, length))
    },

    async exactly (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      if (currentChunk.length - offset < length) {
        throw new Error('Unexpected end of data')
      }
      return currentChunk.subarray(offset, offset + length)
    },

    seek (length) {
      pos += length
      offset += length
    },

    get pos () {
      return pos
    }
  }
}

/**
 * Creates a `BytesReader` from an `AsyncIterable<Uint8Array>`, which allows for
 * consumption of data from a streaming source.
 *
 * @param {AsyncIterable<Uint8Array>} asyncIterable
 * @returns {BytesReader}
 */
export function asyncIterableReader (asyncIterable) {
  const iterator = asyncIterable[Symbol.asyncIterator]()

  async function readChunk () {
    const next = await iterator.next()
    if (next.done) {
      return null
    }
    return next.value
  }

  return chunkReader(readChunk)
}
