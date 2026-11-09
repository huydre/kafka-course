import type { LessonScript } from '../player/types'

/** Narration for "Leader, ISR & High Watermark". Each beat drives the animation timing. */
export const replicationIsrScript: LessonScript = {
  slug: 'replication-isr',
  module: 'Module 4 · Replication',
  title: 'Leader, ISR & High Watermark',
  summary:
    'Vì sao mỗi partition có nhiều bản sao, follower chép leader thế nào, ISR là gì, High Watermark tính ra sao, và vì sao acks=all phải đi cùng min.insync.replicas.',
  scenes: [
    {
      id: 'hook',
      title: 'Một ổ đĩa hỏng',
      hold: 1,
      beats: [
        'Một partition nằm trên đĩa của một broker.',
        'Ổ đĩa đó hỏng. Toàn bộ dữ liệu của partition biến mất.',
        'Kafka giải quyết bằng cách giữ nhiều bản sao, trên nhiều broker khác nhau.',
      ],
    },
    {
      id: 'replicas',
      title: 'Leader và follower',
      beats: [
        'Replication factor bằng ba nghĩa là mỗi partition có ba bản sao, nằm trên ba broker.',
        'Đúng một bản là leader. Mọi lệnh ghi đều đi vào leader.',
        'Hai bản còn lại là follower. Chúng tự kéo dữ liệu từ leader về, giống như một consumer.',
        'Mỗi lần follower hỏi xin từ offset nào, leader biết follower đó đã chép tới đâu.',
      ],
    },
    {
      id: 'isr',
      title: 'ISR',
      beats: [
        'ISR là danh sách những bản sao đang theo kịp leader.',
        'Nếu một follower tụt lại quá ba mươi giây, nó bị loại khỏi ISR. Leader không đứng chờ nó.',
        'Khi follower đó đuổi kịp trở lại, nó được thêm lại vào ISR.',
      ],
    },
    {
      id: 'hw',
      title: 'High Watermark',
      beats: [
        'Mỗi bản sao có LEO, vị trí cuối log của nó.',
        'High Watermark bằng LEO nhỏ nhất trong ISR. Ở đây là sáu.',
        'Consumer chỉ được đọc tới High Watermark, vì chỉ những tin đó mới có ở mọi bản trong ISR.',
        'Follower chậm nhất chép thêm, High Watermark tiến lên tám.',
      ],
    },
    {
      id: 'minisr',
      title: 'min.insync.replicas',
      beats: [
        'acks bằng all nghĩa là chờ mọi bản trong ISR. Nhưng ISR có thể co lại chỉ còn mỗi leader.',
        'Khi đó all chỉ là một bản. Leader chết là mất tin, dù đã báo OK.',
        'Nên cần thêm min insync replicas bằng hai: ISR ít hơn hai thì leader từ chối ghi.',
        'Công thức chuẩn: replication factor ba, min insync replicas hai, acks bằng all.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: mỗi partition có một leader nhận ghi, các follower tự kéo dữ liệu về.',
        'Hai: ISR là những bản đang theo kịp, tụt quá ba mươi giây thì bị loại.',
        'Ba: High Watermark là LEO nhỏ nhất trong ISR, consumer chỉ đọc tới đó.',
        'Và bốn: acks all phải đi cùng min insync replicas bằng hai.',
      ],
    },
  ],
}
