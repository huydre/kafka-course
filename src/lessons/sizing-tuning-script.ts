import type { LessonScript } from '../player/types'

/** Narration for "capacity sizing by multiplication (disk, network, partitions) and basic tuning (producer, consumer, broker)". */
export const sizingTuningScript: LessonScript = {
  slug: 'sizing-tuning',
  module: 'Module 9 · Vận hành',
  title: 'Sizing & tuning',
  summary:
    'Tính dung lượng đĩa, mạng và số partition bằng vài phép nhân trên giấy, rồi chỉnh các cấu hình producer, consumer, broker theo nguyên tắc gom lô: đổi độ trễ lấy thông lượng.',
  scenes: [
    {
      id: 'hook',
      title: 'Mua bao nhiêu đĩa?',
      hold: 1,
      beats: [
        'Hệ thống đơn hàng ghi mười megabyte mỗi giây, và giữ dữ liệu bảy ngày.',
        'Cần mua bao nhiêu đĩa? Nhiều người nhân nhanh ra sáu terabyte rồi dừng lại.',
        'Nhưng đáp án thật là hai mươi sáu terabyte. Phần còn thiếu nằm ở những thừa số hay bị quên.',
      ],
    },
    {
      id: 'disk',
      title: 'Đĩa: một chuỗi phép nhân',
      beats: [
        'Bắt đầu từ mười megabyte nhân tám mươi sáu nghìn bốn trăm giây: tám trăm sáu mươi tư gigabyte mỗi ngày.',
        'Giữ bảy ngày thì được khoảng sáu terabyte.',
        'Nhân replication factor ba: mười tám terabyte, vì mỗi bản sao chiếm đĩa thật.',
        'Và chỉ nên dùng bảy mươi phần trăm đĩa, nên chia cho không phẩy bảy: hai mươi sáu terabyte cho cả cluster.',
      ],
    },
    {
      id: 'network',
      title: 'Mạng: chiều ra nhiều hơn chiều vào',
      beats: [
        'Mạng cũng phải tính. Chiều vào đơn giản: producer ghi bao nhiêu thì byte vào bấy nhiêu.',
        'Chiều ra thì nhiều hơn: mỗi consumer group đọc một lần, và mỗi follower sao chép thêm một lần.',
        'Một megabyte vào, ba group đọc, hai follower: leader phải đẩy ra năm megabyte mỗi giây.',
        'Card mạng mà bão hòa thì follower tụt lại, cluster thiếu bản sao. Sách khuyên dùng card mười gigabit.',
      ],
    },
    {
      id: 'partitions',
      title: 'Số partition',
      beats: [
        'Số partition đến từ nhu cầu song song: lấy tốc độ mục tiêu chia cho tốc độ của một consumer.',
        'Mục tiêu năm mươi megabyte mỗi giây, mỗi consumer xử lý năm megabyte: cần ít nhất mười partition.',
        'Nhưng đừng chọn năm trăm partition cho chắc. Mỗi cái tốn file mở, bộ nhớ, và một lần bầu leader khi broker chết.',
        'Sách khuyên không quá khoảng mười bốn nghìn partition mỗi broker. Hãy tính theo lưu lượng tương lai, vì tăng partition về sau phá thứ tự theo key.',
      ],
    },
    {
      id: 'producer',
      title: 'Producer: gom lô',
      beats: [
        'Phần lớn tuning là đổi độ trễ lấy thông lượng, bằng cách gom nhiều tin hơn mỗi lần gửi.',
        'Producer gom tin vào một thùng. Thùng to bằng batch size, mặc định mười sáu kilobyte.',
        'Linger ms là thời gian chờ cho thùng đầy hơn. Chờ mười mili giây thì request ít đi mười lần, đổi lại mỗi tin chờ thêm tối đa mười mili giây.',
        'Bật nén lz4 hoặc zstd: thùng co lại, tiết kiệm mạng và đĩa ở mọi broker và mọi replica.',
        'Còn acks bằng all thì chờ mọi bản sao xác nhận: chậm hơn một chút, nhưng tin quan trọng không mất.',
      ],
    },
    {
      id: 'consumer',
      title: 'Consumer: fetch và poll',
      beats: [
        'Consumer cũng gom lô. Fetch min bytes là số byte tối thiểu mà broker chờ có đủ rồi mới trả lời, tối đa năm trăm mili giây.',
        'Đặt mức một byte thì request nhỏ liên tục. Đặt sáu mươi bốn kilobyte thì ít request hơn, đổi lại độ trễ cao hơn.',
        'Max poll records chặn số tin mỗi lần poll, mặc định năm trăm. Mỗi tin xử lý một giây thì mất năm trăm giây, vượt năm phút và consumer bị đá khỏi group.',
        'Cách chữa là giảm max poll records xuống, chứ không phải thêm partition.',
      ],
    },
    {
      id: 'broker',
      title: 'Broker: hai nhóm luồng',
      beats: [
        'Với broker, chỉ cần biết hai nhóm luồng.',
        'Network threads, mặc định ba, nhận và gửi dữ liệu qua mạng. Io threads, mặc định tám, xử lý request và ghi đĩa.',
        'Chỉ tăng khi idle percent đã thấp, chứ không tăng cho chắc.',
        'Io threads chỉ cần bằng số lõi CPU. Thêm quá số lõi không làm việc nhanh hơn.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: đĩa bằng tốc độ ghi nhân thời gian giữ nhân replication factor, rồi chừa khoảng trống dự phòng.',
        'Hai: mạng ra bằng byte vào nhân số group đọc cộng số follower.',
        'Ba: số partition là lớn nhất của hai phép chia, đừng chọn bừa cho chắc.',
        'Và bốn: tuning là gom lô, đổi độ trễ lấy thông lượng, đo rồi mới đổi một tham số mỗi lần.',
      ],
    },
  ],
}
