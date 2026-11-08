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

## 3. Quy tắc phong cách video

Rút ra từ việc xem video thật của sydexa:

- **Mỗi khung hình chỉ một ý.** Chữ to (tiêu đề khoảng 100px, số liệu từ 90px). Không bày nhiều chi tiết nhỏ, vì lời đọc đã mang nội dung.
- **Mở cảnh bằng `TitleCard`**: chữ hiện từng ký tự từ mờ sang nét, nền phía sau tối và mờ đi, rồi chữ thu lên góc trên (dock) để nhường chỗ.
- **Bề mặt** là `Panel` xám có viền neon (blue, cyan, green, red, amber, violet), xoay vào bằng 3D và nghiêng nhẹ liên tục. Màu đỏ cho cách sai hoặc tốn kém, xanh lá cho cách đúng.
- **Khoảnh khắc "à ra thế"**: `Kinetic` chữ neon lớn ("10 TRIỆU TIN", "80 MB RAM"), `Stamp` ("SAI", "SAI THỨ TỰ"), hai panel đỏ và xanh so sánh với `Chevrons` ở giữa.
- **Minh hoạ thật**: icon HDD, RAM, file .log, sách, đồng hồ, cờ, máy bay giấy, bánh răng, cửa sổ code gõ dần (`CodeWindow`).
- **Camera luôn chuyển động**, xem phần 4.
- Nền tối có lưới mờ, quầng sáng xanh trôi chậm, vignette. Watermark `kafka·lab` ở góc trên bên phải.

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

Camera "thở" (trôi nhẹ) đã có sẵn trong `Scene`, không cần thêm.

## 5. Đồng bộ với giọng đọc

- Mọi animation đặt mốc theo `cue.at(k)` hoặc `cue.end(k)`, **không đặt theo giây cứng**. Sửa câu thoại thì hình tự khớp lại.
- Khoảng lặng: `LEAD 0.5s`, `GAP 0.45s`, `TAIL 1.1s` (trong `timeline.ts`). Dùng `hold` trong script nếu cần giữ khung cuối lâu hơn.
- Kiểm tra mỗi beat đủ dài cho chuỗi animation bên trong nó. Xem độ dài thật trong `src/lessons/voice-manifest.json`.

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
- **Chú thích phụ của một hàng** (thanh tiến độ, trạng thái) đặt **bên cạnh** thẻ, đừng đặt bên dưới, vì hàng kế tiếp có thể sát ngay đó.
