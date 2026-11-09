import type { LessonScript } from '../player/types'

/** Narration for "the journey of a message inside the producer". Each beat drives the animation timing. */
export const producerJourneyScript: LessonScript = {
  slug: 'producer-journey',
  module: 'Module 3 · Producer',
  title: 'Hành trình một tin trong producer',
  summary:
    'send() thật ra làm gì, vì sao nó trả về ngay khi tin chưa tới broker, Kafka gom tin thành thùng và chở theo chuyến thế nào, và khi nào thùng được gửi đi.',
  scenes: [
    {
      id: 'hook',
      title: 'Một trăm tin biến mất',
      hold: 1,
      beats: [
        'Bạn gửi một trăm tin. Mỗi lệnh send trả về chỉ sau một phần mười mili giây.',
        'Ngay sau đó, ứng dụng tắt. Kiểm tra broker: không có tin nào cả.',
        'Vì send trả về không có nghĩa là tin đã tới broker. Hãy theo chân một tin để xem nó thật sự đi đâu.',
      ],
    },
    {
      id: 'pipeline',
      title: 'Bốn trạm',
      beats: [
        'Khi bạn gọi send, tin đi qua bốn trạm, tất cả nằm ngay trong ứng dụng của bạn.',
        'Trạm một, serializer, biến object thành byte. Trạm hai, partitioner, chọn partition.',
        'Trạm ba là bộ gom thùng trong RAM. Tin được thả vào thùng của partition đó, và send trả về ngay tại đây.',
        'Trạm bốn là luồng nền sender. Nó chở các thùng tới broker sau, rồi gọi callback báo kết quả.',
      ],
    },
    {
      id: 'post',
      title: 'Giống bưu cục',
      beats: [
        'Hình dung một bưu cục. Bạn đưa thư ở quầy, nhận biên nhận, rồi về ngay.',
        'Nhân viên phân thư vào từng ngăn theo tỉnh, mỗi ngăn có một bao tải.',
        'Xe tải chạy theo tuyến, chở mọi bao cùng tuyến trong một chuyến. Thư tới nơi thì bưu cục gọi báo bạn.',
      ],
    },
    {
      id: 'batching',
      title: 'Thùng theo partition, chuyến theo broker',
      beats: [
        'Một nghìn tin, ba partition, leader nằm trên hai broker.',
        'Nếu mỗi tin một chuyến mạng, ta cần một nghìn request.',
        'Gom vào thùng theo partition, rồi gom các thùng cùng broker vào một chuyến: chỉ còn hai request.',
      ],
    },
    {
      id: 'linger',
      title: 'Khi nào thùng được gửi',
      beats: [
        'Thùng được gửi khi một trong hai điều kiện tới trước: thùng đầy batch size, hoặc chờ hết linger ms.',
        'Linger bằng không: có tin là gửi, mỗi request chỉ khoảng hai mươi tin.',
        'Chờ thêm năm mươi mili giây: mỗi request chở hơn hai trăm tin, số request giảm khoảng mười lần.',
        'Đổi lại, mỗi tin phải chờ lâu hơn một chút. Đó là đánh đổi giữa độ trễ và hiệu suất.',
      ],
    },
    {
      id: 'buffer',
      title: 'Kho đầy',
      hold: 1,
      beats: [
        'Mọi thùng chờ gửi nằm chung một kho trong RAM, buffer memory, mặc định ba mươi hai megabyte.',
        'Nếu ứng dụng gửi nhanh hơn mạng chở đi, kho đầy dần.',
        'Kho đầy thì send bị chặn. Chặn quá sáu mươi giây thì ném TimeoutException.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: send trả về khi tin vào thùng trong RAM, chưa phải khi broker nhận.',
        'Hai: thùng theo partition, chuyến theo broker.',
        'Ba: thùng đi khi đầy hoặc hết linger ms, cái nào tới trước.',
        'Và bốn: trước khi tắt ứng dụng, luôn gọi flush hoặc close.',
      ],
    },
  ],
}
