import varint from 'varint'
import { create as createMultihash } from 'multiformats/hashes/digest'

/**
 * @param {import('./bytes-reader').BytesReader} reader
 * @returns {Promise<number>}
 */
export async function readVarint (reader) {
  const i = await peekVarint(reader)
  reader.seek(varint.decode.bytes)
  return i
}

/**
 * @param {import('./bytes-reader').BytesReader} reader
 * @returns {Promise<number>}
 */
export async function peekVarint (reader) {
  const bytes = await reader.upTo(8)
  if (!bytes.length) throw new Error('Unexpected end of data')
  return varint.decode(bytes)
}

/**
 * @param {import('./bytes-reader').BytesReader} reader
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
 * @param {import('./bytes-reader').BytesReader} reader
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
 * @param {import('./bytes-reader').BytesReader} reader
 * @returns {Promise<import('multiformats/hashes/digest').MultihashDigest>}
 */
export async function readMultihash (reader) {
  const codec = await readVarint(reader)
  const size = await readVarint(reader)
  const digest = await reader.exactly(size)
  reader.seek(size)
  return createMultihash(codec, digest)
}
