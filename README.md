# meslide-web

Ứng dụng Next.js của MeSlide: giao diện tạo và chỉnh sửa bài thuyết trình, trang xuất file, và lớp BFF.

Repo này không chứa FastAPI, Chromium, hay reverse proxy. Backend chạy ở [`meslide-api`](../meslide-api).

## Chạy local

Cần Docker. Khởi động `meslide-api` trước trên Docker network `meslide`, rồi:

```powershell
copy .env.example .env
docker compose up --build web
```

Hot-reload khi phát triển:

```powershell
docker compose up --build web-dev
```

Mở [http://localhost:3000](http://localhost:3000).

Trình duyệt chỉ gọi web. Next.js chuyển tiếp `/api/v1`, `/api/v2`, `/app_data` và `/static` tới FastAPI qua `FAST_API_INTERNAL_URL` (mặc định `http://api:8000`). Chromium trong container API tải trang xuất tại `http://web:3000/pdf-maker` (`EXPORT_PAGE_BASE_URL` phía API).

Biến môi trường nằm trong [`.env.example`](./.env.example). Sau khi sửa `.env`, recreate container:

```powershell
docker compose up --build --force-recreate web
```

## Kubernetes

Xem [`deploy/kubernetes/README.md`](./deploy/kubernetes/README.md). Apply API trước (namespace, PVC, Service `api`), sau đó apply web.

## License

Apache 2.0 — xem [LICENSE](./LICENSE).
