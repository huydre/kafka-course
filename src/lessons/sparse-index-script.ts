import type { LessonScript } from '../player/types'

/** Narration for the sparse index lesson. Each beat is spoken by the voice track and drives the animation timing. */
export const sparseIndexScript: LessonScript = {
  slug: 'sparse-index',
  module: 'Module 1 · Log & Storage',
  title: 'Sparse Index: tìm tin trong 1GB',
  summary:
    'Vì sao Kafka cần index, vì sao index không ghi mọi tin, và cách "nhảy tới mốc gần nhất rồi lướt" giúp tìm offset nhanh mà vẫn tốn rất ít RAM.',
  scenes: [
    {
      id: 'problem',
      title: 'Vấn đề',
      beats: [
        'Đây là một segment file. Các tin được ghi nối đuôi nhau xuống đĩa.',
        'Nhưng mỗi tin dài ngắn khác nhau: một trăm hai mươi byte, ba trăm bốn mươi byte, chín mươi byte.',
        'Consumer hỏi: hãy đọc cho tôi từ offset 6. Vậy tin số 6 bắt đầu ở byte nào?',
        'Nếu tin nào cũng một trăm byte, ta chỉ cần lấy 6 nhân 100. Nhưng ở đây, phép nhân đó sai.',
      ],
    },
    {
      id: 'scan',
      title: 'Đọc lần lượt',
      beats: [
        'Cách đơn giản nhất: đọc từ đầu file, từng tin một.',
        'Mỗi lần phải đọc độ dài của tin, rồi mới biết nhảy tới đâu.',
        'Tới offset 6 ở byte 1390. Đúng, nhưng phải đọc qua 6 tin.',
        'Một segment một gigabyte có khoảng mười triệu tin. Đọc kiểu này thì quá chậm.',
      ],
    },
    {
      id: 'dense',
      title: 'Index dày',
      beats: [
        'Cách thứ hai: lập sẵn một bảng, ghi vị trí byte của mọi tin.',
        'Tra offset 6, ra ngay byte 1390, rồi nhảy thẳng tới nơi.',
        'Nhưng bảng to bằng số tin. Mười triệu dòng, tức khoảng tám mươi megabyte RAM, chỉ cho một segment.',
      ],
    },
    {
      id: 'sparse',
      title: 'Sparse index',
      beats: [
        'Kafka chọn cách ở giữa: cứ khoảng bốn kilobyte dữ liệu mới cắm một cột mốc.',
        'Muốn đọc offset 6, Kafka tìm mốc lớn nhất mà không vượt quá 6. Đó là mốc 4, ở byte 810.',
        'Nhảy thẳng tới byte 810, rồi chỉ cần lướt qua hai tin là tới offset 6.',
        'Nhanh gần bằng bảng đầy đủ, mà bảng chỉ có 3 dòng, đủ nhỏ để nằm gọn trong RAM.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 1.5,
      beats: [
        'Tóm lại. Vì các tin dài ngắn khác nhau, nên không thể tính byte từ offset.',
        'Sparse index chỉ ghi vài cột mốc, nên nhỏ và nằm gọn trong RAM.',
        'Khi tìm, Kafka nhảy tới mốc gần nhất phía trước, rồi lướt một đoạn ngắn.',
        'Giống mục lục của một cuốn sách: ghi theo chương, không ghi từng dòng.',
      ],
    },
  ],
}
