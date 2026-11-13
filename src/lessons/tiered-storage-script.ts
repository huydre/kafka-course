import type { LessonScript } from '../player/types'

/** Narration for "when to compact vs delete, tiered storage: local vs remote retention, reading old data, limits". */
export const tieredStorageScript: LessonScript = {
  slug: 'tiered-storage',
  module: 'Module 7 · Retention & Compaction',
  title: 'Khi nào compact & tiered storage',
  summary:
    'Chọn compact hay delete bằng một câu hỏi, rồi xem tiered storage đẩy segment cũ lên object storage ra sao, local retention khác retention ở đâu, consumer đọc dữ liệu cũ thấy gì, và những giới hạn cần biết.',
  scenes: [
    {
      id: 'hook',
      title: 'Giữ chín mươi ngày, trả bao nhiêu?',
      hold: 1,
      beats: [
        'Công ty muốn giữ dữ liệu clicks chín mươi ngày để phân tích lại. Mỗi ngày hai terabyte.',
        'Nhân với ba bản sao, đó là năm trăm bốn mươi terabyte SSD gắn trên broker.',
        'Thêm broker, hay thay một broker hỏng, phải chép lại hàng chục terabyte qua mạng.',
        'Trong khi chín mươi chín phần trăm lượt đọc chỉ nhắm vào vài giờ gần nhất.',
      ],
    },
    {
      id: 'choose',
      title: 'Compact hay delete?',
      beats: [
        'Trước khi nói về lưu trữ, nhắc lại cách chọn policy: nếu chỉ còn bản mới nhất của mỗi key, hạ nguồn có mất gì không?',
        'Hồ sơ người dùng thì không mất gì, vì chỉ cần hiện tại. Chọn compact.',
        'Giao dịch thanh toán thì mất lịch sử, vì mỗi tin có giá trị riêng. Chọn delete.',
        'Muốn trạng thái mới nhất, nhưng key lâu không cập nhật cũng tự biến mất, thì dùng cả hai, kèm thời gian giữ.',
      ],
    },
    {
      id: 'tiers',
      title: 'Hai tầng: local và remote',
      beats: [
        'Tiered storage chia dữ liệu thành hai tầng: local trên đĩa broker, và remote trên object storage.',
        'Chỉ segment đã đóng mới được đẩy lên remote. Segment đang ghi, active segment, luôn ở lại local.',
        'Local retention nói segment ở lại đĩa broker bao lâu. Hết hạn, bản local bị xoá, nhưng bản remote vẫn còn.',
        'Còn retention là tổng thời gian sống. Đến hạn đó, segment mới bị xoá khỏi remote.',
      ],
    },
    {
      id: 'numbers',
      title: 'Con số sau khi bật',
      beats: [
        'Đặt local retention là một ngày, và retention là chín mươi ngày.',
        'Trên SSD broker chỉ còn một ngày, nhân hai terabyte, nhân ba bản sao: sáu terabyte.',
        'Tám mươi chín ngày còn lại nằm ở object storage, tổng cộng một trăm tám mươi terabyte, bản sao do dịch vụ lưu trữ lo.',
        'Năm trăm bốn mươi terabyte SSD thành sáu. Giữ lâu hơn nhiều, mà đĩa broker vẫn nhỏ.',
      ],
    },
    {
      id: 'reading',
      title: 'Đọc dữ liệu cũ',
      beats: [
        'Consumer đọc dữ liệu mới thì broker trả thẳng từ đĩa local hoặc page cache. Rất nhanh.',
        'Một job phân tích đọc lại dữ liệu sáu mươi ngày trước. Broker tự lấy segment đó từ remote về.',
        'Consumer không cần biết dữ liệu nằm ở đâu. Lệnh đọc y hệt, chỉ chậm hơn một chút, vì phải đi qua mạng.',
      ],
    },
    {
      id: 'isolate',
      title: 'Cách ly đọc cũ với đọc mới',
      beats: [
        'Có một lợi ích phụ. Khi bật tiered storage, độ trễ p99 lúc bình thường tăng nhẹ, từ hai mươi mốt lên hai mươi lăm mili giây, vì broker phải đẩy segment lên remote.',
        'Nhưng khi có consumer đọc dữ liệu cũ, không có tiered storage, p99 vọt lên sáu mươi mili giây.',
        'Có tiered storage, chỉ lên bốn mươi hai. Vì đọc từ remote đi qua mạng, không tranh đĩa và page cache với consumer đọc dữ liệu mới.',
      ],
    },
    {
      id: 'limits',
      title: 'Những giới hạn cần biết',
      beats: [
        'Apache Kafka chỉ cung cấp giao diện RemoteStorageManager. Bạn cần một plugin cho kho cụ thể, như S3 hay GCS.',
        'Tiered storage không dùng được cho topic compacted, chỉ cho topic delete. Topic compacted vẫn nằm hết trên đĩa broker.',
        'Về phiên bản: Kafka ba chấm sáu mới là early access. Từ ba chấm chín mới sẵn sàng cho production, và bốn chấm x tiếp tục hỗ trợ.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      beats: [
        'Compact cho dữ liệu trạng thái, delete cho dữ liệu sự kiện.',
        'Tiered storage đẩy segment đã đóng lên object storage, active segment ở lại local.',
        'Local retention là thời gian ở đĩa broker, retention là tổng thời gian sống.',
        'Đọc dữ liệu cũ chậm hơn nhưng không làm bẩn page cache. Cần plugin, Kafka ba chấm chín trở lên, và không dùng cho topic compacted.',
      ],
    },
  ],
}
