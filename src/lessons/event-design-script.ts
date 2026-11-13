import type { LessonScript } from '../player/types'

/** Narration for "event design (notification vs state transfer, envelope, key) and event sourcing, snapshot, compacted topic, CQRS". */
export const eventDesignScript: LessonScript = {
  slug: 'event-design',
  module: 'Module 10 · Design patterns',
  title: 'Thiết kế sự kiện & event sourcing',
  summary:
    'Sự kiện nên mang bao nhiêu dữ liệu để consumer khỏi gọi API, phong bì chung gồm những trường nào, chọn key ra sao để giữ thứ tự, và khi lưu chuỗi sự kiện làm nguồn sự thật thì snapshot, compacted topic và CQRS đóng vai trò gì.',
  scenes: [
    {
      id: 'hook',
      title: 'Mười service, mười nghìn lần gọi',
      hold: 1,
      beats: [
        'Khách hàng đổi địa chỉ. Service Khách hàng phát ra một sự kiện, chỉ nói rằng khách số bảy vừa đổi địa chỉ.',
        'Mười service cùng nghe sự kiện đó. Nhưng sự kiện không chứa địa chỉ mới.',
        'Nên cả mười đều quay lại gọi API để hỏi service Khách hàng.',
        'Mỗi service một nghìn sự kiện mỗi giờ, thành mười nghìn lần gọi mỗi giờ. Service Khách hàng nóng lên.',
      ],
    },
    {
      id: 'ecst',
      title: 'Báo tin hay giao tận tay',
      hold: 1,
      beats: [
        'Kiểu vừa rồi gọi là event notification: sự kiện nhẹ, chỉ báo là có chuyện. Giống tin nhắn nhờ bạn ra bưu cục lấy hàng.',
        'Kiểu thứ hai là event-carried state transfer. Sự kiện mang theo luôn địa chỉ mới, như shipper giao tận tay.',
        'Với mười service, kiểu đầu là mười nghìn lần gọi mỗi giờ. Kiểu sau là không lần nào.',
        'Service Khách hàng sập thì kiểu đầu kẹt theo, còn kiểu sau vẫn chạy bằng bản sao cục bộ. Cái giá là sự kiện to hơn và dữ liệu bị nhân bản.',
      ],
    },
    {
      id: 'envelope',
      title: 'Phong bì chung của sự kiện',
      hold: 1,
      beats: [
        'Mọi sự kiện nên dùng chung một phong bì. Trường đầu tiên là eventId, để consumer chống xử lý trùng.',
        'Tiếp theo là type, đặt ở thì quá khứ. OrderPlaced là sự thật đã xảy ra, còn PlaceOrder chỉ là mệnh lệnh.',
        'Version cho biết phiên bản schema của loại sự kiện này.',
        'occurredAt là lúc việc thật sự xảy ra, không phải lúc gửi lên Kafka, vì outbox có thể gửi trễ.',
        'Thêm source cho biết ai phát, và cuối cùng là data, phần nghiệp vụ.',
      ],
    },
    {
      id: 'key',
      title: 'Chọn key để giữ thứ tự',
      hold: 1,
      beats: [
        'Key là mã của thực thể mà thứ tự quan trọng. Với tài khoản, đó là accountId.',
        'Cùng key thì cùng partition. Mọi sự kiện của tài khoản A nằm trên một tape, đúng thứ tự: nạp rồi mới rút.',
        'Giờ đổi key thành paymentId cho phân bố đều. Các sự kiện của cùng một tài khoản rải ra nhiều partition.',
        'Consumer đọc song song, có thể thấy lệnh rút trước lệnh nạp. Số dư tạm thời bị âm.',
      ],
    },
    {
      id: 'eventlog',
      title: 'Event sourcing: log là sự thật',
      hold: 1,
      beats: [
        'Cách thông thường chỉ lưu số dư hiện tại: bốn trăm mười. Còn vì sao ra số đó thì không ai biết, quá khứ đã bị ghi đè.',
        'Event sourcing đảo lại: không lưu trạng thái, chỉ lưu chuỗi sự kiện. Mở tài khoản, nạp năm trăm, rút một trăm hai mươi, nạp ba mươi.',
        'Số dư là phép cộng dồn các sự kiện: không, năm trăm, ba trăm tám mươi, bốn trăm mười.',
        'Muốn số dư lúc offset ba, chỉ cộng đến đó. Sửa bug tính phí thì sửa code rồi replay lại cả log.',
        'Sự kiện không bao giờ bị sửa. Muốn huỷ một giao dịch, ghi thêm một sự kiện huỷ.',
      ],
    },
    {
      id: 'snapshot',
      title: 'Snapshot: replay không từ đầu',
      hold: 1,
      beats: [
        'Vấn đề mới: tài khoản có một triệu sự kiện, thì mỗi lần hỏi số dư phải cộng cả một triệu dòng.',
        'Snapshot giải quyết việc này. Định kỳ lưu lại: tại offset chín trăm nghìn, số dư là một con số cụ thể.',
        'Lần sau, lấy snapshot rồi chỉ cộng một trăm nghìn sự kiện còn lại. Giống dòng chuyển trang trong sổ tiết kiệm.',
      ],
    },
    {
      id: 'compact',
      title: 'Compacted topic: trạng thái mới nhất',
      hold: 1,
      beats: [
        'Một cách khác để giữ trạng thái mới nhất là topic compact, cleanup policy bằng compact.',
        'Ta ghi vào topic nhiều bản ghi. Khoá A có hai bản: bốn trăm mười, rồi sáu trăm.',
        'Compaction chạy xong, chỉ còn bản sáu trăm. Mỗi khoá giữ lại bản mới nhất.',
        'Muốn xoá một khoá, gửi tombstone, tức là value rỗng.',
        'Nhưng compact vứt lịch sử các bước, nên nó không thay được event log.',
      ],
    },
    {
      id: 'cqrs',
      title: 'CQRS: một luồng, nhiều read model',
      hold: 1,
      beats: [
        'CQRS tách bên ghi khỏi bên đọc. Lệnh rút một trăm hai mươi đi vào service Tài khoản.',
        'Bên ghi chỉ làm một việc: sinh sự kiện vào topic account events.',
        'Mỗi bên đọc có consumer riêng, tự dựng read model: bảng số dư, chỉ mục tìm kiếm, bảng báo cáo tháng.',
        'Cái giá là read model trễ so với lệnh. Mở app ngay có thể vẫn thấy số dư cũ trong vài trăm mili giây.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: sự kiện mang theo dữ liệu thì consumer đỡ phải gọi API.',
        'Hai: phong bì thống nhất gồm eventId, type, version và occurredAt.',
        'Ba: key là id của thực thể cần giữ thứ tự.',
        'Và bốn: log là sự thật, snapshot cắt ngắn replay, compact giữ trạng thái mới nhất, CQRS dựng nhiều read model.',
      ],
    },
  ],
}
