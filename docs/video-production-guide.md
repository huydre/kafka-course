# Cách làm bài học có video (Kafka course)

Ghi lại quy trình đã chốt để làm bài học có video theo phong cách sydexa.com: nhiều video ngắn trong một bài, giọng đọc tiếng Việt, motion 3D, camera chuyển động, xen lý thuyết ngắn, quiz và mô phỏng.

## 1. Kiến trúc

| Thành phần | File | Vai trò |
|---|---|---|
| Kịch bản lời đọc | `src/lessons/<slug>-script.ts` | Dữ liệu thuần: các cảnh (scene), mỗi cảnh gồm nhiều **beat** (mỗi beat là một câu thoại). Không import React hay Remotion. |
| Cảnh + nội dung bài | `src/lessons/<slug>.tsx` | Hàm render từng cảnh `(t, cue) => JSX`, rồi `sections` (lý thuyết, video, quiz, widget), `finalQuiz`, `recap`. |
| Bộ motion | `src/player/motion-kit.tsx` | Scene (nền, camera, watermark), Kinetic, TitleCard, Panel 3D, CodeWindow, Stamp, Chevrons, Burst, Pill và các icon. |
| Thời gian theo giọng | `src/player/timeline.ts` | Đọc `voice-manifest.json` để tính lúc bắt đầu mỗi beat. `cue.at(k)` là giây bắt đầu beat k, `cue.end(k)` là giây beat k nói xong. |
| Video Remotion | `src/remotion/lesson-video.tsx`, `remotion-root.tsx` | Mỗi khối `{ kind: 'video' }` thành một composition `<slug>--<section-id>`. Có cross-fade giữa các cảnh và chèn audio từng beat. |
| Trình phát web | `src/player/video-player.tsx` | `@remotion/player` kèm nút điều khiển riêng, phụ đề, ảnh bìa (poster). |
| Nội dung trang | `src/components/lesson-content.tsx`, `widgets.tsx`, `quiz-panel.tsx` | Hiển thị block lý thuyết, mô phỏng tương tác và quiz. |
| Giọng đọc | `scripts/generate-voice.ts`, `scripts/vieneu_batch.py` | VieNeu-TTS chạy cục bộ, giọng **"Hải Đăng"**. |

## 2. Cấu trúc một bài (giống sydexa)

1. **Lộ trình bài học** (`roadmap`): 3 chặng.
2. **Phần 1…N** (`sections`). Mỗi phần thường theo thứ tự:
   - (tuỳ chọn) quiz `Dự đoán trước khi xem`;
   - video ngắn, 1 cảnh, khoảng 15–25 giây;
   - lý thuyết ngắn: `p`, `list`, `table`, `code`, `callout` (tip, warn, info);
   - quiz `Quick Quiz` 1 câu.
3. **Thực hành**: một `widget` mô phỏng tương tác. Đăng ký widget trong `WIDGETS` ở `widgets.tsx`.
4. **Nhìn lại cả bài**: video tóm tắt.
5. **Kiểm tra kiến thức** (`finalQuiz`): khoảng 5 câu, câu cuối tự luận bắt buộc có "vì".
6. **Tổng kết** (`recap`): hành trình, 4 ý chính, gợi ý bài tiếp theo.

Văn bản trong block hỗ trợ `**đậm**` và `` `code` ``. Lời văn bám theo tài liệu trong `docs/kafka/`, luôn nêu cả "vì sao", không chỉ "là gì".

## 3. Phong cách "sơ đồ kỹ thuật" (chuẩn từ 09/11/2026)

Người dùng chê phong cách thẻ neon là "AI slop": mọi thứ cùng một kiểu thẻ bo tròn phát sáng, bố cục lặp "tiêu đề → 3 thẻ → câu chốt", hình không mô tả cơ chế. Từ nay video mới dùng **bộ hình sơ đồ kỹ thuật** trong `src/player/schematic.tsx`, nền `backdrop="plain"` (phẳng, lưới chấm mờ, không bokeh, không vignette). Xem toàn bộ: `npm run studio` → `showcase/schematic`. Ví dụ hoàn chỉnh: cảnh `lossSchematic` trong `src/lessons/acks-idempotence.tsx`.

**Mỗi khái niệm Kafka một hình, dùng nhất quán ở mọi bài:**

| Khái niệm | Component | Hình |
|---|---|---|
| Log / partition | `LogTape` | dải băng ô, số offset bên dưới; trạng thái ô `empty / filled / new / missing / dead`; mốc `marks` (HW, LEO, committed); con trỏ `cursor` (đang chép, đang đọc) |
| Topic nhiều partition | `PartitionTapes` | nhiều dải xếp chồng, nhãn P0, P1… |
| Broker | `ServerUnit` | tủ máy chủ 2U, đèn trạng thái; `down` = gạch chéo đỏ |
| Producer | `ProducerBox` | cửa sổ terminal có dòng lệnh |
| Tin đang bay | `MessageCell` | một ô cùng kiểu với ô của dải log |
| Consumer | `ConsumerCaret` | mũi tam giác dưới dải log + tên + offset |
| Luồng / quan hệ | `Wire` | mũi tên mảnh, nhãn ở giữa |
| Chú thích | `Note` | chấm + đường dẫn gấp khúc + chữ, như chú thích bản vẽ |
| Câu chốt | `Statement` | chữ lớn phẳng, một màu, không phát sáng |

**Quy tắc:**
- Bố cục theo **cấu trúc thật** của cơ chế (ví dụ hai dải log leader/follower đặt song song để thấy độ lệch), không xếp thẻ thành hàng cho có.
- Người xem phải **thấy cơ chế mà không cần đọc chữ**: trạng thái nằm ở hình (ô đỏ nét đứt = mất, con trỏ vàng = đang chép, gạch chéo = chết). Chữ chỉ là chú thích ngắn bằng `Note`.
- Màu (`INK`): nền `#0b0f17`, nét `#3a4458`, chữ `#d6dbe4`; một màu nhấn `accent` xanh cho thứ đang được nói tới; `warn` vàng cho tiến trình; `bad` đỏ cho mất/lỗi; `good` xanh lá cho đúng/xong. Không phát sáng, không gradient, nét 2px.
- Camera chuyển động chậm và ít (đẩy vào nhẹ ở khoảnh khắc chính), vì sơ đồ cần đứng yên để đọc.
- Vẫn giữ: `TitleCard` mở cảnh, đồng bộ theo `cue.at(k)`, soát ảnh tĩnh theo §6.

## 3b. Quy tắc phong cách cũ (thẻ neon — các bài đã làm trước 09/11)

> **Chuẩn chất lượng: các video của bài "Segment, Roll & Retention"** (`src/lessons/segment-retention.tsx`). Trước khi làm video mới, hãy render vài khung của bài này để so. Mỗi cảnh mở bằng `TitleCard`; nội dung chính là thẻ neon to (kiểu `SegmentCard`: số liệu ~70–80px, viền phát sáng); tin nhắn là chip phát sáng; khoảnh khắc chốt dùng `Kinetic` hoặc `Stamp`; đạo cụ là icon đơn giản; nền mặc định là `grid` phẳng. Thẻ phải chứa **dữ liệu** (số to, dải khối log, thanh tiến độ, huy hiệu trạng thái), không chứa câu chữ như "đã ghi" hay "đang chép…"; dùng `DataCard` (broker/producer) và `Stream` (dòng tin chảy liên tục) trong motion-kit. Trạng thái đổi bằng màu viền + huy hiệu (LEADER / OFFLINE / LEADER MỚI), không đóng dấu đè lên tiêu đề. Các thẻ cùng cỡ, xếp thành hàng. **Ví dụ đời thường cũng vẽ bằng thẻ neon** (viền hổ phách) có icon bên trong, không dựng cảnh hoạt hình phẳng hay nhân vật — người dùng đánh giá các bản đó xấu hơn bản gốc.

Rút ra từ việc xem video thật của sydexa:

- **Mỗi khung hình chỉ một ý.** Chữ to (tiêu đề khoảng 100px, số liệu từ 90px). Không bày nhiều chi tiết nhỏ, vì lời đọc đã mang nội dung.
- **Mở cảnh bằng `TitleCard`**: chữ hiện từng ký tự từ mờ sang nét, nền phía sau tối và mờ đi, rồi chữ thu lên góc trên (dock) để nhường chỗ.
- **Bề mặt** là `Panel` xám có viền neon (blue, cyan, green, red, amber, violet), xoay vào bằng 3D và nghiêng nhẹ liên tục. Màu đỏ cho cách sai hoặc tốn kém, xanh lá cho cách đúng.
- **Khoảnh khắc "à ra thế"**: `Kinetic` chữ neon lớn ("10 TRIỆU TIN", "80 MB RAM"), `Stamp` ("SAI", "SAI THỨ TỰ"), hai panel đỏ và xanh so sánh với `Chevrons` ở giữa.
- **Minh hoạ thật**: icon HDD, RAM, file .log, sách, đồng hồ, cờ, máy bay giấy, bánh răng, cửa sổ code gõ dần (`CodeWindow`).
- **Camera luôn chuyển động**, xem phần 4.
- Nền tối có lưới mờ, quầng sáng xanh trôi chậm, vignette. Watermark `kafka·lab` ở góc trên bên phải.

### Học thêm từ kênh YouTube sydexa (video dài, giải thích một cơ chế)

Rút ra sau khi xem "PostgreSQL giữ dữ liệu khi máy chủ sập" và "Lỗ hổng Hack RAM":

- **Mở đầu bằng câu chuyện (cold open), không vào thẳng sơ đồ.** Hai kiểu đã thấy:
  - **Bảng điều tra:** tờ giấy ghim trên bảng gỗ, đèn rọi, câu hỏi bị khoanh đỏ bằng tay, dây đỏ nối các manh mối.
  - **Nhân vật minh hoạ** đang gặp tình huống đời thường, ví dụ làm bài thi với đồng hồ đếm ngược.

  Trong kit: `Scene backdrop="board"`, `Paper`, `CaseLabel`, `HandCircle`, `RedString`. Đặt video này trong `lesson.intro`: nó hiện trước phần Lộ trình, kèm 1 câu Quick Quiz "đoán trước". Ví dụ mẫu: cảnh `hook` của bài Segment & Retention.
- **Ví dụ đời thường đặt song song với sơ đồ kỹ thuật:** một panel tình huống (màu cam) bên trái, sơ đồ hệ thống bên phải. Hai bên phản chiếu nhau từng bước.
- **Ví dụ đời thường phải được VẼ thành cảnh, và cùng cấu trúc với sơ đồ Kafka.** Không dùng ô chữ hay icon chung chung (người dùng chê bản "Quầy 1, Quầy 2" là xấu và không trực quan). Bản đạt: quầy thu ngân có băng chuyền và máy tính tiền, khách đẩy xe xếp hàng, thu ngân đội mũ đeo tạp dề, người thừa ngủ gật trên ghế băng. **Hàng i bên siêu thị đặt ngang hàng với partition i bên Kafka**, và ở cảnh toàn có thanh chú giải "khách hàng = tin nhắn · quầy = partition · thu ngân = consumer". Trong kit: `ShopperIcon`, `CashierIcon`, `CheckoutCounter`.
- **Một sơ đồ hệ thống dùng lại cả video**, ví dụ hộp "Broker" có vùng RAM và vùng Đĩa. Mỗi bước chỉ thêm chi tiết lên sơ đồ đó, không đổi sang hình mới.
- **Ít màu (người dùng chê nhiều màu là "AI slop").** Mỗi cảnh chỉ dùng: **xám/slate** cho mọi thứ trung tính (người, đồ vật, đường nối, chữ phụ), **một màu chính xanh dương** cho phía Kafka, **một màu nhấn hổ phách** cho phía ví dụ đời thường, **đỏ** chỉ cho lỗi hoặc thứ quá tải, **xanh lá** chỉ cho "đúng/xong". Không tô cầu vồng theo từng đối tượng: muốn phân nhóm thì dùng hai sắc độ của cùng màu xanh. Hình minh hoạ (`ShopperIcon`, `CashierIcon`, `CheckoutCounter`) mặc định xám, có tham số `accent` cho màu nhấn duy nhất.
- **Màu và nét có nghĩa cố định:**
  - tím = log/WAL; xanh dương = dữ liệu; xanh lá = commit/thành công; cam = ví dụ đời thường/cảnh báo; đỏ = sự cố.
  - **Viền nét đứt = bộ nhớ dễ mất (RAM), viền liền = bền (đĩa).**
- **Nhãn ghi chú nhỏ gắn ngay cạnh chi tiết** ("bản mới", "lúc báo thành công", "máy sập"). **Gạch ngang** một kết luận khi nó bị bác bỏ. Ô **"?" nét đứt** cho thứ chưa biết.
- **Nhịp chậm ở phần sơ đồ:** khung, nhãn, đường nối hiện dần. Ít xoay 3D hơn video ngắn. Giữ camera động cho phần mở đầu và các khoảnh khắc "à ra thế".
- **Kết thúc bằng slide "Bài học"** dạng checklist ✓ (trong khoá học dùng `SummaryGrid`).

### Nền (backdrop)

Chọn qua `<Scene backdrop="…">` (code ở `src/player/backdrops.tsx`). Mọi nền đều dựng procedural (phối cảnh SVG, ánh sáng thể tích, chất liệu từ fractal noise), tối, ít màu và phản ứng theo camera. Toàn khung có film grain (`FilmGrain`, đổi 12 lần/giây). Xem cả 7 nền: `npm run studio` → `showcase/backdrops`.

| Tên | Hợp với |
|---|---|
| `grid` (mặc định) | sàn lưới phối cảnh vô tận, có đường chân trời phát sáng — sơ đồ Kafka thông thường |
| `board` | mở đầu kiểu "hồ sơ vụ việc" |
| `blueprint` | công thức, kiến trúc, cấu trúc file |
| `servers` | lối đi phòng máy chủ 3D, đèn trạng thái nhấp nháy — sự cố vận hành, broker, cluster |
| `terminal` | log, lệnh CLI, debug |
| `desk` | ví dụ đời thường, câu chuyện |
| `studio` | tóm tắt, chữ lớn, khoảnh khắc "à ra thế" |

Trong một bài nên đổi nền giữa các phần cho đỡ nhàm, nhưng trong một video thì giữ một nền.

**Nền luôn phải lùi ra sau nội dung** (người dùng phản hồi: nền chi tiết quá làm mất tập trung). Vì vậy mọi nền (trừ `board`) đều có lớp `Calm` làm tối và dịu vùng giữa, chi tiết chỉ còn ở rìa khung. Chuyển động của nền phải rất chậm. Không thêm chữ, hình vẽ nổi bật hay hoạ tiết tương phản cao vào nền. Muốn gây ấn tượng thì làm ở nội dung, không làm ở nền.

## 4. Công thức camera

`cameraAt(t, [[time, shot, glideSeconds?], ...])`, trong đó `shot = { x, y, s, r?, rx?, ry? }`: nhìn vào điểm (x, y) của world với độ zoom `s`, xoay khung `r`, nghiêng 3D `rx`/`ry` tính bằng độ. Thế giới rộng 1920×1080 nhưng có thể đặt nội dung ngoài khung (ví dụ consumer ở x > 1920) để camera lia tới.

| Cú máy | Cách làm |
|---|---|
| Dolly 3D mở cảnh | Key đầu tiên `{ s: 1.25–1.35, rx: 25–30, ry: ±12–18 }`, sau đó lướt chậm 2–2.5 giây về góc thẳng. |
| Zoom vào chỗ đang tính | Đặt key ngay lúc beat bắt đầu, `s ≈ 1.4`, lướt 0.9 giây. |
| Bám theo vật thể | Trộn (lerp) vị trí camera về vị trí vật thể, ví dụ đầu đọc hay tin nhắn, theo hệ số `follow` từ 0 đến 1. |
| Lia để lộ phần mới | Chuyển `x` sang vùng ngoài khung, ví dụ để lộ consumer. |
| Kéo ra toàn cảnh | `s ≈ 0.6–0.86` khi cần so sánh hoặc tổng hợp. |
| Tóm tắt | Mỗi beat camera dừng ở một thẻ (`s ≈ 1.25–1.3`, `ry` ±8–10), cuối cùng kéo ra thấy cả nhóm. |

Các hiệu ứng sau đã có sẵn trong kit, mọi video tự có, không cần thêm:
- **Camera "thở":** trôi và zoom rất nhẹ liên tục (trong `Scene`).
- **Camera bám kiểu gimbal:** keyframe chỉ là **đích**. Camera đuổi theo đích bằng bộ lọc giảm chấn (SmoothDamp, `SMOOTH_TIME` 0,32 giây, nhìn trước `LOOKAHEAD` 0,24 giây để đến đúng lúc). Nhờ vậy các cú liền nhau nối thành đường cong, không dừng rồi rẽ gắt. Đo trên một chuỗi 4 cú máy: tốc độ đỉnh và độ giật đều giảm khoảng 28% so với cách cũ.
- **Đường đi cong:** mỗi cú máy đi theo cung bezier (lệch 14% quãng đường, đổi phía luân phiên) thay vì đường thẳng. Zoom tính theo thang **log** nên tốc độ zoom cảm nhận đều.
- Vì camera đến đích trễ khoảng 0,1–0,3 giây, **đặt key sớm hơn khoảng 0,2 giây** so với lúc muốn khung hình đứng yên. Chữ ở mép khung nên chừa thêm lề.
- **Nghiêng cua theo tốc độ:** lia ngang nhanh thì khung nghiêng tối đa khoảng 3°, di chuyển nhanh thì lùi ra tối đa 6%, dừng lại thì về như cũ (trong `cameraAt`).
- **Bokeh parallax:** hạt sáng hậu cảnh trôi bằng 0,35 tốc độ camera, hạt tiền cảnh trôi bằng 1,55 lần, tạo chiều sâu. Nền `board` dùng hạt màu ấm.
- **Lấy nét mở đầu:** 0,9 giây đầu mỗi video đi từ mờ sang rõ, kèm zoom nhẹ.
- **Vệt sáng quét ngang** mỗi `Panel` ngay sau khi nó xuất hiện.
- **Motion blur thật** (`CameraMotionBlur`, 6 mẫu) chỉ áp khi xuất MP4. Web player giữ nét và nhẹ. Giọng đọc nằm **ngoài** lớp blur, nếu không tiếng sẽ phát chồng 6 lần.
- Vật thể đang bay nên có **vệt đuôi**: vẽ lại vật ở các thời điểm `t − k·0.035` với độ mờ giảm dần. Xem `FlyingChip` trong bài Key → Partition.

> Xuất MP4 có motion blur mất khoảng **12 giây xử lý cho mỗi giây video**: video 22 giây mất khoảng 4,5 phút. Còn `npm run stills` render ảnh tĩnh có blur, nên cũng chậm hơn trước.

## 5. Đồng bộ với giọng đọc

- Mọi animation đặt mốc theo `cue.at(k)` hoặc `cue.end(k)`, **không đặt theo giây cứng**. Sửa câu thoại thì hình tự khớp lại.
- Khoảng lặng: `LEAD 0.5s`, `GAP 0.45s`, `TAIL 1.1s` (trong `timeline.ts`). Dùng `hold` trong script nếu cần giữ khung cuối lâu hơn.
- Kiểm tra mỗi beat đủ dài cho chuỗi animation bên trong nó. Xem độ dài thật trong `src/lessons/voice-manifest.json`.

### Hiệu ứng âm thanh (SFX)

- 5 tiếng tự tổng hợp bằng `npm run sfx` (`scripts/generate_sfx.py` → `public/sfx/`), không dùng mẫu có bản quyền: `whoosh`, `pop`, `tick`, `ding`, `error`.
- **Tự động cho mọi cảnh** (`lesson-video.tsx`): `whoosh` khi vào cảnh, `pop` nhẹ ở đầu mỗi beat từ beat thứ hai trở đi.
- **Khoảnh khắc chính** khai báo trong bài: `sfx: [{ kind: 'error', at: (c) => c.at(1) + 0.2 }]`. Dùng **đúng công thức mốc mà hàm render dùng**, để tiếng khớp hình. `pop` tự động bị bỏ nếu có tiếng khai báo trong khoảng 0,35s quanh đầu beat.
- Quy ước: `error` khi broker chết hoặc mất tin; `ding` khi kết quả an toàn (leader mới lên, ghi xong); `tick` khi một con số hay trạng thái nhỏ đổi. Mỗi cảnh tối đa khoảng 3 tiếng khai báo, để giọng đọc luôn nổi lên trên.

## 6. Quy trình làm một bài hoặc một phần mới

1. Viết `src/lessons/<slug>-script.ts`: các cảnh và beat. Mỗi beat là một câu ngắn. Số đọc thành chữ nếu dễ đọc sai, ví dụ "một trăm hai mươi byte".
2. `npm run voice` để thu âm. Chỉ những câu mới hoặc đã sửa mới được thu lại.
3. Viết hàm render từng cảnh trong `src/lessons/<slug>.tsx` bằng motion-kit, cùng `sections`, `finalQuiz`, `recap`. Khai báo bài trong `course-catalog.ts`.
4. Thêm `import` script mới vào `SCRIPTS` trong `scripts/generate-voice.ts`.
5. **Soát bằng ảnh tĩnh**: `npm run stills -- <slug>--<section> <frame> ...`, rồi xem ảnh trong `out/frames/`. Chọn frame quanh lúc mỗi beat nói gần xong (khoảng 90% beat) và giữa các cú máy. Sửa chỗ chữ đè lên hình hoặc bị cắt.
   Bắt buộc soát thêm 3 loại frame:
   - **Lúc đang nhắc tới vật thể chính.** Vật thể đó phải nhìn thấy rõ. Ví dụ khi máy hiện `hash(A) = 7 → 7 % 4 = 3` thì phải thấy chip A4.
   - **Sau khi bố cục đổi** (ví dụ 3 làn thành 4 làn): mọi nhãn hay pill cũ còn nằm đúng chỗ, không đè lên làn hay nhãn mới.
   - **Cảnh có camera thu nhỏ hoặc có thêm hàng mới:** chữ phụ (thanh tiến độ, chú thích) không đè lên thẻ của hàng bên cạnh.
6. `npx tsc -p .` và `npm run build`.
7. Xem trên web (`npm run dev`), Remotion Studio (`npm run studio`), hoặc xuất MP4: `npm run render -- <slug>--<section> out/<ten>.mp4`.

## 7. Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Web khoá học (Vite) |
| `npm run voice [-- <slug>]` | Thu âm giọng Hải Đăng (VieNeu). `TTS_VOICE="Tên"` để đổi giọng. |
| `npm run sfx` | Tổng hợp lại hiệu ứng âm thanh vào `public/sfx/` |
| `npm run stills -- <id> <frame...>` | Render ảnh tĩnh để soát |
| `npm run studio` | Mở Remotion Studio |
| `npm run render -- <id> out/x.mp4` | Xuất MP4 (phụ đề in sẵn ở dải dưới) |

## 8. Lỗi đã gặp và cách xử lý

- **VieNeu báo lỗi `External data path escapes model directory`**: onnxruntime mới không chịu đọc model qua symlink trong `~/.cache/huggingface`. Cách sửa: thay symlink bằng file thật trong `snapshots/` của 2 repo `models--pnnbao-ump--VieNeu-TTS-v3-Turbo` và `models--OpenMOSS-Team--MOSS-Audio-Tokenizer-Nano-ONNX`.
- **VieNeu** được cài trong `kafka-course/vieneu-env` (đã gitignore). Model v3 Turbo dùng giấy phép Apache 2.0.
- **Hàm `vis` / `fade` có mốc kết thúc là `Infinity`** phải bỏ qua phép trừ. Nếu không sẽ ra `NaN`, trình duyệt coi opacity NaN là 1, và phần tử hiện ra quá sớm.
- **Trình phát web**: tắt `clickToPlay` và `spaceKeyToPlayOrPause` của Remotion Player, vì mình tự xử lý click và phím. Nếu không, mỗi lần bấm sẽ bị bật rồi tắt ngay.
- **Khi kiểm thử bằng Playwright**: tab nền bị chặn `requestAnimationFrame` nên video không chạy. Gọi `page.bringToFront()` trước.
- **Video có phụ đề in sẵn**: thế giới HTML 1920×1080 phải được `scale()` vào khung 920px. Không được chỉ đổi chiều cao khung.
- **Không để chữ tiêu đề lớn đè lên hình**: `TitleCard` đã có lớp nền tối (scrim) che phía sau.
- **Không bao giờ làm mờ hay ẩn vật thể đang được nói tới.** Từng để chip mờ 15% khi nằm "trong" máy partitioner, nên người xem tưởng A4 biến mất. Cách đúng: cho vật thể dừng **trên** máy (`WAIT`), hiện rõ và phát sáng.
- **Khi bố cục co giãn** (`laneY(i, q)`), nhãn đặt theo toạ độ cố định có thể bị làn mới đè lên. Đặt nhãn ở vùng trống chắc chắn, hoặc tính toạ độ theo bố cục mới.
- **Nội dung của một `Panel` phải nằm BÊN TRONG nó** (làm `children`, toạ độ tính từ góc trên trái của panel). Panel xoay 3D lúc xuất hiện và lắc nhẹ liên tục; nếu đặt ô số liệu hay biểu đồ chồng lên bằng toạ độ world, chúng sẽ lệch khỏi khung (lỗi từng gặp ở cảnh "lag 2 giờ sáng"). Nếu buộc phải đặt chồng thì dùng `<Panel still>`. Số liệu dài đặt `whiteSpace: 'nowrap'` và chừa đủ chiều rộng cho giá trị **lớn nhất** mà số đó có thể đạt tới.
- **Chú thích phụ của một hàng** (thanh tiến độ, trạng thái) đặt **bên cạnh** thẻ, đừng đặt bên dưới, vì hàng kế tiếp có thể sát ngay đó.
