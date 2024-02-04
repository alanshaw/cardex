import { MultihashDigest } from 'multiformats'
import { ReaderState, MultihashCodec, DigestLength } from '../api.js'

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
  mhIdxs: Map<MultihashCodec, Map<DigestLength, MultihashIndexItem[]>>
}

export interface MultihashIndexItem {
  multihash: MultihashDigest
  offset: number
}
