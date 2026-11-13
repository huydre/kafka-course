import type { Lesson, PlannedLesson } from '../player/types'
import { acksIdempotenceLesson } from './acks-idempotence'
import { consumerGroupLesson } from './consumer-group'
import { keyPartitionLesson } from './key-partition'
import { leaderElectionLesson } from './leader-election'
import { partitionCountLesson } from './partition-count'
import { producerJourneyLesson } from './producer-journey'
import { rebalanceLesson } from './rebalance'
import { replicationIsrLesson } from './replication-isr'
import { segmentRetentionLesson } from './segment-retention'
import { sparseIndexLesson } from './sparse-index'
import { commitOffsetLesson } from './commit-offset'
import { deliverySemanticsLesson } from './delivery-semantics'
import { transactionsLesson } from './transactions'
import { compactionLesson } from './compaction'
import { tieredStorageLesson } from './tiered-storage'
import { schemaRegistryLesson } from './schema-registry'
import { kafkaConnectLesson } from './kafka-connect'
import { kafkaStreamsLesson } from './kafka-streams'
import { monitoringLesson } from './monitoring'
import { sizingTuningLesson } from './sizing-tuning'
import { incidentsOpsLesson } from './incidents-ops'
import { outboxInboxLesson } from './outbox-inbox'
import { eventDesignLesson } from './event-design'
import { retrySagaLesson } from './retry-saga'
import { capstoneLesson } from './capstone'

export const COURSE_TITLE = 'Kafka Từ Gốc'

/** Every lesson in course order. Drafts (no sections yet) are shown as "sắp có" instead of being opened. */
const ALL: Lesson[] = [
  segmentRetentionLesson,
  sparseIndexLesson,
  keyPartitionLesson,
  partitionCountLesson,
  producerJourneyLesson,
  acksIdempotenceLesson,
  replicationIsrLesson,
  leaderElectionLesson,
  consumerGroupLesson,
  rebalanceLesson,
  commitOffsetLesson,
  deliverySemanticsLesson,
  transactionsLesson,
  compactionLesson,
  tieredStorageLesson,
  schemaRegistryLesson,
  kafkaConnectLesson,
  kafkaStreamsLesson,
  monitoringLesson,
  sizingTuningLesson,
  incidentsOpsLesson,
  outboxInboxLesson,
  eventDesignLesson,
  retrySagaLesson,
  capstoneLesson,
]

export const LESSONS: Lesson[] = ALL.filter((l) => l.sections.length > 0)

/** Lessons shown in the sidebar as "sắp có" so the course outline is visible early. */
export const PLANNED: PlannedLesson[] = ALL.filter((l) => l.sections.length === 0).map(({ module, title }) => ({ module, title }))
