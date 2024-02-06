import { IndexItem } from '../index-sorted/api.js'
import { MultihashIndexItem } from '../mh-index-sorted/api.js'
import { MultiIndexItem } from '../multi-index/api.js'
import { ReaderState, IndexReader } from '../api.js'

export interface UniversalReaderState extends ReaderState {
  reader?: IndexReader<ReaderState, UniversalIndexItem>
}

export type UniversalIndexItem = IndexItem | MultihashIndexItem | MultiIndexItem
