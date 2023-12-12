import { MultihashIndexItem } from '../mh-index-sorted/api.js'
import { MultiIndexItem } from '../multi-index/api.js'
import { ReaderState, IndexReader, IndexItem } from '../api.js'

export interface UniversalReaderState extends ReaderState {
  reader?: IndexReader
}

export type UniversalIndexItem = IndexItem | MultihashIndexItem | MultiIndexItem
