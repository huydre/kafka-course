import type { LessonScript } from '../player/types'

/** Narration for "rebalance triggers, heartbeat vs poll timeouts, eager vs cooperative, static membership, KIP-848". */
export const rebalanceScript: LessonScript = {
  slug: 'rebalance',
  module: 'Module 5 · Consumer Group',
  title: 'Rebalance: khi group chia lại',
  summary:
    'Khi nào group phải chia lại partition, Kafka phát hiện consumer chết hay treo bằng hai đồng hồ nào, vì sao cách chia cũ làm cả group khựng lại, và cooperative, static membership, giao thức mới giảm cái khựng đó ra sao.',
  scenes: [
    {
      id: 'hook',
      title: 'Thêm một người, cả đội dừng',
      hold: 1,
      beats: [
        'Group đang chạy êm. C1 đọc P0 và P1, C2 đọc P2 và P3.',
        'Bạn scale thêm một consumer, C3. Kafka phải chia lại.',
        'Và trong lúc chia lại, cả bốn partition đều ngừng đọc. Chỉ vì cần chuyển đúng một partition.',
      ],
    },
    {
      id: 'triggers',
      title: 'Khi nào chia lại?',
      beats: [
        'Rebalance xảy ra mỗi khi thành viên của group thay đổi.',
        'Có người mới vào. Có người tắt gọn. Có người chết im lặng. Hoặc có người treo.',
        'Topic được thêm partition cũng khiến group phải chia lại.',
      ],
    },
    {
      id: 'clocks',
      title: 'Hai đồng hồ',
      beats: [
        'Coordinator dùng hai đồng hồ để biết một consumer còn ổn hay không.',
        'Luồng nền gửi nhịp tim mỗi ba giây. Bốn mươi lăm giây không nghe nhịp tim, consumer bị coi là đã chết.',
        'Nhưng nhịp tim chỉ chứng minh tiến trình còn sống. Luồng xử lý có thể kẹt, mà nhịp tim vẫn đều.',
        'Vì vậy có đồng hồ thứ hai. Năm phút không gọi poll, consumer bị coi là treo, và tự rời group.',
      ],
    },
    {
      id: 'eager',
      title: 'Eager: dừng cả thế giới',
      beats: [
        'Cách chia cũ gọi là eager. Khi C3 vào, mọi người trả lại tất cả partition.',
        'Không ai đọc gì cả, cho đến khi chia lại xong từ đầu.',
        'Group càng lớn, mỗi lần scale cả hệ thống càng khựng lâu, có khi vài chục giây.',
      ],
    },
    {
      id: 'coop',
      title: 'Cooperative: chỉ trả phần phải chuyển',
      beats: [
        'Cách mới là cooperative. C1 và C2 giữ phần của mình, và vẫn đọc tiếp.',
        'Vòng một, C2 chỉ trả đúng P3. Vòng hai, P3 được giao cho C3.',
        'P0, P1, P2 không ngừng giây nào. Cái giá là cần ít nhất hai vòng.',
      ],
    },
    {
      id: 'static',
      title: 'Static membership',
      beats: [
        'Deploy kiểu rolling restart: mỗi pod tắt rồi bật, gây hai lần rebalance. Mười pod là hai mươi lần.',
        'Đặt group instance id cố định cho mỗi consumer. Khi pod tắt, coordinator giữ chỗ cho nó.',
        'Pod quay lại trước khi hết session timeout thì nhận lại đúng phần cũ. Không rebalance lần nào.',
      ],
    },
    {
      id: 'kip848',
      title: 'Giao thức mới',
      beats: [
        'Giao thức cổ điển bắt cả group họp qua JoinGroup và SyncGroup. Ai chậm thì cả group chờ.',
        'Giao thức mới, chính thức từ Kafka bốn, chuyển việc chia về broker.',
        'Broker nhắn riêng từng consumer qua nhịp tim: bạn thả P3, bạn nhận P3. Không ai phải chờ ai.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: thành viên thay đổi thì group chia lại.',
        'Hai: nhịp tim bắt consumer chết, đồng hồ poll bắt consumer treo.',
        'Ba: eager dừng cả group, cooperative chỉ dừng phần phải chuyển.',
        'Và bốn: static membership giúp restart ngắn không gây rebalance.',
      ],
    },
  ],
}
