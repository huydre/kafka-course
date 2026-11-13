import type { LessonScript } from '../player/types'

/** Narration for "incident playbook, moving partitions, preferred leader, rolling restart, TLS/SASL/ACL". */
export const incidentsOpsScript: LessonScript = {
  slug: 'incidents-ops',
  module: 'Module 9 · Vận hành',
  title: 'Sự cố, bảo trì & bảo mật',
  summary:
    'Sổ tay sáu sự cố hay gặp theo khung dấu hiệu, kiểm tra, xử lý; cách dời partition có throttle, trả leader về preferred, rolling restart an toàn; và ba lớp bảo mật cơ bản TLS, SASL, ACL.',
  scenes: [
    {
      id: 'hook',
      title: 'Ba giờ sáng, điện thoại reo',
      hold: 1,
      beats: [
        'Ba giờ sáng, điện thoại reo. Cảnh báo đỏ: Kafka có chuyện.',
        'Bạn không cần đoán mò. Sáu sự cố hay gặp đều để lại dấu hiệu riêng.',
        'Mỗi sự cố đi theo một khung: dấu hiệu, kiểm tra, rồi xử lý.',
      ],
    },
    {
      id: 'lag-shapes',
      title: 'Ba hình dạng của lag',
      beats: [
        'Ba sự cố đầu đều hiện ra là lag, nhưng hình dạng của lag khác nhau.',
        'Lag tăng đều ở mọi partition: consumer chậm cả đám. Thêm consumer, hoặc gom batch khi ghi database.',
        'Một partition cao vút mà offset vẫn nhích: hot partition, do một key quá nóng. Rắc muối cho key. Thêm partition không giúp được.',
        'Một partition đứng yên, offset không nhích: poison message, một tin hỏng làm consumer kẹt mãi.',
        'Xử lý khẩn cấp: dừng group, rồi bỏ qua đúng một tin. Về lâu dài thì đẩy tin hỏng sang DLQ.',
      ],
    },
    {
      id: 'triage',
      title: 'Ba sự cố nữa',
      beats: [
        'Ba sự cố nữa, mỗi cái một cách nhận ra.',
        'Rebalance storm: log đầy chữ rebalance, vì một lô xử lý lâu hơn năm phút nên consumer bị đá khỏi group. Giảm max poll records, dùng static membership.',
        'Đĩa đầy: broker chạy bình thường cho đến khi đầy rồi hỏng đột ngột. Giảm retention, mở rộng ổ đĩa. Đừng bao giờ xoá file segment bằng tay.',
        'Broker chết: URP lớn hơn không. Xem log của broker đó rồi khởi động lại. Trong lúc đó, không dừng thêm broker nào.',
      ],
    },
    {
      id: 'reassign',
      title: 'Dời partition',
      beats: [
        'Thêm broker bốn vào cluster ba broker, nó trống trơn. Kafka không tự dời partition cũ sang.',
        'Bạn chạy reassign. Controller thêm replica mới trên broker bốn trước, đuổi kịp xong mới bỏ replica cũ. Partition không lúc nào thiếu bản sao.',
        'Nhưng sao chép năm trăm gigabyte qua mạng sẽ chiếm hết băng thông. Vì vậy luôn đặt throttle, ví dụ năm mươi megabyte mỗi giây.',
        'Xong việc, lệnh verify kiểm tra rồi gỡ throttle.',
      ],
    },
    {
      id: 'preferred',
      title: 'Preferred leader',
      beats: [
        'Mỗi partition có danh sách replica, và replica đầu tiên là preferred leader. Ở đây là broker hai.',
        'Broker hai khởi động lại, leader của nó chuyển sang broker ba.',
        'Broker hai quay về nhưng chỉ làm follower. Broker ba gánh gấp đôi số leader.',
        'Preferred leader election trả leader về đúng chỗ. Kafka tự làm mỗi ba trăm giây, hoặc bạn chạy tay.',
      ],
    },
    {
      id: 'rolling',
      title: 'Rolling restart',
      beats: [
        'Nâng cấp cả cluster thì restart từng broker một, không bao giờ hai cái cùng lúc.',
        'Broker một tắt có kiểm soát, URP tăng lên, rồi nó quay về và đuổi kịp.',
        'Phải chờ URP về không rồi mới sang broker hai. Cứ thế lặp lại.',
        'RF ba, min ISR hai: tắt một broker vẫn ghi được. RF hai thì ISR còn một, producer acks all bị lỗi.',
      ],
    },
    {
      id: 'security',
      title: 'Ba lớp bảo mật',
      beats: [
        'Mặc định, Kafka không mã hoá, không hỏi tên, không phân quyền. Ai nối được cổng chín không chín hai là đọc ghi thoải mái.',
        'Lớp một là TLS: mã hoá đường truyền, kẻ nghe lén chỉ thấy dữ liệu loạn.',
        'Lớp hai là SASL: client phải xuất trình danh tính trước, bạn là ai.',
        'Lớp ba là ACL: biết bạn là ai rồi, còn phải xem bạn được làm gì. Order service được ghi topic orders, nhưng không được xoá.',
        'Production nên dùng SASL SSL, và mỗi service một principal riêng.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 1.5,
      beats: [
        'Nhìn hình dạng của lag: đều, một cột cao, hay một cột đứng yên.',
        'Mỗi sự cố theo khung: dấu hiệu, kiểm tra, xử lý.',
        'Dời partition luôn có throttle, và rolling restart phải chờ URP về không.',
        'TLS mã hoá, SASL xác thực, ACL phân quyền.',
      ],
    },
  ],
}
