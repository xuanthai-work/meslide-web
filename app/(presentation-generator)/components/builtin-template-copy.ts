import type { Locale } from "@/i18n/config";

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
};

export function templateCardCopy(
  template: TemplateCardText & { id: string; is_default?: boolean },
  locale: Locale,
): TemplateCardText {
  if (locale !== "vi-VN" || !template.is_default) {
    return { name: template.name, description: template.description };
  }
  return Object.hasOwn(vietnameseBuiltinCopy, template.id)
    ? vietnameseBuiltinCopy[template.id]
    : { name: template.name, description: template.description };
}
