/**
 * @param {{ reader: import('./reader/api.js').Reader<Uint8Array>, state: import('./api.js').BytesReaderState }} view
 * @param {number} length
 */
const read = async ({ reader, state }, length) => {
  state.have = state.currentChunk.length - state.offset
  const bufa = [state.currentChunk.subarray(state.offset)]
  while (state.have < length) {
    const { done, value: chunk } = await reader.read()
    if (done) {
      break
    }
    if (state.have < 0) { // because of a seek()
      if (chunk.length > state.have) {
        bufa.push(chunk.subarray(-state.have))
      } // else discard
    } else {
      bufa.push(chunk)
    }
    state.have += chunk.length
  }
  state.currentChunk = new Uint8Array(bufa.reduce((p, c) => p + c.length, 0))
  let off = 0
  for (const b of bufa) {
    state.currentChunk.set(b, off)
    off += b.length
  }
  state.offset = 0
}

export class BytesReader {
  /**
   * @param {{ reader: import('./reader/api.js').Reader<Uint8Array>, state: import('./api.js').BytesReaderState }} config
   */
  constructor ({ reader, state }) {
    this.reader = reader
    this.state = state
  }

  /** @param {number} length */
  async upTo (length) {
    if (this.state.currentChunk.length - this.state.offset < length) {
      await read(this, length)
    }
    return this.state.currentChunk.subarray(this.state.offset, this.state.offset + Math.min(this.state.currentChunk.length - this.state.offset, length))
  }

  /** @param {number} length */
  async exactly (length) {
    if (this.state.currentChunk.length - this.state.offset < length) {
      await read(this, length)
    }
    if (this.state.currentChunk.length - this.state.offset < length) {
      throw new Error('Unexpected end of data')
    }
    return this.state.currentChunk.subarray(this.state.offset, this.state.offset + length)
  }

  /** @param {number} length */
  seek (length) {
    this.state.pos += length
    this.state.offset += length
  }

  get pos () {
    return this.state.pos
  }

  /** @returns {import('./api.js').BytesReaderState} */
  static init () {
    return { pos: 0, have: 0, offset: 0, currentChunk: new Uint8Array(0) }
  }
}
