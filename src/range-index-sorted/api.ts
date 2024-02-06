import { DigestLength, MultihashCodec } from '../api.js'
import { MultihashIndexItem, MultihashIndexSortedReaderState } from '../mh-index-sorted/api.js'

export interface RangeIndexSortedReaderState extends MultihashIndexSortedReaderState {}

export interface RangeIndexSortedWriterState {
  mhIdxs: Map<MultihashCodec, Map<DigestLength, RangeIndexItem[]>>
}

export interface RangeIndexItem extends MultihashIndexItem {
  /** Offset to block _bytes_ from the beginning of the CAR. */
  bytesOffset: number
  /** Number of bytes of block data at `bytesOffset`. */
  bytesLength: number
}
