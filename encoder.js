import varint from 'varint'

/** @typedef {import('./index.d').BytesWriter} BytesWriter */

/**
 * @param {BytesWriter} writer
 * @param {number} num
 */
export function writeUint32LE (writer, num) {
  const arr = new ArrayBuffer(4)
  const view = new DataView(arr)
  view.setUint32(0, num, true)
  return writer.write(new Uint8Array(arr))
}

/**
 * @param {BytesWriter} writer
 * @param {number} num
 */
export function writeUint64LE (writer, num) {
  const arr = new ArrayBuffer(8)
  const view = new DataView(arr)
  view.setBigUint64(0, BigInt(num), true)
  return writer.write(new Uint8Array(arr))
}

/**
 * @param {BytesWriter} writer
 * @param {number} num
 */
export function writeVarint (writer, num) {
  return writer.write(new Uint8Array(varint.encode(num)))
}
