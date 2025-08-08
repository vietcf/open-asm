# 📋 Open ASM API Tests

Bộ test API được tổ chức theo modules sử dụng REST Client extension với **environment variables tập trung**.

## ⚙️ Cấu hình tập trung:

### 1. Environment Variables (VS Code Settings):
File `.vscode/settings.json` chứa tất cả config:
```json
{
  "rest-client.environmentVariables": {
    "development": {
      "baseUrl": "http://localhost:3000",
      "apiVersion": "api",
      "username": "admin", 
      "password": "admin123"
    },
    "staging": {
      "baseUrl": "http://staging.openasm.com",
      "apiVersion": "api",
      "username": "testuser",
      "password": "testpass" 
    },
    "production": {
      "baseUrl": "http://api.openasm.com",
      "apiVersion": "v1",
      "username": "produser",
      "password": "prodpass"
    }
  }
}
```

### 2. Chuyển đổi environment:
- Nhấn `Ctrl+Shift+P` → gõ "Rest Client: Switch Environment"
- Hoặc click vào status bar (góc dưới VS Code) chọn environment

## 📁 Cấu trúc thư mục:

```
api-tests/
├── README.md              # Hướng dẫn sử dụng (file này)
├── servers.http           # 🖥️ Server management APIs
├── systems.http           # 🏢 System management APIs  
├── networks.http          # 🌐 Network & IP management APIs
├── contacts.http          # 👥 Contact management APIs
├── tags.http              # 🏷️ Tag management APIs
└── health.http            # 🔧 Health & monitoring APIs
```

## 🚀 Cách sử dụng:

### 1. Setup environment:
```bash
# Khởi động server
npm start
```

### 2. Chọn environment trong VS Code:
- Click status bar → chọn "development"
- Hoặc `Ctrl+Shift+P` → "Switch Environment"

### 3. Chạy tests:
1. **Login trước**: Mở bất kỳ file nào → chạy "Login to get JWT Token"
2. **Test APIs**: Click "Send Request" cho các API khác
3. **Auto JWT**: Token tự động được sử dụng

## 📊 Thứ tự test khuyến nghị:

1. **Health Check** - Kiểm tra server hoạt động
2. **Login** - Lấy JWT token  
3. **Tags** - Test quản lý tags (cơ bản nhất)
4. **Servers** - Test APIs chính
5. **Systems** - Test quản lý systems
6. **Contacts** - Test quản lý contacts
7. **Networks** - Test quản lý network

## ✨ Tính năng:

✅ **Environment tập trung** - Config một lần, dùng mọi nơi
✅ **Auto JWT** - Token tự động extract và reuse
✅ **Multi-environment** - Dev/Staging/Production
✅ **No duplication** - Không lặp lại config
✅ **Easy switch** - Chuyển environment dễ dàng

## 💡 Tips:

- **Environment hiện tại** hiển thị ở status bar VS Code
- **Default headers** được config tự động
- **Token expire**: Chỉ cần chạy lại Login request
- **Multiple files**: Mỗi file có login request riêng
