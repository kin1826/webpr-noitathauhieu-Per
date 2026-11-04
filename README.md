# Nơi ta thấu hiểu — website

Mã nguồn web nằm trong `noi-ta-thau-hieu/`; thư mục tĩnh để deploy là `noi-ta-thau-hieu/dist/`.

Website tĩnh chơi tám bộ bài trò chuyện: **Trải Lòng**, **Sau cánh cửa**, **Quýt Ki**, **Nói Hay Nàm**, **Lói Hay Làm**, **Lói Hay Nàm**, **Làm đi đừng nói** và **Uống nhanh lênnnn**. Trải Lòng, Quýt Ki, Nói Hay Nàm và Lói Hay Làm có 50 lá; Sau cánh cửa có 20 lá; Lói Hay Nàm và Làm đi đừng nói có 30 lá; Uống nhanh lênnnn có 100 lá. Nội dung, ảnh nền, font, logo và âm thanh đều được đóng gói cục bộ; website không gọi máy chủ ứng dụng hay cần mạng để tải bộ bài. Tám registry và tệp JSON đang trùng với app iPhone. Service worker lưu sẵn app shell, JSON và font; ảnh nền cùng âm thanh được cache khi dùng để lần chơi sau có thể offline.

Tiến trình lưu riêng theo ID từng bộ trong `localStorage`, còn Tùy chọn được dùng chung. Website nhớ lá hiện tại, số lượt rút và các lá đã gặp; khi mở lại bộ, lá hiện tại được khôi phục. Trải Lòng giữ nguyên khóa tiến trình `trai-long` và ID lá hiện có.

## Chạy cục bộ

```sh
python3 -m http.server 8787 --directory noi-ta-thau-hieu/dist
```

Mở `http://localhost:8787`. Cần chạy qua HTTP để tải JSON và đăng ký service worker.

## Chức năng

- Thư viện có tìm kiếm và bộ lọc danh mục được lấy từ registry bộ bài.
- Cả tám bộ dùng cùng luồng thư viện → hướng dẫn → màn chơi → hết bài/chơi lại.
- Tùy chọn gồm chế độ dừng, xáo lại hoặc cho phép lặp; tốc độ hiệu ứng; âm thanh; rung; hiển thị tiến trình; và cỡ chữ mặc định 80%, có thể chỉnh từ 80–120%.
- Khi rút, các lá lướt nhanh rồi giảm tốc tới lá được chọn. Tiến trình chỉ được ghi sau khi hoạt ảnh kết thúc. Chế độ giảm chuyển động của thiết bị làm hiệu ứng nhẹ hơn.
- Nội dung hai vùng luôn hiện trên cùng lá theo thứ tự `Thật`, `Thách`. Người rút tự trả lời hoặc thực hiện thử thách; có thể bỏ qua nếu không thoải mái. Tương tác có tiếp xúc cần sự đồng ý của người liên quan.

## Thêm hoặc sửa bộ bài

1. Thêm cấu hình bộ bài trong `noi-ta-thau-hieu/dist/data/deck-index.json`, gồm ID ổn định, danh mục, số lá, tên tệp JSON, chủ đề giao diện, font và đường dẫn ảnh.
2. Thêm tệp nội dung trong `noi-ta-thau-hieu/dist/data/`. Mỗi lá cần ID duy nhất và đúng số zone theo `contentZoneCount`; zone có `mainText` và có thể có `label` hoặc `note`. Thứ tự phần tử trong `zones` là thứ tự hiển thị.
3. Đặt ảnh nền/bìa trong `noi-ta-thau-hieu/dist/assets/`. Đường dẫn `backgroundImagePath` trong registry được ánh xạ theo tên tệp cuối.
4. Ảnh nền web được xuất từ PNG của app thành WebP cho trình duyệt hỗ trợ, kèm JPEG dự phòng; logo app được xuất thành các kích thước icon web trong `noi-ta-thau-hieu/dist/assets/`. Nếu thêm tài nguyên bắt buộc phải có ngay khi mở offline lần đầu, thêm nó vào `CORE_ASSETS` và tăng phiên bản `CACHE` trong `noi-ta-thau-hieu/dist/sw.js`.
5. Giữ nguyên ID bộ và ID lá đang tồn tại khi chỉ sửa câu chữ hoặc giao diện để không làm mất tiến trình đã lưu trên thiết bị.

## Bộ Sau cánh cửa

- ID `sau-canh-cua`; danh mục `Trải lòng`; 20 lá, mỗi lá có một vùng nội dung. Đây là bộ 18+ dành cho hai người trưởng thành; hướng dẫn nhắc người chơi chỉ tiếp tục khi cả hai thoải mái và có thể bỏ qua câu hỏi.
- Nội dung nằm trong `noi-ta-thau-hieu/dist/data/sau-canh-cua.json`; ảnh nền trong `noi-ta-thau-hieu/dist/assets/sau-canh-cua-back.webp`.

## Bộ Quýt Ki

- ID `quyt-ki`; danh mục `Drinking`; 50 lá, mỗi lá có một vùng nội dung và note. Mô tả trong thư viện ghi 18+; hướng dẫn nhấn mạnh sự thoải mái, đồng ý và quyền bỏ qua.
- Nội dung nằm trong `noi-ta-thau-hieu/dist/data/quyt-ki.json`; ảnh nền trong `noi-ta-thau-hieu/dist/assets/quyt-ki-back.webp`. Note chỉ rõ lựa chọn uống một hoặc hai ly.

## Bộ Nói Hay Nàm

- ID `noi-hay-nam`; danh mục `Thật hay thách`; 50 lá, mỗi lá gồm hai zone `Thật` rồi `Thách`.
- Nội dung nằm trong `noi-ta-thau-hieu/dist/data/noi-hay-nam.json`; ảnh nền trong `noi-ta-thau-hieu/dist/assets/noi-hay-nam-back.webp`.

## Bộ Lói Hay Làm

- ID `loi-hay-lam`; danh mục `Thật hay thách`; 50 lá, mỗi lá gồm hai zone `Thật` rồi `Thách`, không có note riêng.
- Nội dung gốc hiện đồng bộ từ app nằm trong `noi-ta-thau-hieu/dist/data/loi-hay-lam.json`; ảnh nền trong `noi-ta-thau-hieu/dist/assets/loi-hay-lam-back.webp`.

## Bộ Lói Hay Nàm

- ID `loi-hay-nam`; danh mục `Thật hay thách`; 30 lá, mỗi lá gồm hai zone `Thật` rồi `Thách`, không có note riêng hay level.
- Nội dung đồng bộ từ app nằm trong `noi-ta-thau-hieu/dist/data/loi-hay-nam.json`; ảnh nền riêng trong `noi-ta-thau-hieu/dist/assets/loi-hay-nam-back.webp`.
- Tiến trình được lưu riêng bằng ID này; bộ dùng chung thao tác chạm lá để rút, hiệu ứng, tùy chọn âm thanh/rung và cỡ chữ như các bộ khác.

## Bộ Làm đi đừng nói

- ID `lam-di-dung-noi`; danh mục `Drinking`; 30 lá, mỗi lá có hai zone `Thật` rồi `Thách`. Bộ dành cho người trưởng thành (18+); hướng dẫn nhắc tôn trọng sự đồng ý và quyền bỏ qua thử thách.
- Nội dung nằm trong `noi-ta-thau-hieu/dist/data/lam-di-dung-noi.json`; ảnh nền trong `noi-ta-thau-hieu/dist/assets/lam-di-dung-noi-back.webp`. Tiến trình được lưu riêng theo ID bộ.

## Bộ Uống nhanh lênnnn

- ID `uong-nhanh-len`; danh mục `Drinking`; 100 lá thử thách một vùng, dành để chơi cùng bạn bè. Hướng dẫn khuyến khích uống có chừng mực, chỉ làm điều mọi người thấy thoải mái và cho phép bỏ qua thử thách.
- Nội dung nằm trong `noi-ta-thau-hieu/dist/data/uong-nhanh-len.json`; ảnh nền trong `noi-ta-thau-hieu/dist/assets/uong-nhanh-len-back.webp`.

Ảnh nền web hiện hành của Trải Lòng là `noi-ta-thau-hieu/dist/assets/trai-long-background.webp` (JPEG dự phòng cùng tên). Tên bộ đã nằm trong artwork thì giao diện thư viện không phủ thêm tên lần nữa; tên vẫn có trong nội dung truy cập hỗ trợ trình đọc màn hình.

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
