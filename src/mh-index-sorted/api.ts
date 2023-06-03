import { MultihashDigest } from 'multiformats'
import { IndexItem, ReaderState, MultihashCodec, DigestLength } from '../api'

export interface MultihashIndexSortedReaderState extends ReaderState {
  started: boolean
  codesCount: number
  codesIndex: number
  code: number
  bucketsCount: number
  bucketIndex: number
  width: number
  itemsCount: number
  itemIndex: number
  done: boolean
}

export interface MultihashIndexSortedWriterState {
  mhIdxs: Map<MultihashCodec, Map<DigestLength, IndexItem[]>>
}

export interface MultihashIndexItem extends IndexItem {
  multihash: MultihashDigest
}
