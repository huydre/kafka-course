import type { LessonScript } from '../player/types'

/** Narration for "why schemas, Schema Registry and the wire format, compatibility modes and upgrade order". */
export const schemaRegistryScript: LessonScript = {
  slug: 'schema-registry',
  module: 'Module 8 · Hệ sinh thái',
  title: 'Schema Registry & compatibility',
  summary:
    'Vì sao broker không hiểu nội dung tin nên cần schema làm hợp đồng giữa producer và consumer, Schema Registry cấp id và gác cổng ra sao, wire format gồm magic byte, bốn byte schema id và dữ liệu, và các chế độ BACKWARD, FORWARD, FULL quyết định ai nâng cấp trước.',
  scenes: [
    {
      id: 'hook',
      title: 'Đổi tên một trường',
      hold: 1,
      beats: [
        'Đội A viết producer gửi đơn hàng. Đội B viết consumer cộng trường amount vào doanh thu.',
        'Nhưng broker không hiểu nội dung. Với broker, mỗi tin chỉ là một dãy byte.',
        'Một hôm đội A dọn code, đổi tên amount thành total. Broker vẫn nhận bình thường.',
        'Consumer tìm amount thì không thấy, cộng thêm không đồng vào doanh thu, và không ai hay biết.',
      ],
    },
    {
      id: 'contract',
      title: 'Schema là hợp đồng',
      beats: [
        'Schema là mẫu tờ khai: thoả thuận trước tin có những trường nào, kiểu gì.',
        'Tin JSON phải lặp lại tên trường trong mọi tin, nên tin bé xíu này đã tốn ba mươi mốt byte.',
        'Với Avro, tên trường nằm trong schema. Tin chỉ chứa giá trị, vỏn vẹn bốn byte.',
        'Ba định dạng phổ biến là Avro, Protobuf và JSON Schema.',
      ],
    },
    {
      id: 'registry',
      title: 'Schema Registry',
      beats: [
        'Gửi kèm schema vào mọi tin thì tin bốn byte phình thành hơn ba trăm byte, mất hết lợi ích.',
        'Vì vậy có một dịch vụ riêng là Schema Registry, lưu schema và cấp cho mỗi schema một số id.',
        'Producer đăng ký schema một lần, và nhận về id bốn mươi hai.',
        'Tin chỉ mang số id đó. Consumer hỏi Registry một lần, rồi nhớ lại trong cache.',
      ],
    },
    {
      id: 'wire',
      title: 'Wire format',
      beats: [
        'Mỗi tin trên Kafka bắt đầu bằng năm byte cố định, theo định dạng của Confluent.',
        'Byte đầu tiên là magic byte, luôn bằng không.',
        'Bốn byte tiếp theo là schema id. Không không không hai mươi A, tức là bốn mươi hai.',
        'Phần còn lại là dữ liệu Avro đã mã hoá. Mỗi tin chỉ tốn thêm năm byte, thay vì cả schema.',
      ],
    },
    {
      id: 'gate',
      title: 'Người gác cổng',
      beats: [
        'Registry còn là người gác cổng. Khi có schema mới, nó kiểm tra schema đó có tương thích với bản cũ không.',
        'Producer thêm trường discount mà không có giá trị mặc định. Registry từ chối đăng ký.',
        'Producer không gửi được tin nào, nên tin xấu không bao giờ vào topic.',
        'Producer thêm giá trị mặc định bằng không. Lần này Registry nhận, và cấp id mới.',
      ],
    },
    {
      id: 'compat',
      title: 'Compatibility',
      beats: [
        'Schema rồi cũng phải đổi. Nhưng producer và consumer không nâng cấp cùng một giây.',
        'Thêm trường có giá trị mặc định thì an toàn. Code mới đọc tin cũ thì điền mặc định. Code cũ đọc tin mới thì bỏ qua trường lạ.',
        'Thêm trường không có mặc định thì code mới gặp tin cũ, không có gì để điền, và hỏng.',
        'Bỏ trường amount thì code mới bỏ qua phần thừa. Nhưng code cũ cần amount, mà tin mới không còn.',
      ],
    },
    {
      id: 'order',
      title: 'Ai nâng cấp trước',
      beats: [
        'BACKWARD, mặc định của Confluent: schema mới đọc được dữ liệu cũ. Nên consumer phải nâng cấp trước.',
        'Consumer mới đọc được cả tin cũ lẫn tin mới. Sau đó producer mới đổi.',
        'FORWARD thì ngược lại: consumer cũ vẫn đọc được tin mới, nên producer nâng cấp trước.',
        'FULL đúng cả hai chiều, nên thứ tự nào cũng được.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: broker chỉ thấy byte, nên schema là hợp đồng được kiểm tra ở phía client.',
        'Hai: Registry cấp id cho schema, và mỗi tin chỉ thêm năm byte: magic byte cùng bốn byte id.',
        'Ba: Registry chặn schema không tương thích ngay lúc đăng ký, trước khi tin xấu vào topic.',
        'Và bốn: BACKWARD thì consumer nâng cấp trước, FORWARD thì producer trước, FULL thì thứ tự nào cũng được.',
      ],
    },
  ],
}
