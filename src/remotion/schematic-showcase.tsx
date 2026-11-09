import { useCurrentFrame, useVideoConfig } from 'remotion'
import { HOME, Scene, clamp, span } from '../player/motion-kit'
import { ConsumerCaret, INK, LogTape, MessageCell, Note, PartitionTapes, ProducerBox, ServerUnit, Statement, Wire } from '../player/schematic'

/** One frame showing every schematic shape, so the vocabulary can be reviewed in Remotion Studio. */
export function SchematicShowcase() {
  const t = useCurrentFrame() / useVideoConfig().fps
  const fill = Math.floor(8 + 6 * clamp(span(t, 0.5, 3)))
  return (
    <Scene t={t} camera={{ ...HOME, s: 0.95 }} backdrop="plain">
      <Statement x={120} y={60} text="Bộ hình sơ đồ kỹ thuật" size={44} />
      <ServerUnit x={120} y={170} name="broker-1 leader" t={t} />
      <LogTape x={440} y={200} cells={16} cellW={66} state={(i) => (i < 8 ? 'filled' : i < fill ? 'new' : 'empty')} offsetOf={(i) => i} marks={[{ at: 8, label: 'HW', color: INK.good }, { at: fill, label: 'LEO', color: INK.accent }]} />
      <ServerUnit x={120} y={400} name="broker-2 ✕" down t={t} />
      <LogTape x={440} y={430} cells={16} cellW={66} state={(i) => (i < 6 ? 'dead' : i < 10 ? 'missing' : 'empty')} cursor={6} cursorLabel="đang chép" />
      <ProducerBox x={1500} y={160} line="send(order-42)" />
      <Wire from={{ x: 1500, y: 240 }} to={{ x: 440 + fill * 66, y: 192 }} color={INK.accent} label="ghi" />
      <MessageCell x={1300} y={540} label="k=A" />
      <PartitionTapes x={540} y={640} partitions={3} cells={10} state={(p, i) => (i < 4 + p * 2 ? 'filled' : 'empty')} gap={120} />
      <ConsumerCaret tapeX={540} tapeY={880} at={3} name="consumer-1" offset={3} />
      <Note x={540 + 8 * 66} y={675} dx={120} dy={-40} text="partition = một dải log riêng" color={INK.warn} />
    </Scene>
  )
}
