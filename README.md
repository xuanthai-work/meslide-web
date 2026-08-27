# gslide-web

GSlide Next.js app — UI, `/pdf-maker` (scene export), và Next `/api/*` BFF. Không chứa Chromium, FastAPI, hay nginx.

## Chạy

Chạy qua Compose từ repo [`gslide-ops`](../gslide-ops) (xem README ở đó). Không có đường dẫn Docker "chỉ web" được hỗ trợ.

`/pdf-maker` là trang export mà Chromium (container `api`) tải qua nginx tại `http://proxy/pdf-maker`.

## License

Apache 2.0 — xem [LICENSE](./LICENSE).