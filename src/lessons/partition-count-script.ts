import type { LessonScript } from '../player/types'

/** Narration for the "how many partitions" lesson. Each beat is spoken by the voice track and drives the animation timing. */
export const partitionCountScript: LessonScript = {
  slug: 'partition-count',
  module: 'Module 2 · Topic, Partition, Key',
  title: 'Chọn số partition',
  summary:
    'Vì sao số partition là trần song song của consumer, cách tính số partition từ throughput, vì sao nhiều quá cũng hại, và mẹo chọn con số chia đều.',
  scenes: [
    {
      id: 'hook',
      title: 'Sự cố lúc 2 giờ sáng',
      hold: 1,
      beats: [
        'Hai giờ sáng, cảnh báo nổ: consumer lag đã vượt hai triệu tin.',
        'Bạn tăng số consumer từ sáu lên mười. Lag vẫn tiếp tục tăng.',
        'Vấn đề không nằm ở consumer, mà ở một con số đã chọn từ ngày đầu: số partition.',
      ],
    },
    {
      id: 'parallel',
      title: 'Trần song song',
      beats: [
        'Trong một nhóm, mỗi partition chỉ được giao cho đúng một consumer, để giữ thứ tự trong partition.',
        'Giống siêu thị có bốn quầy thu ngân: thuê sáu thu ngân thì hai người phải ngồi chơi.',
        'Nên số partition là trần song song: số consumer làm việc không bao giờ vượt quá số partition.',
      ],
    },
    {
      id: 'formula',
      title: 'Công thức',
      beats: [
        'Cách tính: lấy throughput mục tiêu chia cho tốc độ xử lý của một consumer.',
        'Ví dụ: cần một gigabyte mỗi giây, mỗi consumer xử lý năm mươi megabyte. Một nghìn chia năm mươi, ra hai mươi partition.',
        'Làm tương tự với tốc độ ghi của một partition, lấy số lớn hơn, rồi cộng thêm phần dư cho tăng trưởng.',
      ],
    },
    {
      id: 'cost',
      title: 'Cái giá của nhiều partition',
      beats: [
        'Vậy sao không đặt luôn mười nghìn partition cho chắc?',
        'Vì mỗi partition tốn file trên đĩa, tốn bộ nhớ đệm ở producer, và làm mỗi lô tin nhỏ đi nên nén kém hơn.',
        'Khi một broker chết, từng partition phải bầu leader mới. Càng nhiều partition, hồi phục càng lâu.',
      ],
    },
    {
      id: 'divisible',
      title: 'Chia đều',
      hold: 1,
      beats: [
        'Một mẹo nhỏ: chọn con số chia hết cho nhiều số consumer khác nhau.',
        'Mười hai partition chia đều cho một, hai, ba, bốn hoặc sáu consumer. Còn mười partition cho bốn consumer thì lệch: hai người gánh ba, hai người gánh hai.',
        'Và nhớ: số partition chỉ tăng được, không giảm được. Với topic có key, hãy tạo đủ ngay từ đầu.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: số partition là trần song song của consumer.',
        'Hai: số partition bằng throughput chia tốc độ một consumer, cộng thêm phần dư.',
        'Ba: nhiều quá cũng hại, vì tốn tài nguyên và hồi phục chậm.',
        'Và bốn: chọn số chia đều, và tạo đủ ngay từ đầu.',
      ],
    },
  ],
}
