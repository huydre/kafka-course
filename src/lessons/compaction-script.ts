import type { LessonScript } from '../player/types'

/** Narration for "retention recap, cleanup.policy, log cleaner (clean/dirty/active, dirty ratio), tombstone". */
export const compactionScript: LessonScript = {
  slug: 'compaction',
  module: 'Module 7 · Retention & Compaction',
  title: 'Log compaction & tombstone',
  summary:
    'Vì sao xoá theo tuổi không hợp với dữ liệu trạng thái, cleanup policy delete, compact hay cả hai, log cleaner chia partition thành phần sạch, phần bẩn và active segment, khi nào tỉ lệ bẩn đủ lớn để dọn, và tombstone xoá một key ra sao.',
  scenes: [
    {
      id: 'hook',
      title: 'Hồ sơ chỉ cần bản mới nhất',
      hold: 1,
      beats: [
        'Topic user profile lưu hồ sơ người dùng. Mỗi lần sửa hồ sơ, một tin mới được ghi, với key là user id.',
        'Một service mới khởi động cần biết hồ sơ hiện tại của mọi người dùng.',
        'Nếu xoá theo tuổi, Bình, người không sửa hồ sơ suốt tám ngày, biến mất khỏi topic.',
        'Còn giữ mãi mãi thì topic phình to, với hàng triệu bản cũ không ai cần.',
      ],
    },
    {
      id: 'retention',
      title: 'Ôn nhanh retention',
      beats: [
        'Retention mặc định xoá theo tuổi. Kafka chỉ xoá nguyên segment, khi tin mới nhất trong segment đã quá retention ms.',
        'Retention bytes thì đặt trần dung lượng cho mỗi partition, không phải cho cả topic.',
        'Topic sáu partition, ba bản sao, mỗi partition mười gigabyte, thì đĩa thật dùng một trăm tám mươi gigabyte.',
        'Hai giới hạn độc lập nhau. Cái nào vi phạm trước thì xoá trước, và luôn xoá nguyên segment.',
      ],
    },
    {
      id: 'policy',
      title: 'Xoá theo key',
      beats: [
        'Compaction xoá theo key thay vì theo tuổi. Với mỗi key, chỉ cần giữ bản mới nhất.',
        'Sau khi compact, offset không đổi và thứ tự giữ nguyên. Chỉ còn những lỗ ở chỗ bản cũ biến mất.',
        'Cấu hình cleanup policy có ba giá trị: delete là mặc định, compact, và compact cộng delete.',
        'Delete hợp với dòng sự kiện. Compact hợp với trạng thái mới nhất của từng key.',
        'Với compact cộng delete, tin quá retention ms vẫn bị xoá, kể cả khi nó là bản mới nhất của key.',
      ],
    },
    {
      id: 'cleaner',
      title: 'Log cleaner làm việc',
      beats: [
        'Compaction không chạy ngay khi có tin mới. Một luồng nền tên là log cleaner làm việc này.',
        'Partition chia thành phần sạch đã compact, phần bẩn chưa compact, và active segment đang ghi.',
        'Cleaner đọc phần bẩn, lập bảng ghi offset mới nhất của từng key.',
        'Rồi nó chép lại các segment, và bỏ mọi tin có offset cũ hơn bảng.',
        'Active segment không bao giờ bị compact, nên bản cũ nằm trong đó vẫn còn.',
      ],
    },
    {
      id: 'ratio',
      title: 'Khi nào cleaner dọn',
      beats: [
        'Cleaner không dọn mỗi khi có tin mới. Nó chỉ dọn khi tỉ lệ bẩn đủ lớn.',
        'Tỉ lệ bẩn là phần bẩn chia cho phần sạch cộng phần bẩn, không tính active segment.',
        'Sạch sáu trăm, bẩn bốn trăm megabyte, vậy tỉ lệ là không phẩy bốn. Chưa tới ngưỡng không phẩy năm, nên chưa dọn.',
        'Phần bẩn lên bảy trăm thì tỉ lệ vượt ngưỡng. Cleaner chọn partition này và bắt đầu dọn.',
        'Vì active segment không được compact, nên segment ms quyết định bản cũ nằm chờ bao lâu.',
      ],
    },
    {
      id: 'tombstone',
      title: 'Tombstone',
      beats: [
        'Người dùng hai xoá tài khoản. Muốn xoá nó khỏi topic compacted, ta ghi một tin có key user hai và value là null.',
        'Tin này gọi là tombstone, tức bia mộ.',
        'Cleaner chạy, xoá mọi bản cũ của user hai. Nhưng tombstone được giữ lại.',
        'Nó sống thêm delete retention ms, mặc định một ngày, để consumer chậm kịp đọc thấy rồi xoá user hai khỏi cache của mình.',
        'Hết hạn, tombstone cũng bị dọn. Key user hai biến mất hoàn toàn.',
      ],
    },
    {
      id: 'summary',
      title: 'Tóm tắt',
      hold: 2,
      beats: [
        'Một: delete xoá theo tuổi, compact xoá theo key và chỉ giữ bản mới nhất.',
        'Hai: compaction không đổi offset, chỉ để lại lỗ.',
        'Ba: cleaner chạy nền khi đủ tỉ lệ bẩn, và không bao giờ đụng vào active segment.',
        'Và bốn: tombstone là tin có value null, được giữ thêm delete retention ms rồi mới bị dọn.',
      ],
    },
  ],
}
