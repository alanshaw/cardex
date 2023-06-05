import { peekVarint } from '../decoder.js'
import { BytesReader } from '../bytes-reader.js'
import { IndexSortedReader } from '../index-sorted/index.js'
import { MultihashIndexSortedReader } from '../mh-index-sorted/index.js'
import { MultiIndexReader } from '../multi-index/index.js'

/** @type {Record<number, import('../multi-index/api').IndexReaderFactory>} */
const indexReaders = {
  [IndexSortedReader.codec]: IndexSortedReader,
  [MultihashIndexSortedReader.codec]: MultihashIndexSortedReader,
  [MultiIndexReader.codec]: MultiIndexReader
}

/** @returns {import('./api').UniversalReaderState} */
const init = () => ({ bytesReader: BytesReader.init() })

/**
 * @param {{ reader: import('../reader/api').Reader<Uint8Array> }} config
 * @returns {import('../api').IndexReader<import('./api').UniversalReaderState, import('./api').UniversalIndexItem>}
 */
export const createReader = ({ reader }) =>
  new UniversalReader({ reader, state: init() })

/**
 * @template {{ state: import('./api').UniversalReaderState, reader: import('../reader/api').Reader<Uint8Array> }} View
 * @param {View} view
 */
export const read = async ({ state, reader }) => {
  if (!state.reader) {
    const bytesReader = new BytesReader({ reader, state: state.bytesReader })
    const codec = await peekVarint(bytesReader)
    const IndexReader = indexReaders[codec]
    if (!IndexReader) {
      throw new Error(`unsupported index: 0x${codec.toString(16)}`)
    }
    state.reader = IndexReader.createReader({ reader, state: { bytesReader: state.bytesReader } })
  }
  return state.reader.read()
}

/**
 * @template {{ state: import('./api').UniversalReaderState }} View
 * @param {View} view
 * @param {any} reason
 */
export const cancel = ({ state }, reason) => {
  if (!state.reader) return
  return state.reader.cancel(reason)
}

class UniversalReader {
  /**
   * @param {{ reader: import('../reader/api').Reader<Uint8Array>, state: import('./api').UniversalReaderState }} config
   */
  constructor ({ reader, state }) {
    this.reader = reader
    this.state = state
  }

  read () {
    return read(this)
  }

  /** @param {any} reason */
  cancel (reason) {
    return cancel(this, reason)
  }
}
