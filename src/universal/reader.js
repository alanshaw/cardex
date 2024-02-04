import { peekVarint } from '../decoder.js'
import { BytesReader } from '../bytes-reader.js'
import { IndexSortedReader } from '../index-sorted/index.js'
import { MultihashIndexSortedReader } from '../mh-index-sorted/index.js'
import { MultiIndexReader } from '../multi-index/index.js'

/** @type {Record<number, import('../multi-index/api.js').IndexReaderFactory<any, any>>} */
const indexReaders = {
  [IndexSortedReader.codec]: IndexSortedReader,
  [MultihashIndexSortedReader.codec]: MultihashIndexSortedReader
}

/** @returns {import('./api.js').UniversalReaderState} */
const init = () => ({ bytesReader: BytesReader.init() })

/**
 * @param {{ reader: import('../reader/api.js').Reader<Uint8Array> }} config
 * @returns {import('../api.js').IndexReader<import('./api.js').UniversalReaderState, import('./api.js').UniversalIndexItem>}
 */
export const createReader = ({ reader }) =>
  new UniversalReader({ reader, state: init() })

/**
 * @template {{ state: import('./api.js').UniversalReaderState, reader: import('../reader/api.js').Reader<Uint8Array> }} View
 * @param {View} view
 */
export const read = async ({ state, reader }) => {
  if (!state.reader) {
    const bytesReader = new BytesReader({ reader, state: state.bytesReader })
    const codec = await peekVarint(bytesReader)
    let indexReader
    if (codec === MultiIndexReader.codec) {
      indexReader = MultiIndexReader.createReader({ reader, state: { bytesReader: state.bytesReader } })
      indexReader.add(IndexSortedReader)
      indexReader.add(MultihashIndexSortedReader)
    } else {
      const IndexReader = indexReaders[codec]
      if (!IndexReader) throw new Error(`unsupported index: 0x${codec.toString(16)}`)
      indexReader = IndexReader.createReader({ reader, state: { bytesReader: state.bytesReader } })
    }
    state.reader = indexReader
  }
  return state.reader?.read()
}

/**
 * @template {{ state: import('./api.js').UniversalReaderState }} View
 * @param {View} view
 * @param {any} [reason]
 */
export const cancel = ({ state }, reason) => {
  if (!state.reader) return
  return state.reader.cancel(reason)
}

class UniversalReader {
  /**
   * @param {{ reader: import('../reader/api.js').Reader<Uint8Array>, state: import('./api.js').UniversalReaderState }} config
   */
  constructor ({ reader, state }) {
    this.reader = reader
    this.state = state
  }

  read () {
    return read(this)
  }

  /** @param {any} [reason] */
  cancel (reason) {
    return cancel(this, reason)
  }
}
