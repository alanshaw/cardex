/**
 * @class
 * @implements {AsyncIterable<Uint8Array>}
 */
export class IndexWriterOut {
  /**
   * @param {AsyncIterator<Uint8Array>} iterator
   */
  constructor (iterator) {
    this._iterator = iterator
  }

  [Symbol.asyncIterator] () {
    if (this._iterating) {
      throw new Error('Multiple iterator not supported')
    }
    this._iterating = true
    return this._iterator
  }
}
