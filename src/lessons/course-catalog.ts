import type { Lesson, PlannedLesson } from '../player/types'
import { keyPartitionLesson } from './key-partition'
import { partitionCountLesson } from './partition-count'
import { producerJourneyLesson } from './producer-journey'
import { acksIdempotenceLesson } from './acks-idempotence'
import { replicationIsrLesson } from './replication-isr'
import { leaderElectionLesson } from './leader-election'
import { segmentRetentionLesson } from './segment-retention'
import { sparseIndexLesson } from './sparse-index'

export const COURSE_TITLE = 'Kafka Từ Gốc'

export const LESSONS: Lesson[] = [segmentRetentionLesson, sparseIndexLesson, keyPartitionLesson, partitionCountLesson, producerJourneyLesson, acksIdempotenceLesson, replicationIsrLesson, leaderElectionLesson]

/** Lessons shown in the sidebar as "sắp có" so the course outline is visible early. */
export const PLANNED: PlannedLesson[] = [
  { module: 'Module 5 · Consumer Group', title: 'Rebalance' },
]
