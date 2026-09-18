# gslide-web

GSlide Next.js app — UI, `/pdf-maker` (scene export), và Next `/api/*` BFF. Không chứa Chromium, FastAPI, hay nginx.

## Chạy

Repo này tự chạy Next.js. FastAPI phải chạy từ [`gslide-api`](../gslide-api) trên cùng Docker network `gslide`.

```powershell
copy .env.example .env
docker compose up --build web
```

Dev (hot-reload):

```powershell
docker compose up --build web-dev
```

Mở [http://localhost:3000](http://localhost:3000). Trình duyệt gọi same-origin tới web; Next.js rewrite `/api/v1`, `/api/v2`, `/app_data`, `/static` sang FastAPI (`FAST_API_INTERNAL_URL=http://api:8000`).

`/pdf-maker` là trang export mà Chromium (container `api`) tải tại `http://web:3000/pdf-maker` (`EXPORT_PAGE_BASE_URL` phía API).

Kubernetes: [`deploy/kubernetes/README.md`](./deploy/kubernetes/README.md). Apply API trước (PVC + Service `api`), rồi web.

## Prompt rewrite và tài liệu tham chiếu

Trang Tạo sử dụng flow thống nhất:

1. Nhập ý tưởng ban đầu.
2. Đính kèm tài liệu tham chiếu nếu cần.
3. Chọn **Viết lại bằng AI** và kiểm tra prompt đã tối ưu.
4. Chọn **Tạo bài thuyết trình** khi nội dung đã phù hợp.

Flow không yêu cầu tài liệu. Prompt-only và document-only vẫn hoạt động bình
thường. Khi có cả prompt và tài liệu, hành vi phụ thuộc rollout flag phía
server:

| `GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE` | Hành vi |
| --- | --- |
| `false` hoặc không khai báo | Rewrite chỉ dùng prompt; tài liệu được chuẩn bị khi tạo bài thuyết trình |
| `true` | Rewrite upload và đọc tài liệu, gửi các file đã phân rã cho API để tạo prompt có ngữ cảnh; bước Create tái sử dụng kết quả đã chuẩn bị |

Flag mặc định là `false`. Cấu hình biến này trong `.env` của repo này, sau đó
recreate service `web`. Các giá trị bật hợp lệ là `1`, `true`, `yes`, và `on`
(không phân biệt hoa thường).

Tài liệu kỹ thuật:

- [Document-aware prompt rewrite](./docs/superpowers/plans/gslide-document-aware-prompt-rewrite-plan.md)
- [Upload flow UI redesign](./docs/superpowers/plans/gslide-upload-flow-ui-redesign-plan.md)

## License

Apache 2.0 — xem [LICENSE](./LICENSE).
