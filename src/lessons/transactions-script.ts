import type { LessonScript } from '../player/types'

/** Narration for "read → process → write as one transaction, transactional.id, read_committed, Last Stable Offset, limits". */
export const transactionsScript: LessonScript = {
  slug: 'transactions',
  module: 'Module 6 · Offset & Delivery',
  title: 'Transaction & read_committed',
  summary:
    'Vì sao ghi tin kết quả và commit offset là hai việc dễ gây trùng, Kafka gói chúng vào một transaction ra sao, marker COMMIT và ABORT đóng dấu thế nào, transactional id chống instance xác sống bằng epoch, read_committed dừng ở Last Stable Offset, và vì sao exactly-once không vượt ra ngoài Kafka.',
  scenes: [
    {
      id: 'hook',
      title: 'Hai việc ghi, một cú chết',
      hold: 1,
      beats: [
        'Một app đọc topic orders, tính toán, rồi ghi kết quả ra topic invoices.',
        'Với mỗi tin, nó ghi vào Kafka hai việc: tin kết quả, và offset đã xử lý.',
        'Nếu app chết giữa hai việc, invoices đã có tin, nhưng offset chưa dời.',
        'Khởi động lại, nó đọc lại tin cũ, và invoices có tin trùng.',
      ],
    },
    {
      id: 'atomic',
      title: 'Gói thành một transaction',
      beats: [
        'Cả hai việc đều là ghi vào Kafka. Vậy Kafka có thể gói chúng lại thành một transaction.',
        'Producer bắt đầu transaction, ghi tin kết quả vào invoices, và gửi luôn offset đi cùng.',
        'Rồi commit. Hoặc cả hai được công nhận, hoặc cả hai bị huỷ.',
        'Giống chuyển khoản ngân hàng: bạn không bao giờ thấy trạng thái đã trừ tiền mà chưa cộng.',
      ],
    },
    {
      id: 'marker',
      title: 'Marker đóng dấu',
      beats: [
        'Tin của transaction nằm trên đĩa ngay từ lúc send. Lúc này chưa ai biết nó hợp lệ hay không.',
        'Khi commit, coordinator ghi một marker COMMIT vào mọi partition mà transaction đã chạm tới.',
        'Transaction khác bị abort thì nhận marker ABORT. Tin không bị xoá, chỉ bị đánh dấu là huỷ.',
        'Marker chiếm một offset thật, nên dãy offset có lỗ.',
      ],
    },
    {
      id: 'zombie',
      title: 'Chống instance xác sống',
      beats: [
        'Instance A mang transactional id invoice app một. Nó bị treo, và hệ thống tưởng nó đã chết.',
        'Hệ thống khởi động instance B với cùng transactional id. Coordinator tăng epoch từ năm lên sáu.',
        'A tỉnh dậy, gửi tiếp với epoch năm. Broker từ chối, vì A đã bị rào.',
        'Vì vậy transactional id phải cố định qua các lần restart. Còn hai instance đang sống thì phải khác nhau.',
      ],
    },
    {
      id: 'isolation',
      title: 'Read committed',
      beats: [
        'Tin của transaction nằm trên đĩa trước khi được commit. Consumer ở hạ nguồn có nên đọc chúng không?',
        'Mặc định là read uncommitted: đọc mọi thứ đến high watermark, kể cả tin sắp bị huỷ.',
        'Read committed chỉ đọc đến last stable offset, tức offset của tin đầu tiên thuộc transaction còn đang mở.',
        'Tin phía sau mốc đó, dù không thuộc transaction nào, cũng phải chờ, vì consumer đọc theo thứ tự.',
        'Khi transaction có marker, last stable offset nhảy lên, và hàng chờ đi tiếp.',
      ],
    },
    {
      id: 'limits',
      title: 'Giới hạn của exactly once',
      beats: [
        'Nhưng transaction chỉ bao được những gì ghi vào Kafka.',
        'Nếu bước xử lý gửi email, abort chỉ huỷ được tin trong Kafka.',
        'Email đã gửi thì không rút lại được. Xử lý lại, email đi lần thứ hai.',
        'Với hệ thống ngoài, cần consumer idempotent, hoặc lưu offset trong chính database, hoặc dùng outbox.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: tin kết quả và offset được commit trong cùng một transaction.',
        'Hai: marker commit hay abort quyết định tin có được nhìn thấy, và marker chiếm một offset.',
        'Ba: transactional id cố định cùng epoch rào được instance xác sống.',
        'Và bốn: read committed dừng ở last stable offset, nhưng exactly once không vượt ra ngoài Kafka.',
      ],
    },
  ],
}
