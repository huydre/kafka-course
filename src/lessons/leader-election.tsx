import { Scene, TitleCard, cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { INK, LogTape, Note, REPLICA, Replica, ServerUnit, Statement, SummaryList, Wire, type CellState } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { leaderElectionScript } from './leader-election-script'

const { TX, ROWS, cellX, panel } = REPLICA
const STILL = [[0, { x: 960, y: 560, s: 0.98 }]] as [number, { x: number; y: number; s: number }][]

/* ------------------------------------------------------------------ 0. cold open: ISR empties out */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d0 = c.end(0) - a0
  const d1 = c.end(1) - a1
  const t3slow = a0 + d0 * 0.55
  const t2dead = a1 + 0.2
  const t1dead = a1 + d1 * 0.55
  const clock = t < t3slow ? '10:00' : t < t2dead ? '10:01' : t < t1dead ? '10:02' : '10:03'
  const isr = t < t3slow ? '{1, 2, 3}' : t < t2dead ? '{1, 2}' : t < t1dead ? '{1}' : '{ }'
  const focus = t >= a2
  return (
    <Scene t={t} camera={cameraAt(t, [...STILL, [a2, { x: 960, y: 600, s: 1.0 }, 1.2]])} backdrop="plain">
      <div style={{ ...panel, left: 1540, top: 120, fontSize: 40 }}>{clock}</div>
      <div style={{ ...panel, left: 1540, top: 200, color: isr === '{ }' ? INK.bad : isr === '{1, 2, 3}' ? INK.good : INK.warn }}>ISR = {isr}</div>
      <Replica row={0} name={t >= t1dead ? 'broker-1 ✕' : 'broker-1 · leader'} leo={13} down={t >= t1dead} t={t} />
      <Replica row={1} name={t >= t2dead ? 'broker-2 ✕' : 'broker-2'} leo={13} down={t >= t2dead} t={t} />
      <Replica
        row={2}
        name={t >= t3slow ? 'broker-3 · ngoài ISR' : 'broker-3'}
        leo={9}
        dim={t >= t3slow && !focus}
        t={t}
        state={(i) => (i < 9 ? 'filled' : focus && i < 13 ? 'missing' : t < t3slow && i < 13 ? 'filled' : 'empty')}
      />
      <Note x={cellX(11)} y={ROWS[2] + 35} dx={-60} dy={150} text="còn sống, nhưng thiếu offset 9–12" color={INK.bad} o={vis(t, a2 + 0.6)} />
      <Statement x={1220} y={940} text="Cho broker-3 làm leader?" color={INK.warn} size={50} o={sp(t, a2 + 2.2)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 1. clean election from the ISR */

function clean(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const dead = t >= a0 + 1.4
  const promoted = t >= a0 + 3.0
  const read = lerp(5, 10, span(t, a2 + 0.6, a2 + 4))
  return (
    <Scene t={t} camera={cameraAt(t, STILL)} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="BẦU LEADER" title="Chọn từ ISR" tone="green" dock={1.2} />}>
      <div style={{ ...panel, left: 1540, top: 190, color: INK.good }}>ISR = {dead ? '{2, 3}' : '{1, 2, 3}'}</div>
      <Replica row={0} name={dead ? 'broker-1 ✕' : 'broker-1 · leader'} leo={12} down={dead} t={t} />
      <Replica row={1} name={promoted ? 'broker-2 · leader mới' : 'broker-2'} leo={12} accent={promoted ? INK.warn : undefined} t={t} marks={[...(t >= a1 ? [{ at: 12, label: 'HW 12', color: INK.good }] : []), ...(t >= a2 ? [{ at: read, label: `consumer ${Math.floor(read)}`, color: INK.accent }] : [])]} />
      <Replica row={2} name="broker-3" leo={12} t={t} />
      <Note x={cellX(5)} y={ROWS[1] + 35} dx={80} dy={115} text="bản trong ISR có đủ mọi tin tới HW" color={INK.good} o={vis(t, a1 + 0.4)} />
      <Statement x={TX} y={960} text="không mất tin nào đã báo OK" color={INK.good} size={44} o={sp(t, a2 + 1.4)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 2. unclean election: two choices */

function unclean(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const CW = 54
  const L = 110
  const R = 1010
  const waitDots = '.'.repeat(1 + (Math.floor(t * 2) % 3))
  const newWrites = Math.floor(lerp(0, 4, span(t, a2 + 2.6, a2 + 5.4)))
  const rightState = (i: number): CellState => (i < 9 ? 'filled' : i < 9 + newWrites ? 'new' : t >= a2 + 1.0 && i < 13 ? 'missing' : 'empty')
  const twoTruths = t >= a3
  return (
    <Scene t={t} camera={cameraAt(t, STILL)} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="ISR TRỐNG" title="Chờ hay chạy tiếp?" tone="amber" dock={1.2} />}>
      <div style={{ position: 'absolute', left: 958, top: 230, width: 3, height: 680, background: INK.line, opacity: vis(t, a1 - 0.2) }} />
      {!twoTruths && (
        <>
          <div style={{ opacity: vis(t, a1 - 0.2) }}>
            <div style={{ position: 'absolute', left: L, top: 240, fontFamily: MONO, fontSize: 28, color: INK.faint }}>unclean = false · mặc định</div>
            <ServerUnit x={L} y={320} name={`chờ broker ISR sống lại${waitDots}`} t={t} />
            <LogTape x={L} y={560} cells={14} cellW={CW} state={(i) => (i < 13 ? 'dead' : 'empty')} title="partition" />
            <Statement x={L} y={730} text="đứng yên: không đọc, không ghi" color={INK.warn} size={36} o={sp(t, a1 + 1.2)} />
            <Statement x={L} y={790} text="nhưng không mất tin" color={INK.good} size={36} o={sp(t, a1 + 2.2)} />
          </div>
          <div style={{ opacity: vis(t, a2 - 0.2) }}>
            <div style={{ position: 'absolute', left: R, top: 240, fontFamily: MONO, fontSize: 28, color: INK.faint }}>unclean = true</div>
            <ServerUnit x={R} y={320} name="broker-3 lên làm leader" accent={INK.warn} t={t} />
            <LogTape x={R} y={560} cells={14} cellW={CW} state={rightState} title="partition" />
            <Statement x={R} y={730} text="chạy lại ngay" color={INK.good} size={36} o={sp(t, a2 + 1.0)} />
            <Statement x={R} y={790} text="offset 9–12 cũ: mất" color={INK.bad} size={36} o={sp(t, a2 + 1.8)} />
          </div>
        </>
      )}
      {twoTruths && (
        <>
          <LogTape x={TX} y={380} cells={14} cellW={66} title="consumer đọc TRƯỚC khi đổi leader" state={(i) => (i < 9 ? 'filled' : i < 13 ? 'new' : 'empty')} />
          <LogTape x={TX} y={680} cells={14} cellW={66} title="consumer đọc SAU khi đổi leader" state={(i) => (i < 9 ? 'filled' : i < 13 ? 'missing' : 'empty')} />
          <Note x={TX + 11 * 66} y={415} dx={120} dy={120} text="offset 9–12 = đơn A, B, C, D" color={INK.accent} o={sp(t, a3 + 0.6)} />
          <Note x={TX + 11 * 66} y={715} dx={120} dy={130} text="offset 9–12 = đơn X, Y, Z, W" color={INK.bad} o={sp(t, a3 + 1.4)} />
          <Statement x={TX} y={180} text="cùng offset, hai nội dung khác nhau" color={INK.bad} size={46} o={sp(t, a3 + 2.4)} />
        </>
      )}
    </Scene>
  )
}

/* ------------------------------------------------------------------ 3. leader epoch */

function epoch(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const ep = t >= a0 + 1.2 ? 2 : 1
  const restarting = t >= a1 - 0.2 && t < a1 + 0.8
  const truncated = t >= a2 + 1.4
  const refill = Math.floor(lerp(6, 10, span(t, a2 + 2.4, a2 + 4.4)))
  const leaderState = (i: number): CellState => (i < 6 ? 'filled' : i < 10 && ep === 2 ? 'new' : 'empty')
  const followerState = (i: number): CellState => (i < 6 ? 'filled' : truncated ? (i < refill ? 'new' : 'empty') : i < 8 ? 'missing' : 'empty')
  const bracket = (x1: number, x2: number, y: number, text: string, color: string, o: number) => (
    <div style={{ opacity: o }}>
      <div style={{ position: 'absolute', left: x1, top: y, width: x2 - x1, height: 14, borderTop: `3px solid ${color}`, borderLeft: `3px solid ${color}`, borderRight: `3px solid ${color}` }} />
      <div style={{ position: 'absolute', left: x1, width: x2 - x1, top: y - 42, textAlign: 'center', fontFamily: MONO, fontSize: 24, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  )
  return (
    <Scene t={t} camera={cameraAt(t, STILL)} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="LEADER EPOCH" title="Chỉ cắt đúng phần sai" dock={1.2} />}>
      <div style={{ ...panel, left: 1540, top: 190 }}>epoch = {ep}</div>
      <Replica row={0} name="broker-2 · leader mới" leo={10} accent={INK.warn} t={t} state={leaderState} />
      <Replica row={1} name={restarting ? 'broker-1 · khởi động lại' : 'broker-1 · follower'} leo={8} down={restarting} t={t} state={followerState} />
      {bracket(cellX(0), cellX(6), ROWS[0] - 70, 'epoch 1: offset 0–5', INK.faint, vis(t, a0 + 1.6))}
      {bracket(cellX(6), cellX(10), ROWS[0] - 70, 'epoch 2: từ offset 6', INK.warn, vis(t, a0 + 2.4))}
      <Wire from={{ x: cellX(8), y: ROWS[1] - 10 }} to={{ x: cellX(8), y: ROWS[0] + 80 }} color={INK.accent} p={move(t, a1 + 0.8, 0.5)} />
      <div style={{ position: 'absolute', left: cellX(8) + 20, top: ROWS[0] + 120, fontFamily: MONO, fontSize: 26, color: INK.accent, opacity: vis(t, a1 + 1.2) }}>"epoch 1 của tôi kết thúc ở đâu?" → offset 6</div>
      <Note x={cellX(7)} y={ROWS[1] + 35} dx={80} dy={150} text={truncated ? 'cắt offset 6–7, chép lại từ leader' : 'offset 6–7 ghi ở epoch cũ, leader mới không có'} color={truncated ? INK.good : INK.bad} o={vis(t, a0 + 3.0)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 4. KRaft controller quorum */

function quorum(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d2 = c.end(2) - a2
  const down3 = t >= a2 + 0.3
  const down2 = t >= a2 + d2 * 0.55
  const alive = 3 - (down3 ? 1 : 0) - (down2 ? 1 : 0)
  const ok = alive >= 2
  const pos = [
    { x: 840, y: 330, name: 'controller-1 · active' },
    { x: 440, y: 640, name: 'controller-2' },
    { x: 1240, y: 640, name: 'controller-3' },
  ]
  const down = [false, down2, down3]
  return (
    <Scene t={t} camera={cameraAt(t, STILL)} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="KRAFT" title="Ai quyết định leader?" dock={1.2} />}>
      {[
        [0, 1],
        [0, 2],
        [1, 2],
      ].map(([i, j]) => (
        <Wire key={`${i}${j}`} from={{ x: pos[i].x + 130, y: pos[i].y + 65 }} to={{ x: pos[j].x + 130, y: pos[j].y + 65 }} color={down[i] || down[j] ? INK.dim : INK.line} p={move(t, a1, 0.6)} />
      ))}
      {pos.map((p, k) => (
        <div key={p.name} style={{ opacity: clamp(sp(t, a0 + 0.3 + k * 0.2)) }}>
          <ServerUnit x={p.x} y={p.y} name={down[k] ? `${p.name.split(' ')[0]} ✕` : p.name} down={down[k]} t={t} />
        </div>
      ))}
      <div style={{ ...panel, left: 1540, top: 190, color: ok ? INK.good : INK.bad, opacity: vis(t, a1 + 0.8) }}>đa số: {alive}/3 {ok ? '✓' : '✗'}</div>
      <Statement x={440} y={900} text={ok ? '__cluster_metadata · mọi thay đổi cần 2/3 đồng ý' : 'đóng băng: vẫn đọc/ghi, nhưng không bầu được leader mới'} color={ok ? INK.text : INK.bad} size={36} o={vis(t, a1 + 1.2)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 5. summary */

function summary(t: number, c: Cue) {
  return <SummaryList t={t} cue={c} items={['Leader mới luôn chọn từ ISR', 'ISR trống: mặc định chờ · unclean thì mất tin', 'Leader epoch: chỉ cắt đúng phần sai', 'Controller cần đa số (2/3)']} />
}

const RENDERS: Record<string, LessonScene['render']> = { hook, clean, unclean, epoch, quorum, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [
    { kind: 'tick', at: (c) => c.at(0) + (c.end(0) - c.at(0)) * 0.55 },
    { kind: 'error', at: (c) => c.at(1) + 0.2 },
    { kind: 'error', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.55 },
  ],
  clean: [
    { kind: 'error', at: (c) => c.at(0) + 1.4 },
    { kind: 'ding', at: (c) => c.at(0) + 3.0 },
  ],
  unclean: [{ kind: 'error', at: (c) => c.at(2) + 1.0 }],
  epoch: [
    { kind: 'tick', at: (c) => c.at(0) + 1.2 },
    { kind: 'tick', at: (c) => c.at(2) + 1.4 },
    { kind: 'ding', at: (c) => c.at(2) + 4.4 },
  ],
  quorum: [
    { kind: 'error', at: (c) => c.at(2) + 0.3 },
    { kind: 'error', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.55 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const leaderElectionLesson: Lesson = {
  ...leaderElectionScript,
  scenes: leaderElectionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: mặc định Kafka có cho broker-3 (thiếu dữ liệu) làm leader không?', ['Có, để partition chạy tiếp', 'Không, partition đứng chờ một bản trong ISR sống lại', 'Có, nhưng chỉ cho đọc', 'Tuỳ consumer'], 1, 'Mặc định unclean.leader.election.enable = false từ Kafka 0.11. Phần 2 giải thích đánh đổi.')],
    },
  ],
  roadmap: [
    'Chặng 1: Leader chết bình thường — bầu từ ISR, không mất tin.',
    'Chặng 2: ISR trống — chờ hay unclean election, và cái giá "hai sự thật".',
    'Chặng 3: Leader epoch sửa lỗi cắt log, và controller KRaft cần đa số.',
  ],
  sections: [
    {
      id: 'bau-tu-isr',
      title: 'Bầu leader mới từ ISR',
      blocks: [
        { kind: 'video', scenes: ['clean'] },
        { kind: 'p', text: 'Khi leader chết, **controller** chọn một bản trong **ISR** lên thay. Bản ISR có đủ mọi tin tới HW, nên **mọi tin đã báo OK với `acks=all` vẫn còn**. Producer và consumer chỉ cần hỏi lại metadata để biết leader mới.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao leader mới luôn được chọn từ ISR?', ['Vì ISR có broker mạnh nhất', 'Vì bản trong ISR có đủ mọi tin tới High Watermark', 'Vì ISR gần controller nhất', 'Ngẫu nhiên'], 1, 'Chọn ngoài ISR có thể mất tin đã commit.')],
        },
      ],
    },
    {
      id: 'unclean',
      title: 'ISR trống: chờ hay unclean election',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Bật unclean election thì cái giá lớn nhất là gì?', ['Chậm hơn', 'Mất tin và có thể có hai nội dung cho cùng offset', 'Tốn đĩa', 'Không có giá'], 1, 'Xem video để thấy "hai sự thật".')],
        },
        { kind: 'video', scenes: ['unclean'] },
        {
          kind: 'table',
          head: ['Lựa chọn', 'Cấu hình', 'Hậu quả'],
          rows: [
            ['**Chờ** bản ISR sống lại', '`unclean.leader.election.enable=false` (mặc định từ 0.11)', 'Partition đứng, không đọc/ghi; **không mất tin**'],
            ['Cho bản ngoài ISR lên luôn', '`unclean.leader.election.enable=true`', 'Chạy lại ngay; **mất** các tin bản đó chưa có'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Hợp với', text: 'Dữ liệu "mất vài tin cũng được" như log, metric. Không hợp với đơn hàng, thanh toán.' },
            { title: 'Bật tạm để cứu hộ', text: 'Partition đứng nhiều giờ và chấp nhận mất tin → bật `true`, cụm ổn rồi **nhớ tắt đi**.' },
            { title: 'minISR = 2 giảm cái giá', text: 'Khi ISR còn 1, partition đã ngừng nhận ghi từ trước, nên ít tin "đã OK rồi biến mất".' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Topic thanh toán, ISR trống. Nên làm gì?', ['Bật unclean ngay', 'Giữ mặc định (chờ), khôi phục broker ISR', 'Xoá topic', 'Tăng partition'], 1, 'Dữ liệu thanh toán không chấp nhận mất tin.')],
        },
      ],
    },
    {
      id: 'leader-epoch',
      title: 'Leader epoch: chỉ cắt đúng phần sai',
      blocks: [
        { kind: 'video', scenes: ['epoch'] },
        {
          kind: 'p',
          text: 'Ngày xưa follower khởi động lại thì **cắt log về HW nó đang nhớ** — mà HW của follower luôn **chậm một nhịp**, nên có lúc cắt mất tin đã commit (KIP-101). Giờ mỗi lần đổi leader, **epoch** tăng 1 và log ghi "epoch N bắt đầu từ offset X". Follower hỏi leader "epoch cuối của tôi kết thúc ở đâu?" rồi chỉ cắt phần thực sự sai.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Follower dùng gì để biết phải cắt log tới đâu?', ['High Watermark nó đang nhớ', 'Hỏi leader epoch cuối của nó kết thúc ở offset nào', 'Timestamp', 'Không cắt gì'], 1, 'Cắt theo HW cũ từng gây mất tin; leader epoch chính xác hơn.')],
        },
      ],
    },
    {
      id: 'kraft',
      title: 'Controller KRaft',
      blocks: [
        { kind: 'video', scenes: ['quorum'] },
        {
          kind: 'table',
          head: ['Số controller', 'Đa số', 'Chịu được mất'],
          rows: [
            ['3', '2', '1'],
            ['5', '3', '2'],
            ['4', '3', '1 (không hơn 3 → không ai dùng số chẵn)'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'KRaft', text: 'Metadata (topic, leader, ISR) nằm trong log nội bộ `__cluster_metadata`; production từ Kafka 3.3, Kafka 4.0 bỏ hẳn ZooKeeper.' },
            { title: 'Preferred leader', text: 'Broker sống lại **không tự lấy lại** vai leader; `auto.leader.rebalance.enable` (mặc định bật) trả leader về bản ưu tiên mỗi 300 giây khi lệch quá 10%.' },
            { title: 'Controller epoch', text: 'Controller cũ "ngủ quên" (GC dài) tỉnh dậy gửi lệnh mang epoch cũ → broker bỏ qua.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Cụm 3 controller mất 2. Điều gì xảy ra?', ['Mất hết dữ liệu', 'Cụm đóng băng metadata: vẫn đọc/ghi qua leader hiện tại, nhưng không bầu leader mới, không tạo topic', 'Mọi thứ bình thường', 'Broker tự làm controller'], 1, 'Không đủ đa số thì không ra được quyết định mới.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chọn leader khi broker chết',
      blocks: [
        { kind: 'p', text: 'Tắt bật từng broker và chọn `unclean.leader.election.enable`. **Đoán trước**: tắt broker-1 và broker-2 khi broker-3 đang ngoài ISR thì partition ra sao?' },
        { kind: 'widget', name: 'election-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Leader chết, ISR = {2, 3}. Ai có thể lên làm leader?', ['Chỉ broker 1', 'Broker 2 hoặc 3', 'Bất kỳ broker nào', 'Không ai'], 1, 'Leader mới chọn từ ISR.'),
    q('unclean.leader.election.enable mặc định là gì (từ 0.11)?', ['true', 'false', 'tuỳ topic', 'không có'], 1, 'Kafka mặc định ưu tiên không mất dữ liệu.'),
    q('Vì sao unclean election có thể làm consumer thấy "hai sự thật"?', ['Vì nén', 'Vì leader mới đánh số lại offset cũ cho tin mới', 'Vì consumer lỗi', 'Vì có hai topic'], 1, 'Offset 9–12 cũ và mới có nội dung khác nhau.'),
    q('Cụm 5 controller chịu được mất tối đa bao nhiêu?', ['1', '2', '3', '4'], 1, 'Đa số 3/5, mất 2 vẫn còn 3.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao bật unclean election thì partition chạy lại được nhưng có thể mất tin?',
      keywords: ['ISR', 'thiếu', 'leader', 'mất'],
      modelAnswer:
        'Vì khi ISR trống, bản còn sống nằm ngoài ISR nên thiếu các tin gần nhất. Bật unclean thì Kafka cho bản đó làm leader để partition hoạt động lại ngay, nhưng những tin nó chưa có coi như mất, và các broker cũ khi quay lại phải cắt bỏ phần dư cho khớp leader mới.',
    },
  ],
  recap: {
    journey:
      'ISR co dần tới trống, chỉ còn bản thiếu dữ liệu → bình thường leader mới chọn từ ISR nên không mất tin → ISR trống thì chờ (mặc định) hoặc unclean (chạy ngay, mất tin, hai sự thật) → leader epoch giúp follower cắt đúng phần sai → mọi quyết định do controller KRaft với đa số.',
    points: [
      { title: 'Bầu từ ISR', text: 'Không mất tin đã báo OK với acks=all.' },
      { title: 'Unclean', text: 'Mặc định tắt: chờ thay vì mất tin; chỉ bật tạm để cứu hộ.' },
      { title: 'Leader epoch', text: 'Follower hỏi leader để cắt đúng phần sai, không cắt theo HW cũ.' },
      { title: 'KRaft', text: 'Controller cần đa số; mất đa số → metadata đóng băng.' },
    ],
    next: 'Bài tiếp theo (Module 5): Consumer group & rebalance.',
  },
}
