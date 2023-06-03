import varint from 'varint'

/**
 * @param {number} num
 */
export function encodeUint32LE (num) {
  const arr = new ArrayBuffer(4)
  const view = new DataView(arr)
  view.setUint32(0, num, true)
  return new Uint8Array(arr)
}

/**
 * @param {import('./writer/api').Writer<Uint8Array>} writer
 * @param {number} num
 */
export function writeUint32LE (writer, num) {
  return writer.write(encodeUint32LE(num))
}

/**
 * @param {import('./writer/api').Writer<Uint8Array>} writer
 * @param {number} num
 */
export function writeUint64LE (writer, num) {
  const arr = new ArrayBuffer(8)
  const view = new DataView(arr)
  view.setBigUint64(0, BigInt(num), true)
  return writer.write(new Uint8Array(arr))
}

/**
 * @param {number} num
 */
export function encodeVarint (num) {
  return new Uint8Array(varint.encode(num))
}

/**
 * @param {import('./writer/api').Writer<Uint8Array>} writer
 * @param {number} num
 */
export function writeVarint (writer, num) {
  return writer.write(encodeVarint(num))
}
