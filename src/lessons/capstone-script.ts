import type { LessonScript } from '../player/types'

/** Narration for "the final project: mini order pipeline, requirements, acceptance criteria, REPORT.md, self-scoring". */
export const capstoneScript: LessonScript = {
  slug: 'capstone',
  module: 'Module 11 · Capstone',
  title: 'Capstone: hệ thống đặt hàng',
  summary:
    'Đề bài cuối khoá: dựng một pipeline đơn hàng không mất sự kiện, không cộng trùng, không kẹt vì tin hỏng; xem sơ đồ các thành phần, yêu cầu từng mốc nối về module nào, chín tiêu chí đo được, bốn bài diễn tập sự cố, bảng tự chấm một trăm điểm và REPORT.md.',
  scenes: [
    {
      id: 'hook',
      title: 'Ba điều cấm',
      hold: 1,
      beats: [
        'Đây là đề bài cuối khoá: dựng một pipeline xử lý đơn hàng bằng Kafka.',
        'Ba điều cấm. Không mất sự kiện. Không cộng trùng. Không kẹt vì một tin hỏng.',
        'Và bạn phải chứng minh cả ba bằng số liệu thật, không phải bằng câu: chắc là chạy.',
      ],
    },
    {
      id: 'system',
      title: 'Bức tranh tổng thể',
      beats: [
        'Đầu tiên là order-generator, một producer sinh một nghìn đơn, mỗi đơn vài sự kiện.',
        'Sự kiện vào topic orders, sáu partition, key là orderId. Ba instance order-processor cùng một group đọc, và ghi inbox vào SQLite.',
        'Xử lý xong thì ghi trạng thái vào order-status, một topic nén. Lệnh status-query chỉ đọc topic này để trả lời đơn đang ở đâu.',
        'Lỗi tạm thời đi qua orders.retry.1, thử tối đa ba lần rồi vào DLQ. Còn lag-monitor cứ mười giây đo lag một lần.',
      ],
    },
    {
      id: 'requirements',
      title: 'Sáu mốc, sáu module',
      beats: [
        'Mốc một: cluster ba broker, topic orders sáu partition, replication factor ba, min ISR hai.',
        'Mốc hai: producer đặt key là orderId, acks all, và bật idempotence tường minh.',
        'Mốc ba: consumer tắt auto commit, và ghi inbox cùng trạng thái trong một giao dịch.',
        'Mốc bốn: read model nằm trên topic nén, tra cứu bằng một lệnh status-query.',
        'Mốc năm: lỗi tạm thời đi retry topic, tin hỏng đi thẳng vào DLQ.',
        'Mốc sáu: đo lag và diễn tập sự cố. Mỗi mốc nối về đúng module bạn đã học.',
      ],
    },
    {
      id: 'acceptance',
      title: 'Chín tiêu chí đo được',
      beats: [
        'Mọi tiêu chí đều phải đo được. Có chín kịch bản, từ AC một đến AC chín.',
        'AC một và AC chín: chạy sạch và replay từ đầu, read model đều phải khớp trăm phần trăm với expected.json.',
        'Vì vậy hãy viết verify.py trước tiên. Nó đọc order-status, so với expected, rồi in ra số đơn lệch.',
      ],
    },
    {
      id: 'drills',
      title: 'Bốn bài diễn tập sự cố',
      beats: [
        'Bốn bài diễn tập sự cố là chỗ bạn chứng minh hệ thống chịu được. Mỗi bài có điều kiện đạt rõ ràng.',
        'Kill một consumer: tin được đọc lại, inbox bỏ qua, và read model vẫn khớp.',
        'Dừng một broker: producer vẫn gửi được, không mất tin. Dừng hai broker thì producer nhận lỗi, và đó mới là hành vi đúng.',
        'Gửi trùng năm phần trăm: số eventId trong inbox vẫn bằng số sự kiện duy nhất.',
        'Chèn mười tin hỏng: đúng mười tin vào DLQ, và consumer chính không dừng lại.',
      ],
    },
    {
      id: 'scoring',
      title: 'Bảng tự chấm một trăm điểm',
      beats: [
        'Bảng tự chấm có một trăm điểm, chia theo từng hạng mục.',
        'Cluster và producer mỗi phần mười điểm. Consumer với inbox là hai mươi, vì đây là phần khó nhất.',
        'Read model mười điểm, retry và DLQ mười lăm, durability mười, giám sát mười.',
        'REPORT.md mười lăm điểm, cộng lại vừa đúng một trăm. Làm thêm outbox thì thưởng mười điểm.',
        'Từ tám mươi lăm điểm là vững. Nhưng điểm chỉ tính khi có output thật chứng minh.',
      ],
    },
    {
      id: 'report',
      title: 'REPORT.md và nộp bài',
      beats: [
        'REPORT.md có bảy câu hỏi, và câu nào cũng phải có chữ vì, nối đến một cơ chế.',
        'Vì sao sáu partition, vì sao key là orderId: câu trả lời nằm ở module hai.',
        'Vì sao một broker chết không mất tin, còn hai broker thì từ chối ghi: acks all và min ISR, ở module ba và bốn.',
        'Vì sao commit sau khi ghi SQLite, vì sao order-status nén còn orders thì không: module sáu và bảy.',
        'Cuối cùng là mất thứ tự do retry, và giới hạn hệ thống của bạn: module mười và chín.',
        'Nộp bài gồm repo, điểm tự chấm, log của chín kịch bản và REPORT.md.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      beats: [
        'Capstone là một pipeline đơn hàng: producer, topic orders, processor có inbox, và read model.',
        'Mọi thứ được chấm bằng chín tiêu chí đo được, nên hãy viết verify.py trước.',
        'Mất, trùng, kẹt: bốn bài diễn tập sự cố chứng minh hệ thống chịu được.',
        'Một trăm điểm chỉ tính khi có output thật, và REPORT.md phải trả lời bằng chữ vì.',
      ],
    },
  ],
}
