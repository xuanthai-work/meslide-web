type TemplateCardText = {
  name: string;
  description?: string | null;
};

const vietnameseBuiltinCopy: Record<string, { name: string; description: string }> = {
  momentum: {
    name: "Bứt phá",
    description: "Mẫu kinh doanh giàu năng lượng, phù hợp với chiến lược, hiệu suất, sản phẩm và lãnh đạo.",
  },
  dynamic: {
    name: "Năng động",
    description: "Bố cục tương phản mạnh với nền tối và điểm nhấn ấm, phù hợp với bài thuyết trình giàu câu chuyện.",
  },
  executive: {
    name: "Điều hành",
    description: "Bố cục dành cho lãnh đạo, với chữ nổi bật, cấu trúc rõ ràng và điểm nhấn tím tinh tế.",
  },
  swift: {
    name: "Nhanh gọn",
    description: "Bố cục tươi sáng, giàu năng lượng, giúp trình bày ngắn gọn và mạch lạc.",
  },
  standard: {
    name: "Tiêu chuẩn",
    description: "Bố cục cân đối, linh hoạt, giúp nội dung công việc rõ ràng và dễ theo dõi.",
  },
  modern: {
    name: "Hiện đại",
    description: "Bố cục hiện đại, thoáng rộng, với kiểu chữ rõ nét và điểm nhấn thị giác mạnh.",
  },
  general: {
    name: "Cơ bản",
    description: "Mẫu cho bài thuyết trình đơn giản, có bố cục gọn gàng và khoảng cách hợp lý.",
  },
  editorial: {
    name: "Biên tập",
    description: "Bố cục mang phong cách biên tập, nhấn mạnh hình ảnh và nội dung.",
  },
  civic: {
    name: "Đô thị",
    description: "Bố cục đơn sắc hiện đại với cấu trúc chặt chẽ, phù hợp với chính sách, nghiên cứu và khu vực công.",
  },
  horizon: {
    name: "Chân trời",
    description: "Bố cục ấm áp, tinh tế với đường nét trang nhã, phù hợp với bất động sản, kiến trúc và đầu tư.",
  },
  landmark: {
    name: "Dấu ấn",
    description: "Bố cục kiến trúc nổi bật với điểm nhấn đỏ ấn tượng và hình ảnh lớn, phù hợp cho dự án và thương mại.",
  },
  mosaic: {
    name: "Sắc màu",
    description: "Bố cục module sinh động với các khối màu tương phản trẻ trung, phù hợp cho bài thuyết trình sáng tạo.",
  },
  nova: {
    name: "Tân tinh",
    description: "Bố cục công nghệ tương lai với dải màu phát quang nổi bật, phù hợp cho đổi mới, công nghệ và dữ liệu.",
  },
  pulse: {
    name: "Nhịp sống",
    description: "Bố cục chuyên nghiệp, chỉn chu với điểm nhấn xanh dịu mắt, phù hợp cho y tế, sức khỏe và nghiên cứu.",
  },
  signal: {
    name: "Tín hiệu",
    description: "Bố cục năng động tông ấm với hình ảnh mạnh mẽ, phù hợp cho tiếp thị, chiến dịch và tăng trưởng.",
  },
  verdant: {
    name: "Sức sống",
    description: "Bố cục hữu cơ trang nhã với kiểu chữ có chân và sắc xanh tươi mới, phù hợp cho câu chuyện thương hiệu và bền vững.",
  },
};

export function templateCardCopy(
  template: TemplateCardText & { id: string; is_default?: boolean },
): TemplateCardText {
  if (!template.is_default) {
    return { name: template.name, description: template.description };
  }
  return Object.hasOwn(vietnameseBuiltinCopy, template.id)
    ? vietnameseBuiltinCopy[template.id]
    : { name: template.name, description: template.description };
}
