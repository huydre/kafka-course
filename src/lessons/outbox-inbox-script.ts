import type { LessonScript } from '../player/types'

/** Narration for "dual-write problem, transactional outbox (polling and CDC), idempotent consumer with an inbox table". */
export const outboxInboxScript: LessonScript = {
  slug: 'outbox-inbox',
  module: 'Module 10 · Design patterns',
  title: 'Dual-write, Outbox & Inbox',
  summary:
    'Vì sao ghi database rồi gửi Kafka là hai việc không có giao dịch chung và luôn có khe hở, Transactional Outbox biến chúng thành một lần ghi nguyên tử ra sao, polling publisher và Debezium chép sự kiện sang Kafka thế nào, và bảng inbox giúp consumer bỏ qua tin trùng bằng mã sự kiện.',
  scenes: [
    {
      id: 'hook',
      title: 'Hai nơi ghi, một cú chết',
      hold: 1,
      beats: [
        'Service Đơn hàng nhận một đơn, và phải làm hai việc.',
        'Việc thứ nhất: ghi đơn vào database. Việc thứ hai: gửi sự kiện đơn hàng lên Kafka.',
        'Giữa hai việc đó, service bị chết.',
        'Database có đơn, Kafka thì không, nên service Kho không bao giờ biết để xuất hàng.',
      ],
    },
    {
      id: 'dualwrite',
      title: 'Bài toán ghi kép',
      beats: [
        'Hai việc này nằm ở hai hệ thống khác nhau, và không có giao dịch chung.',
        'Ghi database trước, Kafka sau: chết giữa chừng thì có đơn ma, đơn nằm trong database mà kho không biết.',
        'Đổi thứ tự, gửi Kafka trước rồi database bị rollback: kho xuất hàng cho một đơn không tồn tại.',
        'Với một nghìn đơn mỗi ngày và một phần trăm sự cố, mỗi ngày có khoảng mười đơn sai.',
        'Đổi thứ tự hay thử lại đều không chữa được, vì tiến trình có thể chết đúng giữa khe hở.',
      ],
    },
    {
      id: 'outbox',
      title: 'Transactional Outbox',
      beats: [
        'Lời giải là đừng gửi Kafka ngay trong lúc xử lý yêu cầu.',
        'Thay vào đó, ghi sự kiện vào một bảng outbox, nằm ngay trong cùng database.',
        'Dòng đơn hàng và dòng outbox thuộc cùng một giao dịch.',
        'Commit thì cả hai cùng có. Lỗi thì cả hai cùng không có.',
        'Bây giờ chỉ còn một lần ghi nguyên tử. Đưa lên Kafka trở thành việc chép lại.',
      ],
    },
    {
      id: 'polling',
      title: 'Polling publisher',
      beats: [
        'Một tiến trình khác, gọi là polling publisher, chạy mỗi vài giây và đọc những dòng outbox chưa gửi.',
        'Nó gửi từng dòng lên Kafka, dùng aggregate id làm key để giữ thứ tự của từng đơn.',
        'Rồi nó đánh dấu dòng đó là đã gửi.',
        'Nếu nó chết sau khi gửi mà chưa kịp đánh dấu, lần sau nó gửi lại, và Kafka có tin trùng.',
        'Vì vậy outbox cho at-least-once, chứ không phải exactly-once.',
      ],
    },
    {
      id: 'cdc',
      title: 'CDC với Debezium',
      beats: [
        'Cách thứ hai là CDC, ví dụ Debezium.',
        'Mọi thay đổi của database đều được ghi vào nhật ký giao dịch, gọi là WAL hoặc binlog.',
        'Debezium đọc nhật ký này, thấy dòng mới trong outbox thì đẩy lên Kafka, theo đúng thứ tự commit.',
        'Nó không phải chạy truy vấn liên tục lên bảng, nên gần như không tạo tải cho database.',
        'Nhưng Debezium cũng là at-least-once, nên tin trùng vẫn có thể đến.',
      ],
    },
    {
      id: 'inbox',
      title: 'Bảng inbox chống trùng',
      beats: [
        'Tin trùng chắc chắn sẽ đến. Giả sử service Ví nhận hai lần sự kiện nạp một trăm nghìn đồng, mã p ba.',
        'Xử lý ngây thơ thì số dư tăng hai trăm nghìn, sai mất một trăm nghìn.',
        'Cách chữa là bảng inbox: ghi mã sự kiện đã xử lý, ngay trong cùng giao dịch với thay đổi số dư.',
        'Lần thứ hai, insert vi phạm khoá chính, cả giao dịch rollback, và tin trùng bị bỏ qua.',
        'Khoá theo mã sự kiện chứ không theo offset, vì tin gửi lại sẽ mang offset mới.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: ghi database và gửi Kafka là hai hệ thống, nên luôn có khe hở.',
        'Hai: outbox ghi sự kiện cùng giao dịch với dữ liệu, rồi polling hoặc Debezium chép sang Kafka.',
        'Ba: cách chép này là at-least-once, nên tin trùng là chuyện bình thường.',
        'Và bốn: consumer dùng bảng inbox theo mã sự kiện, để xử lý trùng mà kết quả vẫn đúng một lần.',
      ],
    },
  ],
}
