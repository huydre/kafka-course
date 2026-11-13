import type { LessonScript } from '../player/types'

/** Narration for "Kafka Connect: source and sink, worker/connector/task, standalone vs distributed, converter, SMT, offsets, DLQ". */
export const kafkaConnectScript: LessonScript = {
  slug: 'kafka-connect',
  module: 'Module 8 · Hệ sinh thái',
  title: 'Kafka Connect',
  summary:
    'Vì sao không nên tự viết chương trình nối Kafka với từng hệ thống, source và sink connector, worker, connector và task chia việc ra sao, standalone khác distributed thế nào, tin đi qua SMT và converter, hai loại offset, và cách errors tolerance cùng dead letter queue xử lý tin hỏng.',
  scenes: [
    {
      id: 'hook',
      title: 'Ba chương trình, ba lần viết lại',
      hold: 1,
      beats: [
        'Công ty cần đưa bảng orders từ PostgreSQL vào Kafka, rồi từ Kafka sang Elasticsearch và S3.',
        'Tự viết ba chương trình, thì chương trình nào cũng phải tự lo offset, retry và chạy song song.',
        'Lặp lại phần ống nước nhàm chán đó cho mỗi hệ thống là phí công và dễ sai.',
        'Kafka Connect là khung chạy sẵn, lo hết phần đó. Bạn chỉ viết cấu hình.',
      ],
    },
    {
      id: 'source-sink',
      title: 'Source và sink',
      beats: [
        'Source connector đọc từ hệ thống ngoài và ghi vào Kafka.',
        'Sink connector làm ngược lại: đọc từ Kafka và ghi ra hệ thống ngoài.',
        'Logic đọc ghi của từng hệ thống nằm trong plugin connector. Bạn chỉ khai báo cấu hình.',
        'Connect dùng để di chuyển dữ liệu, không phải để xử lý logic nghiệp vụ.',
      ],
    },
    {
      id: 'roles',
      title: 'Worker, connector, task',
      beats: [
        'Worker là một tiến trình Java, lo phần ống nước: REST API, lưu cấu hình, khởi động task.',
        'Connector là cấu hình cộng với logic chia việc, ví dụ: đồng bộ bảng orders.',
        'Task mới là đơn vị thật sự sao chép dữ liệu, và nó chạy bên trong worker.',
        'Connector JDBC lấy số nhỏ hơn giữa tasks max và số bảng. Ba bảng mà tasks max là tám thì chỉ có ba task.',
      ],
    },
    {
      id: 'modes',
      title: 'Standalone và distributed',
      beats: [
        'Standalone chỉ có một worker, cấu hình là file, offset cũng nằm trong file trên máy đó. Worker chết là mọi thứ dừng.',
        'Distributed có nhiều worker cùng group id, và cấu hình được gửi qua REST, cổng tám không tám ba.',
        'Cấu hình, offset và trạng thái nằm trong ba topic nội bộ, nên worker nào cũng thay được worker nào.',
        'Một worker chết, các worker còn lại phát hiện qua heartbeat, và task của nó được chia lại.',
      ],
    },
    {
      id: 'pipeline',
      title: 'SMT và converter',
      beats: [
        'Trên đường vào Kafka, mỗi tin đi qua hai trạm: SMT sửa nhẹ, rồi converter đổi thành byte.',
        'HoistField bọc dòng chữ thành object. InsertField thêm trường source vào object đó.',
        'SMT chỉ nhìn một tin mỗi lần, nên không join, không đếm, không gộp được. Việc đó để cho Kafka Streams.',
        'Đầu đọc phải dùng đúng converter mà đầu ghi đã dùng. JSON trơn mà đọc bằng converter đòi vỏ schema thì mọi tin đều lỗi.',
      ],
    },
    {
      id: 'offsets',
      title: 'Hai loại offset',
      beats: [
        'Source connector nhớ vị trí trong hệ thống nguồn. File bốn dòng, mỗi dòng bảy byte, thì offset là hai mươi tám.',
        'Thứ tự là: gửi vào Kafka, chờ broker xác nhận, rồi mới lưu offset.',
        'Chết giữa hai bước thì bật lại đọc từ offset cũ. Gửi trùng một đoạn, nhưng không mất tin nào.',
        'Sink thì dùng offset Kafka như mọi consumer, và chỉ commit sau khi ghi ra đích thành công.',
      ],
    },
    {
      id: 'dlq',
      title: 'Tin hỏng và DLQ',
      beats: [
        'Một tin hỏng thì sao? Mặc định errors tolerance là none: task dừng ngay, cả đường ống đứng.',
        'Đặt tolerance là all thì tin hỏng bị bỏ qua. Nhưng nếu không có chỗ giữ, tin mất lặng lẽ.',
        'Thêm dead letter queue: tin hỏng được chép sang topic riêng để xem lại, còn dây chuyền vẫn chạy.',
        'Header của tin trong DLQ ghi lý do lỗi, nên bạn biết sửa gì rồi chạy lại.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: worker lo ống nước, connector chia việc, task mới là bên sao chép dữ liệu.',
        'Hai: distributed lưu mọi trạng thái trong Kafka, nên worker nào cũng thay được.',
        'Ba: SMT sửa từng tin, converter phải khớp đầu ghi, và source offset nằm ở nguồn.',
        'Và bốn: tolerance all phải đi kèm DLQ, nếu không là mất dữ liệu trong im lặng.',
      ],
    },
  ],
}
