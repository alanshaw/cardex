import { MultihashIndexItem } from '../mh-index-sorted/api'
import { MultiIndexItem } from '../multi-index/api'
import { ReaderState, IndexReader, IndexItem } from '../api'

export interface UniversalReaderState extends ReaderState {
  reader?: IndexReader
}

export type UniversalIndexItem = IndexItem | MultihashIndexItem | MultiIndexItem
