import type { LessonScript } from '../player/types'

/** Narration for "Kafka Streams: library, KStream vs KTable, state store, changelog, repartition, exactly_once_v2, when to use what". */
export const kafkaStreamsScript: LessonScript = {
  slug: 'kafka-streams',
  module: 'Module 8 · Hệ sinh thái',
  title: 'Kafka Streams',
  summary:
    'Kafka Streams là thư viện nằm trong ứng dụng chứ không phải một cluster; KStream khác KTable ra sao; bộ đếm sống trong state store, được sao lưu vào changelog và dựng lại khi instance chết; đổi key thì phải repartition; exactly_once_v2 gói ghi, changelog và commit vào một transaction; và khi nào chọn Connect, Streams hay client thường.',
  scenes: [
    {
      id: 'library',
      title: 'Không có server Streams',
      beats: [
        'Bạn muốn đếm mỗi sản phẩm đã bán bao nhiêu, theo thời gian thực, từ topic orders.',
        'Tự viết consumer thì phải tự lo: bộ đếm nằm ở đâu, crash có mất không, nhiều instance chia việc thế nào.',
        'Kafka Streams lo hết những việc đó. Nhưng đừng nhầm: nó không phải một cluster riêng.',
        'Nó là một thư viện, nằm ngay bên trong ứng dụng của bạn.',
        'Bên trong, bạn khai báo một topology: nút nguồn đọc topic, các processor biến đổi, và nút đích ghi topic.',
      ],
    },
    {
      id: 'scale',
      title: 'Scale bằng cách chạy thêm instance',
      beats: [
        'Muốn chạy nhanh hơn, bạn chỉ cần chạy thêm instance của ứng dụng, cùng một application id.',
        'Các instance tự chia partition như một consumer group. Mỗi partition thành một task.',
        'Topic có sáu partition thì có sáu task, nên tối đa sáu instance có việc để làm.',
        'Chạy tám instance thì hai instance ngồi không, hoặc làm bản sao dự phòng.',
      ],
    },
    {
      id: 'stream-table',
      title: 'KStream và KTable',
      beats: [
        'KStream là chuyện gì đã xảy ra: mỗi tin là một sự kiện mới.',
        'Ba giao dịch của A: cộng một trăm, cộng năm mươi, rồi trừ ba mươi. Không tin nào thay tin nào.',
        'KTable là hiện giờ là gì: tin sau ghi đè tin trước. Đọc nhầm thành KTable, chỉ còn A bằng trừ ba mươi.',
        'Muốn có tổng thì gom KStream theo key. Kết quả là một KTable: A bằng một trăm hai mươi.',
        'Hai dạng đổi qua lại được: gom stream thành table, còn mọi thay đổi của table lại thành một stream.',
      ],
    },
    {
      id: 'state',
      title: 'State store và changelog',
      beats: [
        'Đếm từ cần bộ nhớ. Streams giữ bộ đếm trong state store, mặc định là RocksDB trên đĩa của máy chạy ứng dụng.',
        'Mỗi lần state store đổi, Streams ghi thêm một tin vào changelog topic trên Kafka.',
        'Kafka lên hai, lên ba; streams lên một, lên hai. Changelog chép lại từng bước.',
        'Changelog được compact, nên cuối cùng mỗi từ chỉ còn đúng giá trị mới nhất.',
      ],
    },
    {
      id: 'restore',
      title: 'Instance chết, state vẫn còn',
      beats: [
        'Máy chạy ứng dụng chết thì state store trên đĩa của nó mất theo.',
        'Nhưng changelog vẫn nằm an toàn trong Kafka.',
        'Instance khác nhận task này, đọc lại changelog từ đầu và dựng lại state store.',
        'Xong thì bộ đếm trở về đúng giá trị cũ, và tiếp tục đếm từ chỗ đã dừng.',
        'Muốn chuyển nhanh hơn, giữ sẵn một bản sao nóng ở instance khác bằng num standby replicas.',
      ],
    },
    {
      id: 'repartition',
      title: 'Đổi key thì phải repartition',
      beats: [
        'Đếm theo từ thì mọi lần xuất hiện của một từ phải về cùng một task.',
        'Nhưng topic đầu vào là các câu, và cùng một từ nằm rải rác ở mọi partition.',
        'Nên khi đổi key sang từ, Streams ghi lại vào một repartition topic, để cùng từ vào cùng partition.',
        'Rồi các task đếm đọc từ đó. Đó là thêm một lượt ghi và đọc qua Kafka, có chi phí.',
      ],
    },
    {
      id: 'eos',
      title: 'Exactly once v2',
      beats: [
        'Một vòng xử lý gồm ba việc: ghi kết quả ra output, ghi changelog, và commit offset đầu vào.',
        'Crash ở giữa rồi chạy lại thì có thể đếm lặp. Đó là at least once, mặc định.',
        'Bật exactly once v2 thì cả ba việc nằm trong một transaction.',
        'Hoặc cả ba cùng hiện ra, hoặc không gì cả.',
        'Nhưng chỉ trong phạm vi Kafka tới Kafka. Gửi tin nhắn SMS ra ngoài thì vẫn có thể bị lặp.',
      ],
    },
    {
      id: 'choose',
      title: 'Khi nào dùng cái nào',
      beats: [
        'Một câu hỏi giúp chọn nhanh: dữ liệu cần được di chuyển, kiểm tra hình dạng, hay biến đổi?',
        'Di chuyển vào hoặc ra khỏi Kafka thì dùng Kafka Connect, như chiếc xe chở hàng.',
        'Kiểm tra hình dạng thì có Schema Registry, như tiêu chuẩn đóng gói.',
        'Gom nhóm, đếm, join, cửa sổ thời gian thì dùng Kafka Streams, như người đầu bếp.',
        'Còn logic đơn giản, gọi nhiều hệ thống bên ngoài, thì cứ dùng consumer và producer thường.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: Kafka Streams là thư viện trong ứng dụng, không phải cluster.',
        'Hai: KStream là sự kiện, KTable là giá trị mới nhất.',
        'Ba: state store có changelog để khôi phục, và đổi key thì phải repartition.',
        'Và bốn: exactly once v2 gói ba việc vào một transaction, nhưng chỉ trong Kafka.',
      ],
    },
  ],
}
