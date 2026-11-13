import type { LessonScript } from '../player/types'

/** Narration for "committed offset, __consumer_offsets, auto commit traps, commitSync vs commitAsync". */
export const commitOffsetScript: LessonScript = {
  slug: 'commit-offset',
  module: 'Module 6 · Offset & Delivery',
  title: 'Commit offset: nhớ đã đọc đến đâu',
  summary:
    'Consumer chết rồi khởi động lại phải đọc tiếp từ đâu: committed offset là gì, được lưu ở đâu, vì sao auto commit có hai cái bẫy, và commitSync với commitAsync khác nhau ra sao.',
  scenes: [
    {
      id: 'hook',
      title: 'Đọc tiếp từ đâu?',
      hold: 1,
      beats: [
        'Một consumer đã đọc partition P0 từ offset không đến offset hai mươi chín.',
        'Rồi máy khởi động lại. Nó phải đọc tiếp từ đâu?',
        'Đọc lại từ đầu thì xử lý trùng. Nhảy tới cuối thì bỏ sót. Cần một chỗ ghi nhớ bền vững.',
      ],
    },
    {
      id: 'offsets',
      title: 'Committed offset',
      beats: [
        'Chỗ ghi nhớ đó gọi là committed offset: số thứ tự của tin tiếp theo cần đọc.',
        'Đọc xong tin hai mươi chín thì commit ba mươi. Không phải hai mươi chín.',
        'Mỗi lần commit là một tin nhắn ghi vào topic nội bộ tên là consumer offsets, với key là group, topic và partition.',
        'Topic này dùng compaction, chỉ giữ giá trị mới nhất. Nên consumer nào nhận partition sau này cũng đọc được đúng con số đó.',
      ],
    },
    {
      id: 'bookmark',
      title: 'Kẹp sách nằm ở đâu?',
      beats: [
        'Con số commit chỉ là lời hứa của consumer. Kafka không kiểm tra bạn đã xử lý thật hay chưa.',
        'Kẹp dời đi quá xa: những tin chưa xử lý bị bỏ qua. Consumer chết là mất tin.',
        'Kẹp ở lại phía sau: những tin đã xử lý bị đọc lại. Consumer chết là xử lý lặp.',
        'Cả module này xoay quanh một câu hỏi: dời kẹp vào lúc nào?',
      ],
    },
    {
      id: 'auto',
      title: 'Auto commit và cái bẫy lặp',
      beats: [
        'Auto commit là cách Kafka tự dời kẹp giúp bạn, mặc định mỗi năm giây.',
        'Nhưng không có đồng hồ nào chạy nền. Việc commit nằm bên trong lệnh poll, và chỉ commit những tin mà các lần poll trước đã trả về.',
        'Bẫy thứ nhất: consumer chết ở giây thứ bốn rưỡi, chưa đủ năm giây nên chưa commit lần nào.',
        'Khởi động lại, nó đọc từ không. Ba trăm tin đã xử lý xong lại bị xử lý lần thứ hai.',
      ],
    },
    {
      id: 'autolost',
      title: 'Auto commit và cái bẫy mất tin',
      beats: [
        'Bẫy thứ hai: để chạy nhanh, bạn đẩy tin sang luồng khác xử lý, còn luồng chính poll tiếp ngay.',
        'Đến giây thứ năm, poll commit một trăm, vì mẻ đó đã được trả về. Nhưng luồng kia mới xử lý xong bốn mươi tin.',
        'Consumer chết, rồi khởi động lại và đọc từ một trăm.',
        'Sáu mươi tin, từ bốn mươi đến chín mươi chín, không bao giờ được xử lý. Muốn an toàn, hãy tắt auto commit và commit bằng tay.',
      ],
    },
    {
      id: 'sync',
      title: 'commitSync và commitAsync',
      beats: [
        'Commit bằng tay cho bạn tự quyết lúc nào dời kẹp, ví dụ chỉ sau khi ghi database xong. Có hai cách.',
        'CommitSync như thư bảo đảm: gửi đi rồi đứng chờ giấy báo nhận. Thư thất lạc thì tự gửi lại.',
        'CommitAsync như thư thường: thả vào hộp rồi làm việc tiếp ngay. Nhanh hơn, nhưng thất bại thì chỉ báo qua callback.',
        'Mẫu hay dùng: commitAsync trong vòng lặp cho nhanh, và commitSync một lần cuối trước khi đóng consumer.',
      ],
    },
    {
      id: 'asyncorder',
      title: 'Vì sao commitAsync không thử lại?',
      beats: [
        'Vì sao commitAsync không tự thử lại? Xem một ví dụ.',
        'Lệnh commit một trăm gửi đi thì lạc. Lệnh commit hai trăm gửi sau và tới nơi. Kẹp đang ở hai trăm.',
        'Nếu tự thử lại, lệnh một trăm cũ tới sau và ghi đè. Kẹp lùi về một trăm, một trăm tin đã xử lý sẽ bị đọc lại.',
        'Nên Kafka để bạn quyết định trong callback: chỉ thử lại khi chưa có lệnh commit nào mới hơn.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: committed offset là tin tiếp theo cần đọc, lưu trong topic consumer offsets.',
        'Hai: auto commit commit những gì poll đã trả về, không phải những gì bạn xử lý xong.',
        'Ba: xử lý ở luồng khác kèm auto commit có thể làm mất tin.',
        'Và bốn: commitAsync không thử lại, còn commitSync dùng một lần cuối trước khi đóng.',
      ],
    },
  ],
}
