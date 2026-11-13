import type { LessonScript } from '../player/types'

/** Narration for "at-most-once, at-least-once, exactly-once, and idempotent consumers". */
export const deliverySemanticsScript: LessonScript = {
  slug: 'delivery-semantics',
  module: 'Module 6 · Offset & Delivery',
  title: 'Ba mức đảm bảo giao nhận',
  summary:
    'Mất, lặp hay đúng một lần: tất cả do thứ tự giữa xử lý và commit quyết định. Bài này tách ba mức at-most-once, at-least-once, exactly-once, rồi cho thấy cách làm consumer idempotent để việc xử lý lặp trở nên vô hại.',
  scenes: [
    {
      id: 'hook',
      title: 'Hai việc, một thứ tự',
      hold: 1,
      beats: [
        'Hàm poll vừa trả về mười tin, từ offset một trăm đến một trăm linh chín.',
        'Consumer phải làm hai việc với mẻ này: xử lý chúng, và commit offset.',
        'Chỉ cần đổi thứ tự hai việc đó, kết quả khi consumer chết sẽ hoàn toàn khác.',
      ],
    },
    {
      id: 'atmost',
      title: 'At-most-once: commit trước',
      beats: [
        'Mức thứ nhất là at-most-once: commit trước, xử lý sau.',
        'Kẹp nhảy ngay tới một trăm mười, rồi consumer mới xử lý từng tin.',
        'Xử lý được năm tin, từ một trăm đến một trăm linh bốn, thì consumer chết.',
        'Khởi động lại, nó đọc từ một trăm mười. Năm tin còn lại mất hẳn, không bao giờ được xử lý.',
      ],
    },
    {
      id: 'atleast',
      title: 'At-least-once: xử lý trước',
      beats: [
        'Mức thứ hai là at-least-once: xử lý trước, commit sau.',
        'Cả mười tin được xử lý xong. Dữ liệu đã ghi vào database, email đã gửi đi.',
        'Consumer chết đúng trước khi kịp commit. Kẹp vẫn nằm ở một trăm.',
        'Khởi động lại, nó đọc từ một trăm và xử lý cả mười tin lần thứ hai. Tin bị lặp, nhưng không mất.',
      ],
    },
    {
      id: 'exactly',
      title: 'Exactly-once: một khối',
      beats: [
        'Mức thứ ba là exactly-once: xử lý và commit phải thành một khối.',
        'Hoặc cả hai cùng thành công, hoặc cả hai cùng bị huỷ. Không còn khe hở ở giữa.',
        'Kafka làm được điều này khi xử lý nghĩa là ghi kết quả sang một topic Kafka khác.',
        'Còn ghi ra database bên ngoài thì Kafka không với tới. Cách thực tế là at-least-once, cộng với consumer idempotent.',
      ],
    },
    {
      id: 'idem',
      title: 'Idempotent: lặp mà vô hại',
      beats: [
        'At-least-once thì sớm muộn cũng có lúc lặp. Thay vì cấm lặp, ta làm cho lặp trở nên vô hại.',
        'Một thao tác idempotent là thao tác chạy một lần hay mười lần, kết quả vẫn như nhau.',
        'Cộng thêm một trăm vào số dư thì không idempotent. Chạy lần hai, năm trăm thành bảy trăm.',
        'Đặt số dư bằng sáu trăm thì idempotent. Chạy lại bao nhiêu lần, vẫn là sáu trăm.',
      ],
    },
    {
      id: 'dedupe',
      title: 'Bảng dedupe',
      beats: [
        'Kỹ thuật phổ biến nhất là bảng dedupe. Mỗi sự kiện mang một event id duy nhất.',
        'Consumer ghi event id vào bảng, và cập nhật số dư, trong cùng một transaction của database.',
        'Sự kiện lặp tới: event id báo trùng khoá, cả khối bị huỷ, số dư không đổi.',
        'Nếu tách thành hai transaction thì khe hở quay lại. Hai bước phải đi cùng nhau.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: mức đảm bảo là thứ tự giữa xử lý và commit, không phải một cấu hình.',
        'Hai: commit trước thì có thể mất, xử lý trước thì có thể lặp.',
        'Ba: lặp sửa được, mất thì không, nên at-least-once là mặc định.',
        'Và bốn: consumer idempotent với bảng dedupe làm cho lặp trở nên vô hại.',
      ],
    },
  ],
}
