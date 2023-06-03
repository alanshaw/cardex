import { MultihashDigest } from 'multiformats'
import { IndexItem, ReaderState, DigestLength } from '../api'

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

export interface MultihashIndexItem extends IndexItem {
  multihash: MultihashDigest
}
