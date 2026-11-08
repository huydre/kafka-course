import type { Lesson, PlannedLesson } from '../player/types'
import { keyPartitionLesson } from './key-partition'
import { sparseIndexLesson } from './sparse-index'

export const COURSE_TITLE = 'Kafka Từ Gốc'

export const LESSONS: Lesson[] = [sparseIndexLesson, keyPartitionLesson]

/** Lessons shown in the sidebar as "sắp có" so the course outline is visible early. */
export const PLANNED: PlannedLesson[] = [
  { module: 'Module 1 · Log & Storage', title: 'Segment, Roll & Retention' },
  { module: 'Module 2 · Topic, Partition, Key', title: 'Chọn số partition' },
  { module: 'Module 3 · Producer', title: 'Hành trình một tin trong producer' },
  { module: 'Module 3 · Producer', title: 'acks & Idempotence' },
  { module: 'Module 4 · Replication', title: 'Leader, ISR & High Watermark' },
  { module: 'Module 5 · Consumer Group', title: 'Rebalance' },
]
