# Nơi ta thấu hiểu — website

Website tĩnh chơi bốn bộ bài trò chuyện: **Trải Lòng**, **Nói Hay Nàm**, **Lói Hay Làm** và **Lói Hay Nàm**. Ba bộ đầu có 50 lá; **Lói Hay Nàm** có 30 lá. Nội dung, ảnh nền, font và âm thanh đều được đóng gói cục bộ; website không gọi máy chủ ứng dụng hay cần mạng để tải bộ bài. Service worker lưu sẵn các tài nguyên để chơi offline sau lần mở đầu tiên.

Tiến trình lưu riêng theo ID từng bộ trong `localStorage`, còn Tùy chọn được dùng chung. Website nhớ lá hiện tại, số lượt rút và các lá đã gặp; khi mở lại bộ, lá hiện tại được khôi phục. Trải Lòng giữ nguyên khóa tiến trình `trai-long` và ID lá hiện có.

## Chạy cục bộ

```sh
python3 -m http.server 8787 --directory dist
```

Mở `http://localhost:8787`. Cần chạy qua HTTP để tải JSON và đăng ký service worker.

## Chức năng

- Thư viện có tìm kiếm và bộ lọc danh mục được lấy từ registry bộ bài.
- Cả bốn bộ dùng cùng luồng thư viện → hướng dẫn → màn chơi → hết bài/chơi lại.
- Tùy chọn gồm chế độ dừng, xáo lại hoặc cho phép lặp; tốc độ hiệu ứng; âm thanh; rung; hiển thị tiến trình; và cỡ chữ 90–130%.
- Khi rút, các lá lướt nhanh rồi giảm tốc tới lá được chọn. Tiến trình chỉ được ghi sau khi hoạt ảnh kết thúc. Chế độ giảm chuyển động của thiết bị làm hiệu ứng nhẹ hơn.
- Nội dung hai vùng luôn hiện trên cùng lá theo thứ tự `Thật`, `Thách`. Người rút tự trả lời hoặc thực hiện thử thách; có thể bỏ qua nếu không thoải mái. Tương tác có tiếp xúc cần sự đồng ý của người liên quan.

## Thêm hoặc sửa bộ bài

1. Thêm cấu hình bộ bài trong `dist/data/deck-index.json`, gồm ID ổn định, danh mục, số lá, tên tệp JSON, chủ đề giao diện, font và đường dẫn ảnh.
2. Thêm tệp nội dung trong `dist/data/`. Mỗi lá cần ID duy nhất và đúng số zone theo `contentZoneCount`; zone có `mainText` và có thể có `label` hoặc `note`. Thứ tự phần tử trong `zones` là thứ tự hiển thị.
3. Đặt ảnh nền/bìa trong `dist/assets/`. Đường dẫn `backgroundImagePath` trong registry được ánh xạ theo tên tệp cuối.
4. Nếu thêm âm thanh hoặc tài nguyên cần tải offline, thêm đường dẫn vào `ASSETS` và tăng phiên bản `CACHE` trong `dist/sw.js`.
5. Giữ nguyên ID bộ và ID lá đang tồn tại khi chỉ sửa câu chữ hoặc giao diện để không làm mất tiến trình đã lưu trên thiết bị.

## Bộ Nói Hay Nàm

- ID `noi-hay-nam`; danh mục `Thật hay thách`; 50 lá, mỗi lá gồm hai zone `Thật` rồi `Thách`.
- Nội dung nằm trong `dist/data/noi-hay-nam.json`; ảnh nền trong `dist/assets/noi-hay-nam-back.png`.

## Bộ Lói Hay Làm

- ID `loi-hay-lam`; danh mục `Thật hay thách`; 50 lá, mỗi lá gồm hai zone `Thật` rồi `Thách`, không có note riêng.
- Nội dung gốc hiện đồng bộ từ app nằm trong `dist/data/loi-hay-lam.json`; ảnh nền trong `dist/assets/loi-hay-lam-back.png`.

## Bộ Lói Hay Nàm

- ID `loi-hay-nam`; danh mục `Thật hay thách`; 30 lá, mỗi lá gồm hai zone `Thật` rồi `Thách`, không có note riêng hay level.
- Nội dung đồng bộ từ app nằm trong `dist/data/loi-hay-nam.json`; ảnh nền riêng trong `dist/assets/loi-hay-nam-back.png`.
- Tiến trình được lưu riêng bằng ID này; bộ dùng chung thao tác chạm lá để rút, hiệu ứng, tùy chọn âm thanh/rung và cỡ chữ như các bộ khác.

Ảnh nền hiện hành của Trải Lòng là `dist/assets/trai-long-background.png`. Tên bộ đã nằm trong artwork thì giao diện thư viện không phủ thêm tên lần nữa; tên vẫn có trong nội dung truy cập hỗ trợ trình đọc màn hình.

Ví dụ cấu trúc một lá hai zone:

```json
{
  "id": "noi-hay-nam-01",
  "zones": [
    { "label": "Thật", "mainText": "Câu hỏi nguyên văn." },
    { "label": "Thách", "mainText": "Thử thách nguyên văn." }
  ]
}
```
