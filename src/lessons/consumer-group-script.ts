import type { LessonScript } from '../player/types'

/** Narration for "poll loop, consumer group, coordinator, independent groups, lag". */
export const consumerGroupScript: LessonScript = {
  slug: 'consumer-group',
  module: 'Module 5 · Consumer Group',
  title: 'Consumer group: chia nhau đọc',
  summary:
    'Consumer tự kéo tin bằng vòng lặp poll. Nhiều consumer cùng group chia nhau các partition, mỗi partition đúng một người. Ai chia, vì sao thừa consumer thì ngồi chơi, hai group đọc độc lập ra sao, và đọc lag thế nào.',
  scenes: [
    {
      id: 'hook',
      title: 'Một người không kịp',
      hold: 1,
      beats: [
        'Topic clicks có bốn partition, nhận một nghìn tin mỗi giây.',
        'Một consumer chỉ xử lý được ba trăm tin mỗi giây.',
        'Mỗi giây, phần chưa đọc dài thêm bảy trăm tin. Làm sao để đọc kịp?',
      ],
    },
    {
      id: 'poll',
      title: 'Vòng lặp poll',
      beats: [
        'Kafka không đẩy tin đến consumer. Consumer tự hỏi, bằng một vòng lặp gọi poll.',
        'Mỗi lần poll, nó lấy một mẻ, tối đa năm trăm tin, xử lý hết mẻ rồi mới poll tiếp.',
        'Gọi poll đều đặn cũng là tín hiệu: tôi vẫn đang làm việc. Năm trăm tin, mỗi tin mười mili giây, là năm giây giữa hai lần poll. Ổn.',
        'Nhưng nếu mỗi tin mất một giây, thì phải năm trăm giây, vượt giới hạn ba trăm giây. Consumer bị coi là treo, và bị loại khỏi group.',
      ],
    },
    {
      id: 'group',
      title: 'Chia partition trong group',
      beats: [
        'Giải pháp là consumer group. Các consumer cùng group id là một đội.',
        'Mỗi partition chỉ giao cho đúng một người trong đội, để giữ thứ tự và không ai đọc trùng.',
        'Hai consumer thì chia đôi. Bốn consumer thì mỗi người một partition.',
        'Consumer thứ năm không còn partition nào để nhận. Nó ngồi chơi, chờ thay người khác.',
      ],
    },
    {
      id: 'groups',
      title: 'Hai group độc lập',
      beats: [
        'Một group khác, ví dụ analytics, cũng đọc topic này. Nó nhận lại toàn bộ dữ liệu, từ đầu.',
        'Mỗi group tự nhớ mình đã đọc đến đâu. Billing dừng một giờ thì chỉ billing bị tụt lại.',
        'Analytics vẫn đọc bình thường, không chậm đi chút nào.',
      ],
    },
    {
      id: 'join',
      title: 'Ai chia?',
      beats: [
        'Ai quyết định cách chia? Một broker làm group coordinator cho cả đội.',
        'Mọi consumer gửi JoinGroup. Coordinator chọn người vào đầu tiên làm trưởng nhóm, và gửi cho nó danh sách thành viên.',
        'Trưởng nhóm tính bảng chia, gửi lại qua SyncGroup. Mỗi người chỉ nhận phần của mình.',
      ],
    },
    {
      id: 'lag',
      title: 'Lag',
      beats: [
        'Làm sao biết đội có đọc kịp không? Nhìn lag.',
        'Lag bằng High Watermark trừ vị trí group đã ghi nhận. Ở đây là hai mươi lăm tin.',
        'Con số lúc này không quan trọng bằng xu hướng. Lag tăng đều nghĩa là đội đọc chậm hơn tốc độ ghi.',
        'Còn lag giảm dần về không nghĩa là đội đang theo kịp.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: consumer tự kéo tin bằng poll, và phải poll đều đặn.',
        'Hai: trong một group, mỗi partition chỉ có một consumer.',
        'Ba: consumer nhiều hơn partition thì phần dư ngồi chơi.',
        'Và bốn: mỗi group đọc độc lập. Hãy nhìn xu hướng của lag.',
      ],
    },
  ],
}
