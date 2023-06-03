/* global WritableStream */

/** @param {ReadableStream} readable */
export const collect = async readable => {
  const chunks = []
  await readable.pipeTo(new WritableStream({
    write (chunk) {
      chunks.push(chunk)
    }
  }))
  return chunks
}
