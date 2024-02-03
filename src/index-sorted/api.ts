import { ReaderState, DigestLength } from '../api.js'

export interface IndexItem {
  digest: Uint8Array
  offset: number
}

export interface IndexSortedReaderState extends ReaderState {
  started: boolean
  bucketsCount: number
  bucketIndex: number
  width: number
  itemsCount: number
  itemIndex: number
  done: boolean
}

export interface IndexSortedWriterState {
  idxs: Map<DigestLength, IndexItem[]>
}
