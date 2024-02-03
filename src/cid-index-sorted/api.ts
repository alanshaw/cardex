import { UnknownLink, Version } from 'multiformats/link'
import { ReaderState, MultihashCodec, DigestLength } from '../api.js'

export interface CIDIndexSortedReaderState extends ReaderState {
  started: boolean
  versionsCount: number
  versionsIndex: number
  version: number
  codesCount: number
  codesIndex: number
  code: number
  mhCodesCount: number
  mhCodesIndex: number
  mhCode: number
  bucketsCount: number
  bucketIndex: number
  width: number
  itemsCount: number
  itemIndex: number
  done: boolean
}

export interface CIDIndexItem {
  /** CID for the block. */
  cid: UnknownLink
  /** Offset to block _bytes_ from the beginning of the CAR. */
  offset: number
  /** Number of bytes of block data at `offset`. */
  length: number
}

/** IPLD codec */
export type Codec = number

export interface CIDIndexSortedWriterState {
  idxs: Map<Version, Map<Codec, Map<MultihashCodec, Map<DigestLength, CIDIndexItem[]>>>>
}
