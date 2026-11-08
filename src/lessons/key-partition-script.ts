import type { LessonScript } from '../player/types'

/** Narration for the key → partition lesson. Each beat is spoken by the voice track and drives the animation timing. */
export const keyPartitionScript: LessonScript = {
  slug: 'key-partition',
  module: 'Module 2 · Topic, Partition, Key',
  title: 'Key quyết định Partition',
  summary:
    'Tin có key đi vào partition nào, vì sao cùng key luôn giữ thứ tự, và vì sao tăng số partition có thể làm một key "đổi nhà" và phá thứ tự.',
  scenes: [
    {
      id: 'lanes',
      title: 'Partition là gì',
      beats: [
        'Một topic được chia thành nhiều partition, giống như các làn đường song song.',
        'Mỗi partition là một log riêng, và offset đếm riêng từ số 0.',
        'Vậy khi producer gửi một tin, tin đó sẽ đi vào làn nào?',
      ],
    },
    {
      id: 'hash',
      title: 'hash(key) % N',
      beats: [
        'Nếu tin có key, producer tính hash của key, rồi chia lấy dư cho số partition.',
        'Key A có hash bằng 7. 7 chia 3 dư 1, nên tin A đi vào partition 1.',
        'Key B có hash 9, chia 3 dư 0, vào partition 0. Key C có hash 14, dư 2, vào partition 2.',
        'Các tin A tiếp theo cũng luôn vào partition 1, vì hash của A không bao giờ đổi.',
      ],
    },
    {
      id: 'order',
      title: 'Thứ tự',
      beats: [
        'Trong partition 1, A1, A2, A3 nằm đúng thứ tự gửi.',
        'Mỗi consumer đọc một partition, và các consumer chạy song song với nhau.',
        'Giữa các partition không có thứ tự chung. Muốn giữ thứ tự cho cái gì, hãy dùng chính nó làm key, ví dụ wallet id.',
      ],
    },
    {
      id: 'resize',
      title: 'Thêm partition',
      beats: [
        'Traffic tăng, ta thêm partition thứ tư. Công thức giờ là hash chia lấy dư cho 4.',
        'Tin mới A4: 7 chia 4 dư 3, nên A4 đi vào partition 3, không còn ở partition 1 nữa.',
        'B3 cũng đổi nhà sang partition 1. Chỉ có C là may mắn giữ nguyên.',
        'A3 và A4 giờ do hai consumer khác nhau xử lý, nên A4 có thể xong trước A3. Thứ tự của A bị phá.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 1.5,
      beats: [
        'Một: cùng key thì cùng partition, vì hash của key không đổi.',
        'Hai: thứ tự chỉ được giữ bên trong một partition.',
        'Ba: hãy chọn key là thứ cần giữ thứ tự, như wallet id.',
        'Và bốn: thêm partition sẽ làm key đổi nhà, nên hãy làm lúc thấp điểm.',
      ],
    },
  ],
}
