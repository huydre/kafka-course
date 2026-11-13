import type { LessonScript } from '../player/types'

/** Narration for "retry topics, DLQ, ordering trade-offs, saga, and when not to use Kafka". */
export const retrySagaScript: LessonScript = {
  slug: 'retry-saga',
  module: 'Module 10 · Design patterns',
  title: 'Retry, DLQ, Saga & khi nào không dùng Kafka',
  summary:
    'Vì sao một tin độc chặn cả partition, retry topic và DLQ giúp consumer đi tiếp ra sao và phải trả giá bằng thứ tự, saga dùng bước bù thay cho rollback với hai kiểu choreography và orchestration, và những lúc Kafka không phải công cụ đúng.',
  scenes: [
    {
      id: 'hook',
      title: 'Một tin độc, cả partition kẹt',
      hold: 1,
      beats: [
        'Một partition của topic orders, và consumer đang đọc từng tin theo thứ tự.',
        'Rồi nó gặp một tin độc: JSON hỏng, thử bao nhiêu lần cũng lỗi.',
        'Consumer cứ đứng ở đó thử lại, và không đi tiếp được.',
        'Phía sau, hàng nghìn tin lành xếp hàng chờ. Lag tăng mãi, chỉ vì một tin.',
      ],
    },
    {
      id: 'retry',
      title: 'Retry topic và DLQ',
      beats: [
        'Cách chữa là đừng đứng chờ. Tin lỗi được chép sang một topic khác, và consumer chính đi tiếp.',
        'Topic retry năm giây giữ tin đó, đợi đủ năm giây rồi mới thử lại.',
        'Vẫn lỗi thì sang retry một phút. Lỗi tạm thời như mạng chập chờn thường qua được ở đây.',
        'Hết số lần thử thì tin vào DLQ, hàng chết. Trong lúc đó, topic chính vẫn chạy đều.',
      ],
    },
    {
      id: 'order',
      title: 'Cái giá: mất thứ tự',
      beats: [
        'Nhưng không có bữa trưa miễn phí. Tin OrderPlaced của đơn ba bị lỗi và đi vào retry.',
        'Tin OrderPaid của chính đơn ba nằm ngay sau, nên vẫn được xử lý ở topic chính.',
        'Kết quả: thanh toán chạy trước khi đơn tồn tại. Thứ tự đã mất.',
        'Cần giữ thứ tự thì chọn blocking retry, hoặc đẩy cả các tin sau của cùng key vào retry.',
      ],
    },
    {
      id: 'dlq',
      title: 'DLQ không phải thùng rác',
      beats: [
        'Mỗi tin trong DLQ mang header: topic gốc, offset, lỗi gì, đã thử mấy lần.',
        'Người trực xem tin, tìm ra nguyên nhân, rồi sửa dữ liệu hoặc sửa code.',
        'Sau đó phát lại tin về topic chính để xử lý bình thường.',
        'DLQ mà không ai nhìn thì chỉ là thùng rác có giấy phép.',
      ],
    },
    {
      id: 'saga',
      title: 'Saga: bước bù thay rollback',
      beats: [
        'Đặt hàng đi qua ba service: đơn hàng, thanh toán, kho. Mỗi service có database riêng, không có giao dịch chung.',
        'Mỗi bước là một giao dịch cục bộ, và báo bước xong bằng một sự kiện.',
        'Nhưng kho báo hết hàng. Tiền đã trừ rồi, không rollback được.',
        'Saga chạy ngược các bước bù: hoàn tiền, rồi huỷ đơn. Bước bù cũng phải idempotent.',
      ],
    },
    {
      id: 'orchestra',
      title: 'Choreography và orchestration',
      beats: [
        'Có hai cách tổ chức saga. Cách một là choreography: mỗi service nghe sự kiện và tự phản ứng.',
        'Không có điểm trung tâm, nhưng luồng bị rải khắp nơi, khó biết đơn đang ở bước nào.',
        'Cách hai là orchestration: một orchestrator gửi lệnh đến từng service rồi chờ trả lời.',
        'Luồng nằm một chỗ, dễ đọc, nhưng thêm một thành phần phải vận hành. Hai ba bước thì chọn choreography.',
      ],
    },
    {
      id: 'notkafka',
      title: 'Khi nào không dùng Kafka',
      beats: [
        'Kafka là xe tải: chở nhiều, chở xa, bền. Đi chợ mua bó rau thì xe máy hợp hơn.',
        'Cần hỏi và chờ trả lời ngay, như kiểm tra tồn kho để hiện lên màn hình, thì dùng HTTP hoặc gRPC.',
        'Vài trăm tin mỗi ngày, team hai người, thì một bảng job trong database là đủ.',
        'Cần ack từng tin, ưu tiên, hẹn giờ giao, thì RabbitMQ hay SQS hợp hơn.',
      ],
    },
    {
      id: 'summary',
      title: 'Nhìn lại cả bài',
      hold: 2,
      beats: [
        'Cứ đứng thử lại một tin độc thì cả partition kẹt.',
        'Retry topic và DLQ giúp đi tiếp, đổi lại là mất thứ tự.',
        'Saga thay rollback bằng các bước bù, theo kiểu choreography hoặc orchestration.',
        'Không cần replay hay nhiều consumer độc lập thì đừng dùng Kafka.',
      ],
    },
  ],
}
