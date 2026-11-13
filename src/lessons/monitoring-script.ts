import type { LessonScript } from '../player/types'

/** Narration for "consumer lag and its trend, cluster health, request latency breakdown, threads, disk, network". */
export const monitoringScript: LessonScript = {
  slug: 'monitoring',
  module: 'Module 9 · Vận hành',
  title: 'Giám sát: lag, sức khoẻ cluster, độ trễ',
  summary:
    'Đo gì để biết Kafka chậm ở đâu: lag và xu hướng của lag, bốn con số sức khoẻ cluster (URP, UnderMinIsr, offline, controller), độ trễ request chia theo chặng, và phần trăm rảnh của luồng xử lý, đĩa, mạng.',
  scenes: [
    {
      id: 'hook',
      title: 'Chậm mười phút, không có lỗi',
      hold: 1,
      beats: [
        'Người dùng phàn nàn: thông báo đến chậm mười phút.',
        'Kafka vẫn chạy. Không có lỗi nào trong log.',
        'Vậy chậm ở đâu? Bạn cần một bảng đồng hồ để nhìn vào bên trong.',
      ],
    },
    {
      id: 'lag',
      title: 'Lag là gì',
      beats: [
        'Lag của một partition bằng log end offset, trừ offset consumer đã commit.',
        'Ví dụ: end offset mười nghìn, consumer đã commit chín nghìn bốn trăm.',
        'Lag là sáu trăm tin đang nằm chờ.',
      ],
    },
    {
      id: 'trend',
      title: 'Xu hướng quan trọng hơn con số',
      beats: [
        'Nhưng một con số lag chưa nói lên gì. Xu hướng mới quan trọng.',
        'Group A đo ba lần: năm nghìn, năm nghìn hai, bốn nghìn chín. Dao động quanh một mức, consumer vẫn theo kịp.',
        'Group B cũng bắt đầu từ năm nghìn, rồi tám nghìn, mười một nghìn. Tăng đều ba nghìn mỗi phút, tức năm mươi tin mỗi giây.',
        'Cùng lag lúc mười giờ, nhưng A khoẻ còn B đang hỏng. Vì vậy hãy cảnh báo theo xu hướng, không chỉ theo ngưỡng.',
      ],
    },
    {
      id: 'catchup',
      title: 'Bao lâu thì hết lag',
      beats: [
        'Đổi lag ra thời gian: lag chia cho tốc độ xử lý. Sáu nghìn tin, hai trăm tin mỗi giây, tin mới nhất chờ ba mươi giây.',
        'Bao lâu thì hết lag? Lag chia cho hiệu số giữa tốc độ đọc và tốc độ ghi.',
        'Lag chín mươi nghìn, đọc hai nghìn, producer vẫn ghi một nghìn năm trăm. Chín mươi nghìn chia năm trăm, được một trăm tám mươi giây.',
        'Nếu tốc độ đọc không lớn hơn tốc độ ghi, lag không bao giờ hết.',
      ],
    },
    {
      id: 'health',
      title: 'Bốn con số sức khoẻ cluster',
      beats: [
        'Lấy cluster ba broker, topic có RF ba, min ISR hai, producer dùng acks all.',
        'Một broker chết: ISR còn hai trên ba, URP lên một. Vẫn ghi được, nhưng hết dự phòng.',
        'Hai broker chết: ISR còn một, thấp hơn min ISR. UnderMinIsr lên một, producer nhận lỗi và không ghi được.',
        'Cả ba chết: partition không còn leader. Offline partitions lên một, không đọc không ghi được.',
        'Con số thứ tư là active controller: tổng cả cluster phải đúng bằng một. Bằng không hay lớn hơn một đều là báo động.',
      ],
    },
    {
      id: 'latency',
      title: 'Request chậm ở chặng nào',
      beats: [
        'Cluster khoẻ, lag ổn, nhưng producer vẫn báo gửi chậm. Chậm ở đâu?',
        'Broker chia mỗi request thành các chặng: chờ trong hàng đợi, ghi đĩa, chờ follower, rồi gửi trả.',
        'Produce p99 là một trăm hai mươi mili giây, mà chặng remote chiếm một trăm. Thủ phạm là follower chậm, không phải leader.',
        'Còn nếu chặng hàng đợi dài, broker đang thiếu luồng xử lý.',
      ],
    },
    {
      id: 'threads',
      title: 'Luồng, đĩa, mạng',
      beats: [
        'Hai đồng hồ cho biết broker còn sức không: phần trăm rảnh của luồng I O.',
        'Gần một trăm là rảnh. Dưới ba mươi bắt đầu để ý, dưới hai mươi là có vấn đề, dưới mười là sự cố thật.',
        'Luồng bận hết thì request mới phải xếp hàng, nên chặng hàng đợi dài ra.',
        'Đừng quên đĩa: cảnh báo sớm ở bảy mươi lăm phần trăm. Và mạng: byte ra tính cả phần follower kéo về để sao chép.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: nhìn xu hướng của lag, không chỉ con số.',
        'Hai: URP, UnderMinIsr, offline, và đúng một controller.',
        'Ba: độ trễ request chia theo chặng, queue, local, remote.',
        'Và bốn: luồng rảnh dưới ba mươi phần trăm, đĩa trên bảy mươi lăm, là lúc phải để ý.',
      ],
    },
  ],
}
