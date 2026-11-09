import type { LessonScript } from '../player/types'

/** Narration for the segment / roll / retention lesson. Each beat is spoken by the voice track and drives the animation timing. */
export const segmentRetentionScript: LessonScript = {
  slug: 'segment-retention',
  module: 'Module 1 · Log & Storage',
  title: 'Segment, Roll & Retention',
  summary:
    'Vì sao log của một partition bị cắt thành nhiều file segment, khi nào Kafka đóng file cũ để mở file mới, và vì sao Kafka xoá dữ liệu cũ theo cả file chứ không theo từng tin.',
  scenes: [
    {
      id: 'hook',
      title: 'Hồ sơ vụ việc',
      hold: 1,
      beats: [
        'Bạn đặt retention bảy ngày, vậy mà dữ liệu mười ngày tuổi vẫn nằm trên đĩa.',
        'Một topic không ai ghi suốt kỳ nghỉ Tết. Quay lại thì partition trống trơn.',
        'Hai chuyện tưởng như ngược nhau, nhưng thủ phạm là một: cách Kafka cắt log thành segment.',
      ],
    },
    {
      id: 'split',
      title: 'Vì sao chia segment',
      beats: [
        'Một partition được ghi nối đuôi mãi mãi. Nếu chỉ dùng một file, file đó sẽ phình to không giới hạn.',
        'Muốn bỏ dữ liệu cũ ở đầu một file khổng lồ thì rất tốn kém, vì gần như phải viết lại cả file.',
        'Nên Kafka cắt log thành nhiều file nhỏ, gọi là segment. Bỏ dữ liệu cũ chỉ là xoá nguyên một file.',
      ],
    },
    {
      id: 'naming',
      title: 'Tên file = base offset',
      beats: [
        'Mỗi segment được đặt tên theo offset của tin đầu tiên trong nó, gọi là base offset.',
        'Ví dụ có ba file: 0, 100 và 200. Muốn đọc offset 150 thì mở file nào?',
        'File 100, vì đó là tên lớn nhất mà vẫn không vượt quá 150. Kafka chỉ cần nhìn tên, không cần mở file.',
        'File có tên lớn nhất là active segment. Chỉ nó được ghi thêm, các file cũ đã đóng và chỉ để đọc.',
      ],
    },
    {
      id: 'roll',
      title: 'Roll segment',
      hold: 1.5,
      beats: [
        'Active segment không lớn mãi. Khi chạm ngưỡng, Kafka đóng nó lại và mở segment mới. Việc này gọi là roll.',
        'Ngưỡng thứ nhất là kích thước: segment bytes, mặc định một gigabyte.',
        'Ngưỡng thứ hai là thời gian: segment ms, mặc định bảy ngày. Ngưỡng nào tới trước thì roll trước.',
        'Lưu ý: ngưỡng thời gian chỉ được kiểm tra khi có tin mới ghi vào.',
      ],
    },
    {
      id: 'retention',
      title: 'Retention',
      beats: [
        'Retention quyết định dữ liệu được giữ bao lâu. Mặc định retention ms là bảy ngày.',
        'Kafka không xoá từng tin. Nó xoá nguyên một segment, khi tin mới nhất trong segment đó đã quá hạn.',
        'Vì vậy, có tin đã mười ngày tuổi vẫn còn, vì nằm chung segment với tin mới hơn.',
        'Bộ dọn dẹp chạy khoảng năm phút một lần, nên retention là thời gian giữ tối thiểu, không phải giờ xoá chính xác.',
      ],
    },
    {
      id: 'idle',
      title: 'Bẫy: topic im lặng',
      hold: 1.2,
      beats: [
        'Câu hỏi bẫy: active segment có bao giờ bị xoá không?',
        'Có. Nếu topic im lặng quá thời gian retention, Kafka mở một segment rỗng mới, rồi xoá luôn segment cũ.',
        'Topic vẫn còn, nhưng dữ liệu cũ đã mất hết. Consumer quay lại sau một kỳ nghỉ dài có thể thấy partition trống trơn.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: log được cắt thành segment, để xoá dữ liệu cũ chỉ là xoá file.',
        'Hai: tên file là base offset, file lớn nhất là active segment.',
        'Ba: roll khi đủ một gigabyte hoặc đủ bảy ngày, ngưỡng nào tới trước.',
        'Và bốn: retention xoá cả segment khi tin mới nhất trong đó quá hạn, kể cả active segment.',
      ],
    },
  ],
}
