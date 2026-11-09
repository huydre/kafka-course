import type { LessonScript } from '../player/types'

/** Narration for "acks & idempotence". Each beat drives the animation timing. */
export const acksIdempotenceScript: LessonScript = {
  slug: 'acks-idempotence',
  module: 'Module 3 · Producer',
  title: 'acks & Idempotence',
  summary:
    'Thế nào là "gửi xong": acks bằng 0, 1 hay all. Vì sao acks bằng 1 có thể mất tin đã báo thành công. Và idempotence giúp retry mà không trùng, không đảo thứ tự như thế nào.',
  scenes: [
    {
      id: 'hook',
      title: 'Đã OK mà vẫn mất',
      hold: 1,
      beats: [
        'Producer nhận được câu trả lời OK cho một trăm tin.',
        'Một giây sau, broker leader chết. Broker mới lên thay, và một trăm tin đó không còn nữa.',
        'Broker đã nói OK, vậy tin đi đâu? Câu trả lời nằm ở một cấu hình: acks.',
      ],
    },
    {
      id: 'levels',
      title: 'Ba mức acks',
      beats: [
        'acks quyết định producer chờ tới đâu mới coi là gửi xong.',
        'acks bằng không: gửi đi là xong, không chờ gì cả. Nhanh nhất, nhưng không biết tin có tới không.',
        'acks bằng một: chờ leader ghi xong.',
        'acks bằng all: chờ leader và mọi bản sao đồng bộ đều có tin. Đây là mặc định từ Kafka ba chấm không.',
      ],
    },
    {
      id: 'loss',
      title: 'acks=1 mất tin thế nào',
      beats: [
        'Với acks bằng một, leader ghi xong là trả lời OK ngay.',
        'Nhưng follower chưa kịp chép. Đúng lúc đó leader chết.',
        'Follower lên làm leader mới, và nó không hề có những tin vừa báo OK.',
        'Với acks bằng all, leader chỉ trả lời sau khi follower đã chép, nên kịch bản này không xảy ra.',
      ],
    },
    {
      id: 'duplicate',
      title: 'Retry sinh trùng',
      beats: [
        'Để không mất tin, producer sẽ gửi lại khi không nhận được trả lời.',
        'Nhưng nếu tin đã ghi xong, chỉ có câu trả lời bị mất thì sao?',
        'Producer gửi lại, broker ghi thêm lần nữa. Một tin thành hai.',
      ],
    },
    {
      id: 'sequence',
      title: 'Đánh số thùng',
      beats: [
        'Idempotence giải quyết bằng cách đánh số. Mỗi producer có một mã riêng, mỗi thùng mang số thứ tự.',
        'Broker nhớ số cuối cùng đã ghi cho từng producer và từng partition.',
        'Thùng gửi lại mang số đã có: broker nhận ra trùng, không ghi lần nữa.',
        'Thùng nhảy cóc, chưa tới lượt: broker từ chối, producer gửi lại đúng thứ tự.',
      ],
    },
    {
      id: 'limits',
      title: 'Giới hạn',
      hold: 1,
      beats: [
        'Idempotence bật mặc định từ Kafka ba chấm không, và cần acks bằng all.',
        'Nó chỉ chống trùng do retry trong cùng một producer.',
        'Ứng dụng khởi động lại, hay chạy hai producer cùng gửi một dữ liệu, thì vẫn trùng. Muốn hơn nữa, cần transaction.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: acks quyết định khi nào là gửi xong.',
        'Hai: acks bằng một có thể mất tin đã báo OK.',
        'Ba: retry an toàn nhờ mã producer và số thứ tự.',
        'Và bốn: idempotence chỉ trong một phiên producer.',
      ],
    },
  ],
}
