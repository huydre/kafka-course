import type { LessonScript } from '../player/types'

/** Narration for "leader election, unclean election, leader epoch, KRaft controller". */
export const leaderElectionScript: LessonScript = {
  slug: 'leader-election',
  module: 'Module 4 · Replication',
  title: 'Leader chết: bầu leader mới',
  summary:
    'Khi leader chết, ai lên thay và vì sao không mất tin. Khi ISR trống: chờ hay chấp nhận mất dữ liệu (unclean election). Leader epoch sửa lỗi cắt log thế nào, và controller KRaft quyết định mọi chuyện ra sao.',
  scenes: [
    {
      id: 'hook',
      title: 'Người cuối cùng',
      hold: 1,
      beats: [
        'Mười giờ, ISR có đủ ba broker. Mười giờ một phút, broker ba chậm lại và bị loại.',
        'Mười giờ hai phút, broker hai chết. Mười giờ ba phút, leader cũng chết.',
        'Chỉ còn broker ba sống, nhưng nó thiếu dữ liệu. Có nên cho nó làm leader không?',
      ],
    },
    {
      id: 'clean',
      title: 'Bầu leader từ ISR',
      beats: [
        'Trường hợp bình thường: leader chết, controller chọn một bản trong ISR lên thay.',
        'Bản trong ISR có đủ mọi tin tới High Watermark.',
        'Nên mọi tin đã báo OK với acks bằng all vẫn còn nguyên. Consumer đọc tiếp như chưa có gì xảy ra.',
      ],
    },
    {
      id: 'unclean',
      title: 'Unclean election',
      beats: [
        'Nhưng nếu ISR trống thì sao? Có hai lựa chọn.',
        'Mặc định, Kafka chờ một bản trong ISR sống lại. Partition đứng yên, không đọc không ghi, nhưng không mất tin.',
        'Nếu bật unclean leader election, broker thiếu dữ liệu lên làm leader ngay. Partition chạy lại, nhưng mất các tin nó chưa có.',
        'Tệ hơn, offset cũ bị đánh số lại cho tin mới. Consumer có thể thấy hai sự thật khác nhau.',
      ],
    },
    {
      id: 'epoch',
      title: 'Leader epoch',
      beats: [
        'Mỗi lần đổi leader, Kafka tăng một con số gọi là leader epoch, và ghi lại nhiệm kỳ đó bắt đầu từ offset nào.',
        'Khi một follower khởi động lại, nó hỏi leader: nhiệm kỳ cuối của tôi kết thúc ở đâu?',
        'Rồi nó chỉ cắt đúng phần thực sự sai, thay vì cắt theo High Watermark cũ và vô tình xoá mất tin.',
      ],
    },
    {
      id: 'quorum',
      title: 'Controller KRaft',
      beats: [
        'Ai quyết định leader nào? Đó là controller.',
        'Với KRaft, metadata nằm trong một log nội bộ, do một nhóm ba controller giữ. Mọi thay đổi cần đa số đồng ý.',
        'Mất một controller vẫn chạy. Mất hai thì cụm đóng băng: dữ liệu vẫn đọc ghi, nhưng không bầu được leader mới.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: leader mới luôn chọn từ ISR, nên không mất tin đã báo OK.',
        'Hai: ISR trống thì mặc định đứng chờ. Unclean thì chạy ngay nhưng mất tin.',
        'Ba: leader epoch giúp follower chỉ cắt đúng phần sai.',
        'Và bốn: controller cần đa số để ra quyết định.',
      ],
    },
  ],
}
