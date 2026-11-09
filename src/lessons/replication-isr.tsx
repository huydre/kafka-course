import { HOME, Scene, TitleCard, cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerCaret, INK, LogTape, Note, ProducerBox, REPLICA, Replica, ServerUnit, Statement, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { replicationIsrScript } from './replication-isr-script'

const { CW, CELLS, TX, ROWS, cellX, panel } = REPLICA

/* ------------------------------------------------------------------ 0. cold open */

function hook(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const dead = t >= a1 + 0.6
  const restore = t >= a2 + 0.4
  const cam = cameraAt(t, [
    [0, { x: 900, y: 560, s: 1.12 }],
    [a2 + 0.2, { ...HOME, y: 560, s: 0.98 }, 1.4],
  ])
  return (
    <Scene t={t} camera={cam} backdrop="plain">
      {!restore ? (
        <>
          <ServerUnit x={120} y={500} name={dead ? 'broker-1 ✕ đĩa hỏng' : 'broker-1'} down={dead} t={t} />
          <LogTape x={TX} y={530} cells={CELLS} cellW={CW} title="payments-0 · bản duy nhất" state={(i) => (i < 12 ? (dead ? 'missing' : 'filled') : 'empty')} />
          <Note x={cellX(6)} y={565} dx={60} dy={170} text="mất toàn bộ partition" color={INK.bad} o={vis(t, a1 + 1.2)} />
        </>
      ) : (
        [0, 1, 2].map((r) => (
          <div key={r} style={{ opacity: clamp(sp(t, a2 + 0.4 + r * 0.25)) }}>
            <Replica row={r} name={`broker-${r + 1}`} leo={12} t={t} />
          </div>
        ))
      )}
      <Statement x={TX} y={930} text="giữ nhiều bản sao, trên nhiều broker khác nhau" color={INK.accent} o={sp(t, a2 + 1.4)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 1. leader & followers */

function replicas(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const leo = Math.floor(lerp(8, 12, span(t, a1 + 0.4, a1 + 2.6)))
  const f1 = lerp(8, 12, span(t, a2 + 0.6, a2 + 3.4))
  const f2 = lerp(8, 10, span(t, a2 + 1.0, a2 + 3.8))
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.98 }],
    [a3 - 0.1, { x: 980, y: 520, s: 1.06 }, 1.2],
  ])
  return (
    <Scene t={t} camera={cam} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="REPLICATION FACTOR = 3" title="Leader và follower" dock={1.2} />}>
      {[0, 1, 2].map((r) => {
        const isLeader = r === 0
        const myLeo = isLeader ? leo : r === 1 ? f1 : f2
        return (
          <div key={r} style={{ opacity: clamp(sp(t, a0 + 0.4 + r * 0.3)) }}>
            <Replica
              row={r}
              name={isLeader ? 'broker-1 · leader' : `broker-${r + 1} · follower`}
              leo={Math.floor(myLeo)}
              t={t}
              state={(i) => (i < 8 ? 'filled' : i < Math.floor(myLeo) ? 'new' : 'empty')}
              cursor={!isLeader && t >= a2 + 0.4 ? myLeo : undefined}
              cursorLabel={!isLeader && t >= a2 + 0.4 ? `fetch từ ${Math.floor(myLeo)}` : undefined}
            />
          </div>
        )
      })}
      <div style={{ opacity: vis(t, a1 - 0.2) }}>
        <ProducerBox x={1540} y={110} line="send(...)" w={300} />
        <Wire from={{ x: 1600, y: 205 }} to={{ x: cellX(leo), y: ROWS[0] - 8 }} color={INK.accent} p={move(t, a1, 0.5)} label="chỉ ghi vào leader" />
      </div>
      <Note x={cellX(Math.floor(f1))} y={ROWS[1] + 35} dx={-120} dy={110} text="follower tự kéo, như một consumer" color={INK.warn} o={vis(t, a2 + 1.0, a3)} />
      <Note x={cellX(Math.floor(f2))} y={ROWS[2] + 35} dx={-120} dy={140} text={`leader biết: broker-3 đã có mọi tin < ${Math.floor(f2)}`} color={INK.text} o={vis(t, a3 + 0.3)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 2. ISR */

function isr(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const leo = Math.floor(lerp(9, 14, span(t, a0, c.duration)))
  const lagSec = Math.round(lerp(0, 35, span(t, a1 + 0.2, a1 + 3.6)))
  const kicked = t >= a1 + 3.6 && t < a2 + 1.2
  const back = t >= a2 + 1.2
  const f3 = back ? leo : t < a1 ? leo : t < a2 ? 9 : lerp(9, leo, span(t, a2 + 0.1, a2 + 1.2))
  const set = kicked ? '{1, 2}' : '{1, 2, 3}'
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.98 }],
    [a1 + 0.2, { x: 1000, y: 640, s: 1.06 }, 1.2],
    [a2 + 0.4, { x: 960, y: 560, s: 0.98 }, 1.2],
  ])
  return (
    <Scene t={t} camera={cam} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="IN-SYNC REPLICAS" title="ISR: ai đang theo kịp?" dock={1.2} />}>
      <Replica row={0} name="broker-1 · leader" leo={leo} t={t} />
      <Replica row={1} name="broker-2" leo={leo} t={t} />
      <Replica row={2} name={kicked ? 'broker-3 · ngoài ISR' : 'broker-3'} leo={Math.floor(f3)} dim={kicked} t={t} cursor={t >= a1 && !back ? f3 : undefined} cursorLabel={t >= a1 && !back ? `chậm ${lagSec} s` : undefined} />
      <div style={{ ...panel, left: 1540, top: 190, color: kicked ? INK.warn : INK.good, borderColor: kicked ? INK.warn : INK.line, opacity: vis(t, a0 + 0.4) }}>ISR = {set}</div>
      <Note x={cellX(9)} y={ROWS[2] + 35} dx={-80} dy={160} text="quá 30 giây chưa đuổi kịp → loại khỏi ISR" color={INK.warn} o={vis(t, a1 + 1.0, a2)} />
      <Note x={cellX(leo)} y={ROWS[2] + 35} dx={-80} dy={160} text="đuổi kịp → thêm lại vào ISR" color={INK.good} o={vis(t, a2 + 1.2)} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 3. high watermark */

function hw(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const f2 = Math.floor(lerp(6, 9, span(t, a3 + 0.3, a3 + 1.8)))
  const leos = [10, 8, f2]
  const hwAt = Math.min(...leos)
  const showHw = t >= a1 + 0.4
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.98 }],

  ])
  return (
    <Scene t={t} camera={cam} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="HIGH WATERMARK" title="Đọc được tới đâu?" dock={1.2} />}>
      {leos.map((leo, r) => (
        <Replica
          key={r}
          row={r}
          name={r === 0 ? 'leader' : `follower ${r}`}
          leo={leo}
          t={t}
          state={(i) => (i < leo ? (showHw && i < hwAt ? 'filled' : 'new') : 'empty')}
          marks={[
            ...(t >= a0 + 0.4 ? [{ at: leo, label: `LEO ${leo}`, color: INK.accent }] : []),
            ...(showHw ? [{ at: hwAt, label: r === 0 ? `HW ${hwAt}` : '', color: INK.good }] : []),
          ]}
        />
      ))}
      <div style={{ ...panel, left: 1300, top: 900, color: INK.good, opacity: vis(t, a1 + 0.4) }}>HW = min({leos.join(', ')}) = {hwAt}</div>
      {t >= a2 && <ConsumerCaret tapeX={TX} tapeY={ROWS[2]} cellW={CW} at={hwAt} name="consumer" offset={hwAt} />}
      <Statement x={TX + 300} y={995} text="ô xanh sáng: chưa có ở mọi bản ISR → chưa cho đọc" color={INK.accent} size={34} o={Math.min(sp(t, a2 + 0.6), vis(t, 0, a3))} />
    </Scene>
  )
}

/* ------------------------------------------------------------------ 4. min.insync.replicas */

function minisr(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const followersDown = t >= a0 + 2.2
  const wroteX = t >= a0 + 3.6
  const leaderDown = t >= a1 + 1.0
  const phaseB = t >= a2 - 0.2
  const rows: [string, string, string][] = [
    ['3 broker sống', 'ISR = 3', 'ghi được ✓'],
    ['2 broker sống', 'ISR = 2', 'ghi được ✓'],
    ['1 broker sống', 'ISR = 1', 'NOT_ENOUGH_REPLICAS ✗'],
  ]
  const cam = cameraAt(t, [[0, { x: 960, y: 560, s: 0.98 }]])
  return (
    <Scene t={t} camera={cam} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="ACKS = ALL" title="Khi ISR chỉ còn một" tone="amber" dock={1.2} />}>
      {!phaseB && (
        <div style={{ opacity: vis(t, -1, a2 - 0.5) }}>
          <Replica row={0} name={leaderDown ? 'leader ✕' : 'leader'} leo={10} down={leaderDown} t={t} state={(i) => (i < 9 ? (leaderDown ? 'dead' : 'filled') : i === 9 && wroteX ? (leaderDown ? 'missing' : 'new') : 'empty')} />
          <Replica row={1} name={followersDown ? 'follower ✕' : 'follower'} leo={9} down={followersDown} t={t} />
          <Replica row={2} name={followersDown ? 'follower ✕' : 'follower'} leo={9} down={followersDown} t={t} />
          <div style={{ ...panel, left: 1540, top: 190, color: followersDown ? INK.warn : INK.good, borderColor: followersDown ? INK.warn : INK.line }}>ISR = {followersDown ? '{leader}' : '{1, 2, 3}'}</div>
          <Note x={cellX(9) + CW / 2} y={ROWS[0] + 35} dx={-60} dy={-110} text={leaderDown ? 'tin X mất — dù đã báo OK' : '"mọi bản ISR" = 1 bản → OK'} color={leaderDown ? INK.bad : INK.warn} o={vis(t, a0 + 3.8)} />
        </div>
      )}
      {phaseB && (
        <>
          <div style={{ position: 'absolute', left: 300, top: 260, ...{ fontFamily: MONO, fontSize: 34, color: INK.faint }, opacity: vis(t, a2) }}>replication.factor = 3 · min.insync.replicas = 2 · acks = all</div>
          {rows.map(([a, b, r], k) => {
            const bad = k === 2
            return (
              <div key={a} style={{ position: 'absolute', left: 300, top: 360 + k * 130, display: 'flex', gap: 60, alignItems: 'center', fontSize: 44, fontWeight: 600, color: INK.text, opacity: clamp(sp(t, a2 + 0.8 + k * 0.6)), borderBottom: `2px solid ${INK.line}`, paddingBottom: 26, width: 1320 }}>
                <span style={{ width: 380 }}>{a}</span>
                <span style={{ width: 260, fontFamily: MONO, color: INK.faint }}>{b}</span>
                <span style={{ fontFamily: MONO, color: bad ? INK.bad : INK.good }}>{r}</span>
              </div>
            )
          })}
          <Statement x={300} y={800} text="mọi tin đã OK đều nằm trên ít nhất 2 máy" color={INK.accent} o={sp(t, a3 + 0.4)} />
        </>
      )}
    </Scene>
  )
}

function summary(t: number, c: Cue) {
  return <SummaryList t={t} cue={c} items={['Một leader nhận ghi · follower tự kéo về', 'ISR = bản đang theo kịp · tụt > 30 s bị loại', 'HW = LEO nhỏ nhất trong ISR · consumer đọc tới HW', 'acks=all + min.insync.replicas=2']} />
}

const RENDERS: Record<string, LessonScene['render']> = { hook, replicas, isr, hw, minisr, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const replicationIsrLesson: Lesson = {
  ...replicationIsrScript,
  scenes: replicationIsrScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: với replication.factor = 3, chịu được mất tối đa bao nhiêu broker mà vẫn còn dữ liệu?', ['0', '1', '2', '3'], 2, 'RF tính cả leader: 3 bản, mất 2 vẫn còn 1. Nhưng còn ghi được không thì phụ thuộc min.insync.replicas (phần 4).')],
    },
  ],
  roadmap: [
    'Chặng 1: Leader và follower — ai nhận ghi, follower chép thế nào.',
    'Chặng 2: ISR và High Watermark — ai đáng tin, consumer được đọc tới đâu.',
    'Chặng 3: acks=all + min.insync.replicas — công thức bền vững, và tự tay thử.',
  ],
  sections: [
    {
      id: 'leader-follower',
      title: 'Leader và follower',
      blocks: [
        { kind: 'video', scenes: ['replicas'] },
        {
          kind: 'code',
          code: '            Broker 1        Broker 2        Broker 3\nP0          follower        follower        LEADER\nP1          LEADER          follower        follower\nP2          follower        LEADER          follower',
        },
        {
          kind: 'list',
          items: [
            { title: 'RF tính cả leader', text: '`replication.factor = 3` = 1 leader + 2 follower; RF không thể lớn hơn số broker.' },
            { title: 'Chỉ leader nhận ghi', text: 'Một người ghi thì thứ tự tự động đúng; nhiều nơi cùng ghi sẽ phải giải quyết xung đột.' },
            { title: 'Follower kéo, leader không đẩy', text: 'Follower gửi fetch "từ offset X" giống consumer; nhờ đó leader biết follower đã có mọi tin trước X.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Leader biết follower đã chép tới đâu bằng cách nào?', ['Follower gửi xác nhận riêng', 'Qua offset follower xin trong mỗi lần fetch', 'ZooKeeper báo', 'Leader tự đoán'], 1, 'Follower xin "từ offset X" nghĩa là đã có mọi tin trước X.')],
        },
      ],
    },
    {
      id: 'isr',
      title: 'ISR: những bản đang theo kịp',
      blocks: [
        { kind: 'video', scenes: ['isr'] },
        {
          kind: 'table',
          head: ['Thời điểm', 'Broker 2', 'Broker 3', 'ISR'],
          rows: [
            ['0 giây', 'đuổi kịp', 'đuổi kịp', '{1, 2, 3}'],
            ['5 giây', 'đuổi kịp', 'mạng chập, ngừng fetch', '{1, 2, 3}'],
            ['35 giây', 'đuổi kịp', 'vẫn chưa đuổi kịp', '**{1, 2}**'],
            ['60 giây', 'đuổi kịp', 'đã đuổi kịp', '**{1, 2, 3}**'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: 'Ngưỡng là `replica.lag.time.max.ms` (mặc định **30 giây** từ Kafka 2.5). Đo bằng **thời gian**, không bằng số tin: khi lưu lượng tăng đột biến, đo bằng số tin sẽ đá oan mọi follower.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao leader không chờ follower chậm?', ['Vì follower chậm vô dụng', 'Vì một máy chậm sẽ làm cả partition chậm theo; follower chậm bị loại khỏi ISR', 'Vì follower tự xoá', 'Vì consumer không đọc follower'], 1, 'Giữ follower chậm trong ISR thì producer acks=all và consumer đều phải chờ nó.')],
        },
      ],
    },
    {
      id: 'high-watermark',
      title: 'High Watermark: consumer đọc được tới đâu',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Leader LEO = 10, hai follower trong ISR có LEO 8 và 6. Consumer đọc được tới đâu?', ['10', '8', '6', '0'], 2, 'HW là LEO nhỏ nhất trong ISR. Xem video để thấy vì sao.')],
        },
        { kind: 'video', scenes: ['hw'] },
        {
          kind: 'code',
          code: 'Leader:  [0][1][2][3][4][5][6][7][8][9]     LEO = 10\nF1:      [0][1][2][3][4][5][6][7]           LEO = 8\nF2:      [0][1][2][3][4][5]                 LEO = 6\n                               ▲\n                             HW = min(10, 8, 6) = 6',
        },
        {
          kind: 'list',
          items: [
            { title: 'Đã commit', text: 'Tin dưới HW có trên mọi bản ISR — Kafka hứa không mất chừng nào còn một bản ISR sống.' },
            { title: 'Loại follower chậm', text: 'HW nhảy lên ngay, vì tập để lấy "nhỏ nhất" bớt người chậm.' },
            { title: 'Follower biết HW chậm một nhịp', text: 'HW đi kèm câu trả lời fetch — mầm mống của lỗi ở bài bầu leader.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Follower LEO 6 bị loại khỏi ISR. HW mới là?', ['6', '8', '10', 'không đổi'], 1, 'min(10, 8) = 8.')],
        },
      ],
    },
    {
      id: 'min-isr',
      title: 'acks=all + min.insync.replicas',
      blocks: [
        { kind: 'video', scenes: ['minisr'] },
        {
          kind: 'table',
          head: ['Broker còn sống', 'ISR', 'Ghi acks=all', 'Lời hứa'],
          rows: [
            ['3', '3', '✅ được', 'tin nằm ở ≥ 2 máy'],
            ['2', '2', '✅ được', 'tin nằm ở ≥ 2 máy'],
            ['1', '1', '❌ `NOT_ENOUGH_REPLICAS`', 'không ghi → không có gì để mất'],
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Ngân hàng cần 2 chữ ký',
          text: '`min.insync.replicas = 2` giống quy định rút tiền cần 2 người duyệt: hôm nay chỉ còn 1 người đi làm thì **thà đóng quầy** còn hơn cho rút với 1 chữ ký. minISR càng cao càng an toàn nhưng càng dễ ngừng nhận ghi (RF 3, minISR 3: mất 1 broker là không ghi được).',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('RF = 3, min.insync.replicas = 2, acks = all. Hai follower chết. Producer gửi tin thì sao?', ['Ghi bình thường', 'Bị từ chối: NOT_ENOUGH_REPLICAS', 'Ghi vào follower', 'Ghi nhưng không báo'], 1, 'ISR = 1 < 2 nên leader từ chối, đổi lại không có tin nào được báo OK mà chỉ nằm trên 1 máy.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tính High Watermark',
      blocks: [
        { kind: 'p', text: 'Kéo LEO của từng bản sao và bật/tắt bản nào nằm trong ISR. **Đoán trước**: loại follower chậm nhất khỏi ISR thì HW tăng hay giảm?' },
        { kind: 'widget', name: 'hw-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('RF = 3 nghĩa là gì?', ['3 leader', '1 leader + 2 follower, trên 3 broker khác nhau', '3 partition', '3 consumer'], 1, 'RF tính cả leader.'),
    q('Follower bị loại khỏi ISR khi nào (mặc định)?', ['Chậm hơn 1.000 tin', 'Không đuổi kịp leader trong 30 giây', 'Khi consumer lag cao', 'Khi đĩa đầy 80%'], 1, 'replica.lag.time.max.ms = 30 s.'),
    q('Vì sao consumer chỉ được đọc tới HW?', ['Để tiết kiệm băng thông', 'Vì tin trên HW chưa có ở mọi bản ISR, có thể biến mất nếu leader chết', 'Vì follower chưa nén', 'Vì offset chưa commit'], 1, 'Kafka không cho đọc tin có thể "biến mất".'),
    q('acks=all mà không đặt min.insync.replicas (mặc định 1). Rủi ro?', ['Không có', 'ISR co còn leader, "all" chỉ là 1 bản → leader chết là mất tin đã OK', 'Không ghi được', 'Trùng tin'], 1, 'Cần minISR = 2 để mọi tin OK nằm trên ít nhất 2 máy.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao HW bằng LEO nhỏ nhất trong ISR?',
      keywords: ['ISR', 'leader chết', 'mọi bản', 'mất'],
      modelAnswer:
        'Vì khi leader chết, một bản bất kỳ trong ISR có thể lên thay. Chỉ những tin có ở mọi bản trong ISR mới chắc chắn còn sau khi đổi leader, nên Kafka chỉ cho đọc tới LEO nhỏ nhất trong ISR. Đọc quá đó, consumer có thể thấy tin rồi tin lại biến mất.',
    },
  ],
  recap: {
    journey:
      'Một ổ đĩa hỏng là mất partition → giữ nhiều bản sao, một leader nhận ghi, follower tự kéo → ISR là những bản theo kịp → HW = LEO nhỏ nhất trong ISR, consumer đọc tới đó → acks=all phải đi cùng min.insync.replicas = 2.',
    points: [
      { title: 'Leader / follower', text: 'Chỉ leader nhận ghi; follower fetch như consumer.' },
      { title: 'ISR', text: 'Bản theo kịp; chậm quá 30 s bị loại, đuổi kịp được thêm lại.' },
      { title: 'High Watermark', text: 'LEO nhỏ nhất trong ISR; tin dưới HW là đã commit.' },
      { title: 'Công thức bền vững', text: 'RF 3 · min.insync.replicas 2 · acks all.' },
    ],
    next: 'Bài tiếp theo: Leader chết — bầu leader mới, unclean election và leader epoch.',
  },
}
